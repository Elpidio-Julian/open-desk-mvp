-- Function to get active tickets for an agent within a time period
CREATE OR REPLACE FUNCTION get_agent_active_tickets(
    agent_id UUID,
    time_period INTERVAL DEFAULT INTERVAL '30 days'
)
RETURNS TABLE (
    total_active BIGINT,
    by_status JSONB,
    by_priority JSONB,
    oldest_ticket_age INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    WITH active_tickets AS (
        SELECT 
            t.status,
            t.priority,
            t.created_at
        FROM tickets t
        WHERE 
            t.assigned_agent_id = agent_id
            AND t.created_at >= (CURRENT_TIMESTAMP - time_period)
            AND t.status NOT IN ('resolved', 'closed', 'archived')
    ),
    status_counts AS (
        -- Pre-calculate counts by status
        SELECT 
            status,
            COUNT(*) as count
        FROM active_tickets
        WHERE status IS NOT NULL
        GROUP BY status
    ),
    priority_counts AS (
        -- Pre-calculate counts by priority
        SELECT 
            priority,
            COUNT(*) as count
        FROM active_tickets
        WHERE priority IS NOT NULL
        GROUP BY priority
    ),
    metrics AS (
        -- Calculate total and age metrics
        SELECT
            COUNT(*)::BIGINT as total_active,
            COALESCE(MAX(NOW() - created_at), INTERVAL '0') as oldest_ticket_age
        FROM active_tickets
    )
    SELECT
        m.total_active,
        COALESCE(
            (SELECT jsonb_object_agg(status, count) FROM status_counts),
            '{}'::jsonb
        ) as by_status,
        COALESCE(
            (SELECT jsonb_object_agg(priority, count) FROM priority_counts),
            '{}'::jsonb
        ) as by_priority,
        m.oldest_ticket_age
    FROM metrics m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get agent response metrics
CREATE OR REPLACE FUNCTION get_agent_response_metrics(
    agent_id UUID,
    time_period INTERVAL DEFAULT INTERVAL '30 days'
)
RETURNS TABLE (
    avg_first_response INTERVAL,
    avg_response_time INTERVAL,
    response_time_trend JSONB
) AS $$
DECLARE
    agent_profile_id UUID;
BEGIN
    -- Get the profile_id for the agent
    SELECT profile_id INTO agent_profile_id
    FROM agents
    WHERE id = agent_id;

    RETURN QUERY
    WITH first_responses AS (
        -- Get first response for each ticket
        SELECT 
            t.id as ticket_id,
            t.created_at as ticket_created,
            MIN(c.created_at) as first_response
        FROM tickets t
        LEFT JOIN comments c ON c.ticket_id = t.id
        WHERE 
            t.assigned_agent_id = agent_id
            AND t.created_at >= (CURRENT_TIMESTAMP - time_period)
            AND c.user_id = agent_profile_id
            AND NOT c.is_internal
        GROUP BY t.id, t.created_at
    ),
    response_times AS (
        -- Get all response times
        SELECT 
            t.id as ticket_id,
            c.created_at,
            c.created_at - LAG(c.created_at) OVER (
                PARTITION BY t.id 
                ORDER BY c.created_at
            ) as response_time
        FROM tickets t
        JOIN comments c ON c.ticket_id = t.id
        WHERE 
            t.assigned_agent_id = agent_id
            AND t.created_at >= (CURRENT_TIMESTAMP - time_period)
            AND c.user_id = agent_profile_id
            AND NOT c.is_internal
    ),
    metrics AS (
        -- Calculate overall metrics
        SELECT
            make_interval(secs => AVG(
                EXTRACT(EPOCH FROM (first_response - ticket_created))
            )) as avg_first_response,
            make_interval(secs => AVG(
                EXTRACT(EPOCH FROM response_time)
            )) as avg_response_time
        FROM first_responses
        LEFT JOIN response_times USING (ticket_id)
    ),
    daily_trend AS (
        -- Calculate daily trend data
        SELECT 
            DATE_TRUNC('day', first_response) as day,
            ROUND(
                AVG(
                    EXTRACT(EPOCH FROM (first_response - ticket_created))
                )
            ) as avg_response_seconds
        FROM first_responses
        WHERE first_response IS NOT NULL
        GROUP BY DATE_TRUNC('day', first_response)
    ),
    trend_json AS (
        -- Format trend data as JSON
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', day,
                'average_response_time', avg_response_seconds
            ) ORDER BY day
        ) as trend
        FROM daily_trend
    )
    SELECT
        COALESCE(m.avg_first_response, INTERVAL '0'),
        COALESCE(m.avg_response_time, INTERVAL '0'),
        COALESCE(t.trend, '[]'::jsonb)
    FROM metrics m
    CROSS JOIN trend_json t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get agent resolution metrics
CREATE OR REPLACE FUNCTION get_agent_resolution_metrics(
    agent_id UUID,
    time_period INTERVAL DEFAULT INTERVAL '30 days'
)
RETURNS TABLE (
    total_resolved BIGINT,
    resolved_today BIGINT,
    resolved_this_week BIGINT,
    avg_resolution_time INTERVAL,
    resolution_rate NUMERIC,
    resolution_trend JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH resolution_stats AS (
        -- Get base resolution stats
        SELECT 
            id,
            created_at,
            resolved_at,
            CASE 
                WHEN resolved_at IS NOT NULL THEN TRUE 
                ELSE FALSE 
            END as was_resolved,
            EXTRACT(EPOCH FROM (resolved_at - created_at)) as resolution_time_seconds
        FROM tickets t
        WHERE 
            assigned_agent_id = agent_id
            AND created_at >= (CURRENT_TIMESTAMP - time_period)
    ),
    metrics AS (
        -- Calculate overall metrics
        SELECT
            COUNT(*) FILTER (WHERE was_resolved) as total_resolved,
            COUNT(*) FILTER (WHERE was_resolved AND DATE(resolved_at) = CURRENT_DATE) as resolved_today,
            COUNT(*) FILTER (WHERE was_resolved AND resolved_at >= DATE_TRUNC('week', NOW())) as resolved_this_week,
            AVG(resolution_time_seconds) FILTER (WHERE was_resolved) as avg_resolution_seconds,
            ROUND(
                (COUNT(*) FILTER (WHERE was_resolved)::NUMERIC / 
                NULLIF(COUNT(*), 0) * 100),
                2
            ) as resolution_rate
        FROM resolution_stats
    ),
    daily_trend AS (
        -- Calculate daily resolution counts
        SELECT 
            DATE_TRUNC('day', COALESCE(resolved_at, created_at)) as day,
            COUNT(*) FILTER (WHERE was_resolved) as resolved_count,
            COUNT(*) as total_count,
            ROUND(
                (COUNT(*) FILTER (WHERE was_resolved)::NUMERIC / 
                NULLIF(COUNT(*), 0) * 100),
                2
            ) as daily_rate
        FROM resolution_stats
        GROUP BY DATE_TRUNC('day', COALESCE(resolved_at, created_at))
    ),
    trend_json AS (
        -- Format trend data as JSON
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', day,
                'count', resolved_count,
                'total', total_count,
                'rate', daily_rate
            ) ORDER BY day
        ) as trend
        FROM daily_trend
    )
    SELECT
        m.total_resolved,
        m.resolved_today,
        m.resolved_this_week,
        COALESCE(make_interval(secs => m.avg_resolution_seconds), INTERVAL '0'),
        m.resolution_rate,
        COALESCE(t.trend, '[]'::jsonb)
    FROM metrics m
    CROSS JOIN trend_json t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 