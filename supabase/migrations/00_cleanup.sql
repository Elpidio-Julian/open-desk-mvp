-- Drop triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
DROP TRIGGER IF EXISTS update_custom_field_definitions_updated_at ON custom_field_definitions;

-- Drop functions
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS assign_ticket(UUID, UUID);
DROP FUNCTION IF EXISTS update_ticket_status(UUID, ticket_status);
DROP FUNCTION IF EXISTS get_ticket_stats(UUID);

-- Drop views
DROP VIEW IF EXISTS ticket_details;
DROP VIEW IF EXISTS agent_workload;
DROP VIEW IF EXISTS recent_activity;

-- Drop policies
DROP POLICY IF EXISTS "Enable public insert for users" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins have full access" ON users;
DROP POLICY IF EXISTS "Agents can view all users" ON users;

DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Agents can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Agents can update tickets" ON tickets;

DROP POLICY IF EXISTS "Users can view comments on their tickets" ON comments;
DROP POLICY IF EXISTS "Agents can view all comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;

DROP POLICY IF EXISTS "Agents can manage tags" ON tags;
DROP POLICY IF EXISTS "Users can view tags" ON tags;

DROP POLICY IF EXISTS "Agents can manage custom fields" ON custom_field_definitions;
DROP POLICY IF EXISTS "Users can view custom fields" ON custom_field_definitions;

-- Drop tables (in correct order due to foreign key constraints)
DROP TABLE IF EXISTS ticket_history;
DROP TABLE IF EXISTS ticket_tags;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS custom_field_definitions;
DROP TABLE IF EXISTS users;

-- Drop types
DROP TYPE IF EXISTS app_role;
DROP TYPE IF EXISTS ticket_status;
DROP TYPE IF EXISTS ticket_priority;

-- Disable RLS
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custom_field_definitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ticket_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ticket_history DISABLE ROW LEVEL SECURITY; 