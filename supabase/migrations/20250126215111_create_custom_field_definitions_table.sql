-- Create custom field type enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_field_type') THEN
        CREATE TYPE custom_field_type AS ENUM ('text', 'number', 'date', 'boolean', 'select');
    END IF;
END $$;

-- Create custom field definitions table
CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    field_type custom_field_type NOT NULL,
    options JSONB, -- For select type fields, contains array of possible values
    is_required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS custom_field_definitions_name_idx ON custom_field_definitions(name);

-- Create updated_at trigger
CREATE TRIGGER update_custom_field_definitions_updated_at
    BEFORE UPDATE ON custom_field_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default issue category field
INSERT INTO custom_field_definitions (
    name,
    description,
    field_type,
    options,
    is_required,
    is_active,
    display_order
) VALUES (
    'Issue Category',
    'Category of the support ticket',
    'select',
    '["Account Access", "Billing", "Technical Issue", "Feature Request", "Bug Report", "General Inquiry"]',
    true,
    true,
    1
) ON CONFLICT (name) DO NOTHING;
