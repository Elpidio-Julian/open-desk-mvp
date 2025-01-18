-- Function to check user role without triggering RLS
CREATE OR REPLACE FUNCTION check_user_role(user_id UUID, required_roles text[])
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM users
        WHERE id = user_id
        AND role = ANY(required_roles)
    );
$$;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Users policies
-- Allow anyone to create a user profile during signup
CREATE POLICY "Enable public insert for users"
    ON users FOR INSERT
    WITH CHECK (true);

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Admins can do everything
CREATE POLICY "Admins have full access"
    ON users FOR ALL
    USING (check_user_role(auth.uid(), ARRAY['admin']));

-- Agents can view all users
CREATE POLICY "Agents can view all users"
    ON users FOR SELECT
    USING (check_user_role(auth.uid(), ARRAY['admin', 'agent'])); 