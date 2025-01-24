-- Create skill category enum
CREATE TYPE skill_category AS ENUM ('technical', 'product', 'billing', 'general');

-- Create agent skills table
CREATE TABLE agent_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category skill_category NOT NULL,
    skill_name VARCHAR(50) NOT NULL,
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, category, skill_name)
);

-- Create routing rules table
CREATE TABLE routing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL, -- Stores rule conditions (priority, tags, custom fields)
    target_skills JSONB, -- Required skills for the ticket
    weight INTEGER DEFAULT 1, -- Rule priority/weight
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create agent workload table
CREATE TABLE agent_workload_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    active_tickets INTEGER DEFAULT 0,
    resolved_today INTEGER DEFAULT 0,
    avg_resolution_time INTERVAL,
    last_ticket_assigned_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add routing-related columns to tickets table
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS routing_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS routing_rule_id UUID REFERENCES routing_rules(id),
ADD COLUMN IF NOT EXISTS auto_assigned BOOLEAN DEFAULT false;

-- Create indexes
CREATE INDEX idx_agent_skills_agent ON agent_skills(agent_id);
CREATE INDEX idx_agent_skills_category ON agent_skills(category);
CREATE INDEX idx_routing_rules_active ON routing_rules(is_active);
CREATE INDEX idx_agent_workload_metrics_agent ON agent_workload_metrics(agent_id);

-- Create trigger to update agent workload metrics
CREATE OR REPLACE FUNCTION update_agent_workload()
RETURNS TRIGGER AS $$
BEGIN
    -- Update old assignee metrics if assignment changed
    IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT NULL AND OLD.assigned_to != NEW.assigned_to) THEN
        UPDATE agent_workload_metrics
        SET 
            active_tickets = active_tickets - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_id = OLD.assigned_to;
    END IF;

    -- Update new assignee metrics
    IF (NEW.assigned_to IS NOT NULL) THEN
        INSERT INTO agent_workload_metrics (agent_id, active_tickets, last_ticket_assigned_at)
        VALUES (NEW.assigned_to, 1, CURRENT_TIMESTAMP)
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
            active_tickets = active_tickets - 1,
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

CREATE TRIGGER on_ticket_assignment
    AFTER INSERT OR UPDATE OF assigned_to, status ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_workload();

-- Reset workload metrics daily
CREATE OR REPLACE FUNCTION reset_daily_workload_metrics()
RETURNS void AS $$
BEGIN
    UPDATE agent_workload_metrics
    SET resolved_today = 0,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 