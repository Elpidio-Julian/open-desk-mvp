-- Create custom types
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE ticket_status AS ENUM ('new', 'open', 'pending', 'solved', 'closed');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create profiles table (based on old users table)
CREATE TABLE public.profiles (
    id UUID NOT NULL,
    full_name CHARACTER VARYING(100) NOT NULL,
    email CHARACTER VARYING(255) NOT NULL,
    role CHARACTER VARYING(20) NULL DEFAULT 'customer'::CHARACTER VARYING,
    is_active BOOLEAN NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_email_key UNIQUE (email),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id),
    CONSTRAINT profiles_role_check CHECK (
        role::TEXT = ANY (ARRAY[
            'admin'::CHARACTER VARYING,
            'agent'::CHARACTER VARYING,
            'customer'::CHARACTER VARYING
        ]::TEXT[])
    )
);

-- Create updated_at trigger for profiles
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create core tables
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority ticket_priority DEFAULT 'medium',
    status ticket_status DEFAULT 'new',
    requester_email TEXT NOT NULL,
    requester_name TEXT,
    assigned_agent_id UUID REFERENCES agents(id),
    team_id UUID REFERENCES teams(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id),
    agent_id UUID REFERENCES agents(id),
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS tickets_assigned_agent_id_idx ON tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS tickets_team_id_idx ON tickets(team_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
CREATE INDEX IF NOT EXISTS ticket_history_ticket_id_idx ON ticket_history(ticket_id);
