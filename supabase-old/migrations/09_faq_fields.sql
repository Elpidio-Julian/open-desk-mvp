-- Add FAQ and article support to custom_field_definitions table
ALTER TABLE custom_field_definitions
ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'field' CHECK (content_type IN ('field', 'faq', 'article')),
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Create index for content type and category
CREATE INDEX IF NOT EXISTS idx_custom_fields_content_type ON custom_field_definitions(content_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_category ON custom_field_definitions(category);

-- Update RLS policies for FAQ management
CREATE POLICY "Admins can manage FAQs and articles"
    ON custom_field_definitions
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Everyone can view FAQs and articles"
    ON custom_field_definitions
    FOR SELECT
    USING (content_type IN ('faq', 'article')); 