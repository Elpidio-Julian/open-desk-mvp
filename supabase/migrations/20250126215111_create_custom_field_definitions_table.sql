-- Create enum for field types
CREATE TYPE field_type AS ENUM ('text', 'number', 'boolean', 'date', 'select', 'multi-select');

-- Create enum for content types
CREATE TYPE content_type AS ENUM ('faqs', 'articles', 'routing_rules', 'field');

-- Create custom field definitions table
CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    content_type content_type NOT NULL,
    field_type field_type NOT NULL,
    options JSONB, -- For select type fields, contains array of possible values
    is_required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access to all users" ON custom_field_definitions
  FOR SELECT USING (true);

CREATE POLICY "Allow all access to admins" ON custom_field_definitions
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Create updated_at trigger
CREATE TRIGGER set_custom_field_definitions_updated_at
  BEFORE UPDATE ON custom_field_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default issue category field
INSERT INTO custom_field_definitions (
    name,
    description,
    content_type,
    field_type,
    options,
    is_required,
    is_active,
    display_order
) VALUES (
    'Issue Category',
    'Category of the support ticket',
    'field',
    'select',
    '["Account Access", "Billing", "Technical Issue", "Feature Request", "Bug Report", "General Inquiry"]',
    true,
    true,
    1
) ON CONFLICT (name) DO NOTHING;
