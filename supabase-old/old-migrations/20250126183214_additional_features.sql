-- Notifications system
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view their own notifications"
    ON notifications FOR SELECT
    USING (agent_id IN (
        SELECT id 
        FROM agents 
        WHERE email = auth.jwt()->>'email'
    ));

-- FAQ system
CREATE TABLE IF NOT EXISTS faq_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faq_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES faq_categories(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for FAQ tables
ALTER TABLE faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_articles ENABLE ROW LEVEL SECURITY;

-- FAQ policies
CREATE POLICY "Everyone can view FAQ categories"
    ON faq_categories FOR SELECT
    USING (true);

CREATE POLICY "Everyone can view FAQ articles"
    ON faq_articles FOR SELECT
    USING (true);

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
    p_notification_id UUID
) RETURNS void AS $$
BEGIN
    UPDATE notifications 
    SET is_read = true 
    WHERE id = p_notification_id
    AND agent_id IN (
        SELECT id 
        FROM agents 
        WHERE email = auth.jwt()->>'email'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification function
CREATE OR REPLACE FUNCTION create_ticket_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assigned_agent_id IS NOT NULL AND OLD.assigned_agent_id IS NULL THEN
        INSERT INTO notifications (agent_id, title, content)
        VALUES (
            NEW.assigned_agent_id,
            'New Ticket Assigned',
            format('You have been assigned ticket: %s', NEW.subject)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification trigger
CREATE TRIGGER ticket_notification_trigger
    AFTER UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_notification();
