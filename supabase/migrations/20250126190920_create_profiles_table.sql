-- Create profiles table
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