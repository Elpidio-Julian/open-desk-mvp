-- Enable Row Level Security
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Simplified policies for tickets
CREATE POLICY "Team ticket access"
    ON tickets FOR ALL
    USING (
        team_id IN (
            SELECT team_id 
            FROM agents a
            JOIN profiles p ON a.email = p.email
            WHERE p.email = auth.jwt()->>'email'
        )
    );

-- Simplified policies for agents
CREATE POLICY "Team agent access"
    ON agents FOR SELECT
    USING (
        team_id IN (
            SELECT team_id 
            FROM agents a
            JOIN profiles p ON a.email = p.email
            WHERE p.email = auth.jwt()->>'email'
        )
        OR email = auth.jwt()->>'email'
    );

-- Simplified policies for teams
CREATE POLICY "Team access"
    ON teams FOR SELECT
    USING (
        id IN (
            SELECT team_id 
            FROM agents a
            JOIN profiles p ON a.email = p.email
            WHERE p.email = auth.jwt()->>'email'
        )
    );

-- Simplified policies for ticket history
CREATE POLICY "Team ticket history access"
    ON ticket_history FOR SELECT
    USING (
        ticket_id IN (
            SELECT id 
            FROM tickets 
            WHERE team_id IN (
                SELECT team_id 
                FROM agents a
                JOIN profiles p ON a.email = p.email
                WHERE p.email = auth.jwt()->>'email'
            )
        )
    );

-- Profile policies
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (
        email = auth.jwt()->>'email'
        OR role = 'admin'
        OR (
            role = 'agent' 
            AND EXISTS (
                SELECT 1 FROM agents a
                WHERE a.email = profiles.email
                AND a.team_id IN (
                    SELECT team_id 
                    FROM agents a2
                    JOIN profiles p ON a2.email = p.email
                    WHERE p.email = auth.jwt()->>'email'
                )
            )
        )
    );
