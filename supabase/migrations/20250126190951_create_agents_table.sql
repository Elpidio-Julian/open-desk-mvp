CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(profile_id)
);

-- Add RLS policies
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access to all users" ON agents
    FOR SELECT USING (true);

CREATE POLICY "Allow all access to admins" ON agents
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Create updated_at trigger
CREATE TRIGGER set_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
