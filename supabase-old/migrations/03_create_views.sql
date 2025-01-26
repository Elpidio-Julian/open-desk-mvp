-- View for ticket details with user information
CREATE OR REPLACE VIEW ticket_details AS
SELECT 
    t.*,
    creator.full_name as creator_name,
    creator.email as creator_email,
    assignee.full_name as assignee_name,
    assignee.email as assignee_email,
    (
        SELECT COUNT(*) 
        FROM comments c 
        WHERE c.ticket_id = t.id
    ) as comment_count
FROM 
    tickets t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id;

-- View for agent workload
CREATE OR REPLACE VIEW agent_workload AS
SELECT 
    u.id as agent_id,
    u.full_name as agent_name,
    COUNT(t.id) as total_tickets,
    COUNT(t.id) FILTER (WHERE t.status = 'open') as open_tickets,
    COUNT(t.id) FILTER (WHERE t.status = 'in_progress') as in_progress_tickets,
    COUNT(t.id) FILTER (WHERE t.status = 'resolved') as resolved_tickets
FROM 
    users u
    LEFT JOIN tickets t ON u.id = t.assigned_to
WHERE 
    u.role_id IN (SELECT id FROM user_roles WHERE name IN ('admin', 'agent'))
GROUP BY 
    u.id, u.full_name;

-- View for recent activity
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    'ticket' as type,
    t.id as reference_id,
    t.title as title,
    u.full_name as actor_name,
    t.created_at as activity_time
FROM 
    tickets t
    JOIN users u ON t.created_by = u.id
UNION ALL
SELECT 
    'comment' as type,
    c.ticket_id as reference_id,
    t.title as title,
    u.full_name as actor_name,
    c.created_at as activity_time
FROM 
    comments c
    JOIN users u ON c.user_id = u.id
    JOIN tickets t ON c.ticket_id = t.id
ORDER BY 
    activity_time DESC; 