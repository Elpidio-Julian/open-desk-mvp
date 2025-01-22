-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    focus_area TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create team_members junction table
CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id)
);

-- Create team_skills table
CREATE TABLE IF NOT EXISTS team_skills (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    skill TEXT NOT NULL,
    PRIMARY KEY (team_id, skill)
);

-- Function to create a new team
CREATE OR REPLACE FUNCTION create_team(
    team_name TEXT,
    team_focus_area TEXT,
    initial_members UUID[] DEFAULT NULL,
    initial_skills TEXT[] DEFAULT NULL
) RETURNS teams AS $$
DECLARE
    new_team teams;
    member_id UUID;
    skill_name TEXT;
BEGIN
    -- Create the team
    INSERT INTO teams (name, focus_area)
    VALUES (team_name, team_focus_area)
    RETURNING * INTO new_team;

    -- Add initial members if provided
    IF initial_members IS NOT NULL THEN
        FOREACH member_id IN ARRAY initial_members
        LOOP
            -- Verify user exists and is an agent
            IF EXISTS (SELECT 1 FROM users WHERE id = member_id AND role = 'agent') THEN
                INSERT INTO team_members (team_id, user_id)
                VALUES (new_team.id, member_id);
            END IF;
        END LOOP;
    END IF;

    -- Add initial skills if provided
    IF initial_skills IS NOT NULL THEN
        FOREACH skill_name IN ARRAY initial_skills
        LOOP
            INSERT INTO team_skills (team_id, skill)
            VALUES (new_team.id, skill_name);
        END LOOP;
    END IF;

    RETURN new_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add member to team
CREATE OR REPLACE FUNCTION add_team_member(
    team_id UUID,
    user_id UUID
) RETURNS team_members AS $$
DECLARE
    new_member team_members;
BEGIN
    -- Verify user exists and is an agent
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = user_id AND role = 'agent') THEN
        RAISE EXCEPTION 'User must be an agent to be added to a team';
    END IF;

    -- Add member
    INSERT INTO team_members (team_id, user_id)
    VALUES (team_id, user_id)
    RETURNING * INTO new_member;

    RETURN new_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove member from team
CREATE OR REPLACE FUNCTION remove_team_member(
    team_id UUID,
    user_id UUID
) RETURNS void AS $$
BEGIN
    DELETE FROM team_members tm
    WHERE tm.team_id = remove_team_member.team_id 
    AND tm.user_id = remove_team_member.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add skill to team
CREATE OR REPLACE FUNCTION add_team_skill(
    team_id UUID,
    skill_name TEXT
) RETURNS team_skills AS $$
DECLARE
    new_skill team_skills;
BEGIN
    INSERT INTO team_skills (team_id, skill)
    VALUES (team_id, skill_name)
    RETURNING * INTO new_skill;

    RETURN new_skill;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove skill from team
CREATE OR REPLACE FUNCTION remove_team_skill(
    team_id UUID,
    skill_name TEXT
) RETURNS void AS $$
BEGIN
    DELETE FROM team_skills
    WHERE team_id = $1 AND skill = $2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team details with members and skills
CREATE OR REPLACE FUNCTION get_team_details(
    team_id UUID
) RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_build_object(
            'team', row_to_json(t),
            'members', (
                SELECT json_agg(row_to_json(u))
                FROM users u
                JOIN team_members tm ON tm.user_id = u.id
                WHERE tm.team_id = t.id
            ),
            'skills', (
                SELECT json_agg(skill)
                FROM team_skills ts
                WHERE ts.team_id = t.id
            )
        )
        FROM teams t
        WHERE t.id = team_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to list all teams with basic info
CREATE OR REPLACE FUNCTION list_teams()
RETURNS TABLE (
    id UUID,
    name TEXT,
    focus_area TEXT,
    member_count BIGINT,
    skill_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.focus_area,
        COUNT(DISTINCT tm.user_id) as member_count,
        COUNT(DISTINCT ts.skill) as skill_count
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id
    LEFT JOIN team_skills ts ON ts.team_id = t.id
    GROUP BY t.id, t.name, t.focus_area;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add updated_at trigger for teams table
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to delete a team
CREATE OR REPLACE FUNCTION delete_team(
    team_id UUID
) RETURNS void AS $$
BEGIN
    DELETE FROM teams WHERE id = team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update team details
CREATE OR REPLACE FUNCTION update_team(
    team_id UUID,
    new_name TEXT DEFAULT NULL,
    new_focus_area TEXT DEFAULT NULL
) RETURNS teams AS $$
DECLARE
    updated_team teams;
BEGIN
    UPDATE teams 
    SET 
        name = COALESCE(new_name, name),
        focus_area = COALESCE(new_focus_area, focus_area),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = team_id
    RETURNING * INTO updated_team;

    RETURN updated_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available agents for a team (not already members)
CREATE OR REPLACE FUNCTION get_available_agents(
    team_id UUID
) RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    role TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.full_name,
        u.email,
        u.role,
        u.created_at,
        u.updated_at
    FROM users u
    WHERE u.role = 'agent'
    AND NOT EXISTS (
        SELECT 1 
        FROM team_members tm 
        WHERE tm.user_id = u.id 
        AND tm.team_id = $1
    )
    ORDER BY u.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 