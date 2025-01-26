-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority ticket_priority DEFAULT 'medium',
    status ticket_status DEFAULT 'new',
    creator_id UUID NOT NULL REFERENCES profiles(id),
    assigned_agent_id UUID REFERENCES agents(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS tickets_assigned_agent_id_idx ON tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS tickets_creator_id_idx ON tickets(creator_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);

-- Create updated_at trigger for tickets
CREATE TRIGGER update_tickets_updated_at 
    BEFORE UPDATE ON tickets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
