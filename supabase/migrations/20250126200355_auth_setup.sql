-- Create a trigger function for profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(
            -- First try to get role from raw_app_meta_data (set by server)
            NEW.raw_app_meta_data->>'app_role',
            -- Then try to get from raw_user_meta_data (set during signup)
            NEW.raw_user_meta_data->>'app_role',
            -- Finally fallback to customer
            'customer'
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile except role"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        (
            -- Don't allow role changes through normal update
            role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR
            -- Unless they're an admin
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid() AND role = 'admin'
            )
        )
    );

-- Admin policy for managing roles
CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create a view for backward compatibility with old users table
CREATE OR REPLACE VIEW public.users AS
SELECT 
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
FROM public.profiles;
