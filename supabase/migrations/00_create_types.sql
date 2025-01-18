-- Application roles enum
CREATE TYPE app_role AS ENUM ('admin', 'agent', 'customer');

-- Ticket status and priority enums
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent'); 