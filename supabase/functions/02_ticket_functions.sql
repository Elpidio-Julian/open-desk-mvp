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
            WHEN new_status = 'resolved' THEN CURRENT_TIMESTAMP
            ELSE resolved_at
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ticket_id
    RETURNING * INTO ticket;

    RETURN ticket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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