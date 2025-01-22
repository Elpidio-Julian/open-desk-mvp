-- Function to assign a ticket to an agent
CREATE OR REPLACE FUNCTION assign_ticket(
    ticket_id UUID,
    agent_id UUID
) RETURNS tickets AS $$
DECLARE
    ticket tickets;
BEGIN
    -- Check if the agent exists and is actually an agent
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = agent_id 
        AND role IN ('admin', 'agent')
    ) THEN
        RAISE EXCEPTION 'Invalid agent ID or user is not an agent';
    END IF;

    UPDATE tickets 
    SET 
        assigned_to = agent_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ticket_id
    RETURNING * INTO ticket;

    RETURN ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to change ticket status
CREATE OR REPLACE FUNCTION update_ticket_status(
    ticket_id UUID,
    new_status ticket_status
) RETURNS tickets AS $$
DECLARE
    ticket tickets;
BEGIN
    UPDATE tickets 
    SET 
        status = new_status,
        resolved_at = CASE 
            WHEN new_status = 'resolved' AND (resolved_at IS NULL OR status != 'resolved') THEN CURRENT_TIMESTAMP
            WHEN new_status != 'resolved' THEN NULL
            ELSE resolved_at
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ticket_id
    RETURNING * INTO ticket;

    RETURN ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -- One-time update for existing resolved tickets
-- UPDATE tickets 
-- SET resolved_at = updated_at
-- WHERE status = 'resolved' 
-- AND resolved_at IS NULL;

-- Function to get ticket statistics for dashboard
CREATE OR REPLACE FUNCTION get_ticket_stats(
    user_id UUID
) RETURNS TABLE (
    total_tickets BIGINT,
    open_tickets BIGINT,
    resolved_tickets BIGINT,
    assigned_tickets BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_tickets,
        COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_tickets,
        COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) as assigned_tickets
    FROM tickets
    WHERE 
        created_by = user_id 
        OR assigned_to = user_id
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = user_id 
            AND role IN ('admin', 'agent')
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record ticket history
CREATE OR REPLACE FUNCTION record_ticket_history()
RETURNS TRIGGER AS $$
DECLARE
    old_value TEXT;
    new_value TEXT;
BEGIN
    -- Track status changes
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'status', OLD.status::TEXT, NEW.status::TEXT);
    END IF;

    -- Track priority changes
    IF (TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'priority', OLD.priority::TEXT, NEW.priority::TEXT);
    END IF;

    -- Track assignment changes
    IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (
            NEW.id, 
            auth.uid(), 
            'assigned_to',
            COALESCE((SELECT email FROM users WHERE id = OLD.assigned_to), 'unassigned'),
            COALESCE((SELECT email FROM users WHERE id = NEW.assigned_to), 'unassigned')
        );
    END IF;

    -- Track title changes
    IF (TG_OP = 'UPDATE' AND OLD.title IS DISTINCT FROM NEW.title) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'title', OLD.title, NEW.title);
    END IF;

    -- Track description changes
    IF (TG_OP = 'UPDATE' AND OLD.description IS DISTINCT FROM NEW.description) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'description', OLD.description, NEW.description);
    END IF;

    -- Track custom fields changes
    IF (TG_OP = 'UPDATE' AND OLD.custom_fields IS DISTINCT FROM NEW.custom_fields) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'custom_fields', OLD.custom_fields::TEXT, NEW.custom_fields::TEXT);
    END IF;

    -- Track ticket creation
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'ticket_created', NULL, 'Ticket created');
    END IF;

    -- Track ticket resolution
    IF (TG_OP = 'UPDATE' AND OLD.resolved_at IS NULL AND NEW.resolved_at IS NOT NULL) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'resolution', 'open', 'resolved');
    END IF;

    -- Track ticket closure
    IF (TG_OP = 'UPDATE' AND OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'closure', 'not_closed', 'closed');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_ticket_history()
RETURNS TRIGGER AS $$
DECLARE
    old_value TEXT;
    new_value TEXT;
    current_user_id UUID := auth.uid(); -- Store the user ID in a variable
BEGIN
    -- Check if the user ID is NULL
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User is not authenticated, cannot record ticket history';
    END IF;

    -- Track status changes
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, current_user_id, 'status', OLD.status::TEXT, NEW.status::TEXT);
    END IF;

    -- Track priority changes
    IF (TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, current_user_id, 'priority', OLD.priority::TEXT, NEW.priority::TEXT);
    END IF;

    -- Track assignment changes
    IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (
            NEW.id, 
            current_user_id, 
            'assigned_to',
            COALESCE((SELECT email FROM users WHERE id = OLD.assigned_to), 'unassigned'),
            COALESCE((SELECT email FROM users WHERE id = NEW.assigned_to), 'unassigned')
        );
    END IF;

    -- Track title changes
    IF (TG_OP = 'UPDATE' AND OLD.title IS DISTINCT FROM NEW.title) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, current_user_id, 'title', OLD.title, NEW.title);
    END IF;

    -- Track description changes
    IF (TG_OP = 'UPDATE' AND OLD.description IS DISTINCT FROM NEW.description) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, current_user_id, 'description', OLD.description, NEW.description);
    END IF;

    -- Track custom fields changes
    IF (TG_OP = 'UPDATE' AND OLD.custom_fields IS DISTINCT FROM NEW.custom_fields) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, current_user_id, 'custom_fields', OLD.custom_fields::TEXT, NEW.custom_fields::TEXT);
    END IF;

    -- Track ticket creation
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, current_user_id, 'ticket_created', NULL, 'Ticket created');
    END IF;

    -- Track ticket resolution
    IF (TG_OP = 'UPDATE' AND OLD.resolved_at IS NULL AND NEW.resolved_at IS NOT NULL) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, current_user_id, 'resolution', 'open', 'resolved');
    END IF;

    -- Track ticket closure
    IF (TG_OP = 'UPDATE' AND OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL) THEN
        INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
        VALUES (NEW.id, current_user_id, 'closure', 'not_closed', 'closed');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;