CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create updated_at trigger for teams
CREATE TRIGGER update_teams_updated_at 
    BEFORE UPDATE ON teams 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
