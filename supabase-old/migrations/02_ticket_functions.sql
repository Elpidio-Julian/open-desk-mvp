-- Function to record ticket history
CREATE OR REPLACE FUNCTION record_ticket_history()
RETURNS TRIGGER AS $$
DECLARE
    old_value TEXT;
    new_value TEXT;
    current_user_id UUID;
    v_is_service_role boolean;
BEGIN
    -- Check if this is a service role operation
    v_is_service_role := current_setting('request.jwt.claims', true)::json->>'role' = 'service_role';
    
    -- Get the user ID from the JWT claims if not service role
    IF NOT v_is_service_role THEN
        current_user_id := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
        IF current_user_id IS NULL THEN
            RAISE EXCEPTION 'User is not authenticated';
        END IF;
    ELSE
        -- Get the first admin user's ID for service role operations
        SELECT id INTO current_user_id
        FROM users
        WHERE role = 'admin'
        AND is_active = true
        LIMIT 1;

        IF current_user_id IS NULL THEN
            RAISE EXCEPTION 'No active admin user found';
        END IF;
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