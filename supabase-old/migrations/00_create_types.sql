-- Application roles enum
CREATE TYPE app_role AS ENUM ('admin', 'agent', 'customer');

-- Create ENUMs for ticket statuses and priorities
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');