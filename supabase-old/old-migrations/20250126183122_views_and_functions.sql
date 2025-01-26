-- Create views for ticket management
CREATE OR REPLACE VIEW ticket_details AS
SELECT 
    t.id,
    t.subject,
    t.description,
    t.priority,
    t.status,
    t.team_id,
    t.assigned_agent_id,
    t.created_at,
    t.updated_at,
    a.name as assigned_agent_name,
    p.email as assigned_agent_email,
    tm.name as team_name,
    COALESCE(rp.full_name, t.requester_name) as requester_name,
    t.requester_email
FROM tickets t
LEFT JOIN agents a ON t.assigned_agent_id = a.id
LEFT JOIN profiles p ON a.email = p.email
LEFT JOIN teams tm ON t.team_id = tm.id
LEFT JOIN profiles rp ON t.requester_email = rp.email;

-- Core ticket functions
CREATE OR REPLACE FUNCTION assign_ticket(
    ticket_id UUID,
    agent_id UUID
) RETURNS void AS $$
BEGIN
    UPDATE tickets 
    SET 
        assigned_agent_id = agent_id,
        status = CASE 
            WHEN status = 'new' THEN 'open'::ticket_status 
            ELSE status 
        END,
        updated_at = NOW()
    WHERE id = ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unified ticket change tracking
CREATE OR REPLACE FUNCTION handle_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Track status changes
    IF TG_OP = 'UPDATE' THEN
        -- Status changes
        IF NEW.status != OLD.status THEN
            INSERT INTO ticket_history (
                ticket_id,
                agent_id,
                field_name,
                old_value,
                new_value
            ) VALUES (
                NEW.id,
                NEW.assigned_agent_id,
                'status',
                OLD.status::text,
                NEW.status::text
            );
        END IF;
        
        -- Priority changes
        IF NEW.priority != OLD.priority THEN
            INSERT INTO ticket_history (
                ticket_id,
                agent_id,
                field_name,
                old_value,
                new_value
            ) VALUES (
                NEW.id,
                NEW.assigned_agent_id,
                'priority',
                OLD.priority::text,
                NEW.priority::text
            );
        END IF;

        -- Assignment changes
        IF NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN
            -- Record in ticket history
            INSERT INTO ticket_history (
                ticket_id,
                agent_id,
                field_name,
                old_value,
                new_value
            ) VALUES (
                NEW.id,
                NEW.assigned_agent_id,
                'assigned_agent_id',
                COALESCE((
                    SELECT p.full_name 
                    FROM agents a 
                    JOIN profiles p ON a.email = p.email 
                    WHERE a.id = OLD.assigned_agent_id
                ), 'unassigned'),
                COALESCE((
                    SELECT p.full_name 
                    FROM agents a 
                    JOIN profiles p ON a.email = p.email 
                    WHERE a.id = NEW.assigned_agent_id
                ), 'unassigned')
            );

            -- Create notification for new assignment
            IF NEW.assigned_agent_id IS NOT NULL AND OLD.assigned_agent_id IS NULL THEN
                INSERT INTO notifications (
                    agent_id,
                    title,
                    content
                ) VALUES (
                    NEW.assigned_agent_id,
                    'New Ticket Assigned',
                    format('You have been assigned ticket: %s', NEW.subject)
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old triggers if they exist
DROP TRIGGER IF EXISTS ticket_changes_trigger ON tickets;
DROP TRIGGER IF EXISTS ticket_notification_trigger ON tickets;

-- Create unified trigger
CREATE TRIGGER ticket_changes_trigger
    AFTER UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION handle_ticket_changes();
