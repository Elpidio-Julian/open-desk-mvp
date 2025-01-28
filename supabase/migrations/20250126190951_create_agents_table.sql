CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(team_id, profile_id)
);

-- Add RLS policies
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Create policies for agents table
CREATE POLICY "Allow read access to all authenticated users" ON agents
    FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "Allow all access to admins" ON agents
    FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create updated_at trigger
CREATE TRIGGER set_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
