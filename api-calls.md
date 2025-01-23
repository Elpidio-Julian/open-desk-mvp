# Component Supabase API Calls

## Login.jsx
**Purpose**: Handle user authentication and registration
- `supabase.auth.signUp()` - Register new user with email/password
- `supabase.auth.signInWithPassword()` - Sign in existing user
- `supabase.auth.getUser()` - Get current user data
- `supabase.from('users').select()` - Get user role after login

## AdminAnalytics.jsx
**Purpose**: Fetch and display analytics data for all agents
- `supabase.from('users').select()` - Get all agents
- `supabase.rpc('get_agent_active_tickets')` - Get active tickets metrics
- `supabase.rpc('get_agent_response_metrics')` - Get response time metrics
- `supabase.rpc('get_agent_resolution_metrics')` - Get resolution metrics

## TeamManagement.jsx
**Purpose**: Manage teams, members, and skills
- `supabase.rpc('list_teams')` - List all teams
- `supabase.from('users').select()` - Get available agents
- `supabase.from('team_members').select()` - Get team members
- `supabase.rpc('create_team')` - Create new team
- `supabase.rpc('add_team_member')` - Add member to team
- `supabase.rpc('add_team_skill')` - Add skill to team
- `supabase.rpc('get_team_details')` - Get team details
- `supabase.rpc('update_team')` - Update team details
- `supabase.rpc('delete_team')` - Delete team
- `supabase.rpc('remove_team_member')` - Remove member from team
- `supabase.rpc('remove_team_skill')` - Remove skill from team

## SupportQueue.jsx
**Purpose**: Manage ticket queue and assignments
- `supabase.from('tickets').update()` - Bulk assign tickets
- `supabase.from('tickets').update()` - Bulk update ticket status

## AgentPerformanceMetrics.jsx
**Purpose**: Display individual agent performance metrics
- `supabase.rpc('get_agent_active_tickets')` - Get agent's active tickets
- `supabase.rpc('get_agent_response_metrics')` - Get agent's response metrics
- `supabase.rpc('get_agent_resolution_metrics')` - Get agent's resolution metrics

## CustomerTickets.jsx
**Purpose**: Manage customer tickets and comments
- `supabase.from('tickets').insert()` - Create new ticket
- `supabase.from('comments').insert()` - Add comment to ticket

## Common Patterns:
1. **RPC Functions**: Heavy use of RPC functions for complex operations
2. **Bulk Operations**: Support for bulk updates on tickets
3. **Metrics**: Extensive use of metrics-related RPC calls
4. **Team Management**: Comprehensive team CRUD operations
5. **Error Handling**: Consistent error handling pattern across components
6. **Authentication**: Centralized auth handling in Login component 