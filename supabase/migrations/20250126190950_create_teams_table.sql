CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{"focus_area": "general"}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access to all users" ON teams
    FOR SELECT USING (true);

CREATE POLICY "Allow all access to admins" ON teams
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Create updated_at trigger
CREATE TRIGGER set_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create index for focus_area lookups
CREATE INDEX teams_focus_area_idx ON teams ((metadata->>'focus_area'));
