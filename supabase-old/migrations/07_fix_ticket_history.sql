-- Update the trigger function to handle service role operations
CREATE OR REPLACE FUNCTION record_ticket_history()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id uuid;
    v_is_service_role boolean;
BEGIN
    -- Check if this is a service role operation
    v_is_service_role := current_setting('request.jwt.claims', true)::json->>'role' = 'service_role';
    
    -- Get the user ID from the JWT claims if not service role
    IF NOT v_is_service_role THEN
        v_user_id := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
        IF v_user_id IS NULL THEN
            RAISE EXCEPTION 'User is not authenticated';
        END IF;
    END IF;

    -- Record the history
    INSERT INTO ticket_history (
        ticket_id,
        changed_by,
        old_status,
        new_status,
        old_priority,
        new_priority,
        old_assigned_to,
        new_assigned_to,
        is_system_update
    ) VALUES (
        NEW.id,
        COALESCE(v_user_id, '00000000-0000-0000-0000-000000000000'::uuid), -- Use system user ID for service role
        OLD.status,
        NEW.status,
        OLD.priority,
        NEW.priority,
        OLD.assigned_to,
        NEW.assigned_to,
        v_is_service_role -- Mark as system update if service role
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 