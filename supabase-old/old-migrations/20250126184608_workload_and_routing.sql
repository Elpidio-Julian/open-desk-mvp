-- Create a view for active tickets per agent
CREATE OR REPLACE VIEW agent_active_tickets AS
SELECT 
    assigned_agent_id as agent_id,
    COUNT(*)::integer as open_tickets
FROM tickets
WHERE status NOT IN ('solved', 'closed')
GROUP BY assigned_agent_id;

-- Simplified workload metrics functions
CREATE OR REPLACE FUNCTION get_agent_workload(agent_id UUID)
RETURNS INTEGER AS $$
    SELECT COALESCE(open_tickets, 0)
    FROM agent_active_tickets
    WHERE agent_id = $1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_team_workload(team_id UUID)
RETURNS TABLE (
    agent_id UUID,
    agent_name TEXT,
    open_tickets INTEGER
) AS $$
    SELECT 
        a.id as agent_id,
        a.name as agent_name,
        COALESCE(t.open_tickets, 0) as open_tickets
    FROM agents a
    LEFT JOIN agent_active_tickets t ON t.agent_id = a.id
    WHERE a.team_id = team_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Simplified routing intelligence functions
CREATE OR REPLACE FUNCTION find_available_agent(team_id UUID)
RETURNS UUID AS $$
    SELECT a.id
    FROM agents a
    LEFT JOIN agent_active_tickets t ON t.agent_id = a.id
    WHERE a.team_id = team_id
    ORDER BY COALESCE(t.open_tickets, 0) ASC
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Auto-assignment function
CREATE OR REPLACE FUNCTION auto_assign_ticket(ticket_id UUID)
RETURNS void AS $$
DECLARE
    v_team_id UUID;
    v_agent_id UUID;
BEGIN
    -- Get the ticket's team
    SELECT team_id INTO v_team_id
    FROM tickets
    WHERE id = ticket_id;

    -- Find available agent
    SELECT find_available_agent(v_team_id) INTO v_agent_id;

    -- Assign ticket
    IF v_agent_id IS NOT NULL THEN
        PERFORM assign_ticket(ticket_id, v_agent_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Team metrics using the view
CREATE OR REPLACE FUNCTION get_team_metrics(team_id UUID)
RETURNS TABLE (
    total_tickets BIGINT,
    open_tickets BIGINT,
    solved_tickets BIGINT,
    avg_resolution_time INTERVAL
) AS $$
    SELECT 
        COUNT(*)::bigint as total_tickets,
        COALESCE(SUM(CASE WHEN status NOT IN ('solved', 'closed') THEN 1 ELSE 0 END), 0)::bigint as open_tickets,
        COALESCE(SUM(CASE WHEN status IN ('solved', 'closed') THEN 1 ELSE 0 END), 0)::bigint as solved_tickets,
        AVG(
            CASE 
                WHEN status IN ('solved', 'closed') 
                THEN updated_at - created_at 
            END
        ) as avg_resolution_time
    FROM tickets
    WHERE team_id = team_id;
$$ LANGUAGE sql SECURITY DEFINER;
