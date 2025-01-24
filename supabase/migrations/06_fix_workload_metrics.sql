-- Drop the existing primary key if it exists
ALTER TABLE agent_workload_metrics 
    DROP CONSTRAINT IF EXISTS agent_workload_metrics_pkey;

-- Make agent_id the primary key
ALTER TABLE agent_workload_metrics 
    ADD CONSTRAINT agent_workload_metrics_pkey 
    PRIMARY KEY (agent_id);

-- Update the trigger function to handle the case where the agent already has metrics
CREATE OR REPLACE FUNCTION update_agent_workload()
RETURNS TRIGGER AS $$
BEGIN
    -- Update old assignee metrics if assignment changed
    IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT NULL AND OLD.assigned_to != NEW.assigned_to) THEN
        UPDATE agent_workload_metrics
        SET 
            active_tickets = GREATEST(active_tickets - 1, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_id = OLD.assigned_to;
    END IF;

    -- Update new assignee metrics
    IF (NEW.assigned_to IS NOT NULL) THEN
        INSERT INTO agent_workload_metrics (
            agent_id, 
            active_tickets, 
            last_ticket_assigned_at
        )
        VALUES (
            NEW.assigned_to, 
            1, 
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (agent_id) DO UPDATE
        SET 
            active_tickets = agent_workload_metrics.active_tickets + 1,
            last_ticket_assigned_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- Update resolution metrics
    IF (TG_OP = 'UPDATE' AND NEW.status = 'resolved' AND OLD.status != 'resolved') THEN
        UPDATE agent_workload_metrics
        SET 
            active_tickets = GREATEST(active_tickets - 1, 0),
            resolved_today = resolved_today + 1,
            avg_resolution_time = (
                COALESCE(avg_resolution_time, '0'::interval) + 
                (NEW.resolved_at - NEW.created_at)
            ) / 2,
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_id = NEW.assigned_to;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 