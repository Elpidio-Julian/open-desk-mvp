-- Function to get agent's active tickets metrics
CREATE OR REPLACE FUNCTION get_agent_active_tickets(
    agent_id UUID,
    time_period INTERVAL DEFAULT INTERVAL '30 days'
) RETURNS TABLE (
    total_active BIGINT,
    by_status JSON,
    by_priority JSON,
    oldest_ticket_age INTERVAL,
    newest_ticket_age INTERVAL
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH active_tickets AS (
        SELECT *
        FROM tickets
        WHERE assigned_to = agent_id
        AND status NOT IN ('resolved', 'closed')
        AND created_at >= NOW() - time_period
    )
    SELECT 
        COUNT(*)::BIGINT as total_active,
        (
            SELECT json_build_object(
                'open', COUNT(*) FILTER (WHERE status = 'open'),
                'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
                'waiting_on_customer', COUNT(*) FILTER (WHERE status = 'waiting_on_customer')
            )
            FROM active_tickets
        ) as by_status,
        (
            SELECT json_build_object(
                'urgent', COUNT(*) FILTER (WHERE priority = 'urgent'),
                'high', COUNT(*) FILTER (WHERE priority = 'high'),
                'medium', COUNT(*) FILTER (WHERE priority = 'medium'),
                'low', COUNT(*) FILTER (WHERE priority = 'low')
            )
            FROM active_tickets
        ) as by_priority,
        MAX(NOW() - created_at) as oldest_ticket_age,
        MIN(NOW() - created_at) as newest_ticket_age
    FROM active_tickets;
END;
$$;

-- Function to get agent's response time metrics
CREATE OR REPLACE FUNCTION get_agent_response_metrics(
    agent_id UUID,
    time_period INTERVAL DEFAULT INTERVAL '30 days'
) RETURNS TABLE (
    avg_first_response INTERVAL,
    avg_response_time INTERVAL,
    response_time_trend JSON
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH first_responses AS (
        -- Get first response time for each ticket
        SELECT 
            t.id as ticket_id,
            t.created_at as ticket_created_at,
            MIN(c.created_at) as first_response_at,
            MIN(c.created_at) - t.created_at as first_response_time
        FROM tickets t
        LEFT JOIN comments c ON t.id = c.ticket_id 
            AND c.user_id = agent_id 
            AND NOT c.is_internal
        WHERE t.assigned_to = agent_id
        AND t.created_at >= NOW() - time_period
        GROUP BY t.id, t.created_at
        HAVING MIN(c.created_at) IS NOT NULL
    ),
    response_intervals AS (
        -- Calculate time between consecutive agent responses
        SELECT 
            c1.ticket_id,
            c1.created_at as response_time,
            c1.created_at - LAG(c1.created_at) OVER (
                PARTITION BY c1.ticket_id 
                ORDER BY c1.created_at
            ) as response_interval
        FROM comments c1
        WHERE c1.user_id = agent_id
        AND NOT c1.is_internal
        AND c1.created_at >= NOW() - time_period
    ),
    daily_averages AS (
        -- Calculate daily average response times
        SELECT 
            DATE_TRUNC('day', COALESCE(ri.response_time, fr.first_response_at)) as day,
            AVG(CASE 
                WHEN ri.response_interval IS NOT NULL THEN ri.response_interval
                ELSE fr.first_response_time
            END) as avg_response_interval
        FROM first_responses fr
        LEFT JOIN response_intervals ri ON fr.ticket_id = ri.ticket_id
        GROUP BY DATE_TRUNC('day', COALESCE(ri.response_time, fr.first_response_at))
        ORDER BY day
    )
    SELECT
        AVG(first_response_time) as avg_first_response,
        COALESCE(
            AVG(CASE 
                WHEN response_interval IS NOT NULL THEN response_interval
                ELSE first_response_time
            END),
            AVG(first_response_time)
        ) as avg_response_time,
        (
            SELECT json_agg(json_build_object(
                'date', day,
                'average_response_time', avg_response_interval
            ))
            FROM daily_averages
        ) as response_time_trend
    FROM first_responses
    LEFT JOIN response_intervals ON first_responses.ticket_id = response_intervals.ticket_id;
END;
$$;

-- Function to get agent's resolution metrics
CREATE OR REPLACE FUNCTION get_agent_resolution_metrics(
    agent_id UUID,
    time_period INTERVAL DEFAULT INTERVAL '30 days'
) RETURNS TABLE (
    total_resolved BIGINT,
    resolved_today BIGINT,
    resolved_this_week BIGINT,
    resolved_this_month BIGINT,
    avg_resolution_time INTERVAL,
    resolution_rate NUMERIC,
    resolution_trend JSON
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH resolved_tickets AS (
        SELECT *
        FROM tickets
        WHERE assigned_to = agent_id
        AND status = 'resolved'
        AND resolved_at >= NOW() - time_period
    ),
    daily_resolutions AS (
        SELECT 
            DATE_TRUNC('day', resolved_at) as day,
            COUNT(*) as resolved_count
        FROM resolved_tickets
        GROUP BY DATE_TRUNC('day', resolved_at)
        ORDER BY day
    )
    SELECT
        COUNT(*)::BIGINT as total_resolved,
        COUNT(*) FILTER (WHERE DATE(resolved_at) = CURRENT_DATE)::BIGINT as resolved_today,
        COUNT(*) FILTER (WHERE resolved_at >= DATE_TRUNC('week', NOW()))::BIGINT as resolved_this_week,
        COUNT(*) FILTER (WHERE resolved_at >= DATE_TRUNC('month', NOW()))::BIGINT as resolved_this_month,
        AVG(resolved_at - created_at) as avg_resolution_time,
        (
            COUNT(*) FILTER (WHERE status = 'resolved')::NUMERIC / 
            NULLIF(COUNT(*), 0)::NUMERIC
        ) * 100 as resolution_rate,
        (
            SELECT json_agg(json_build_object(
                'date', day,
                'count', resolved_count
            ))
            FROM daily_resolutions
        ) as resolution_trend
    FROM resolved_tickets;
END;
$$; 