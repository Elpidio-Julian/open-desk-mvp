-- Create notification type enum
CREATE TYPE notification_type AS ENUM ('ticket_assigned', 'ticket_updated', 'ticket_commented', 'mention');

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    reference_id UUID, -- Can be ticket_id, comment_id etc.
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- Create function to create notification on ticket assignment
CREATE OR REPLACE FUNCTION create_assignment_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create notification if this is a new assignment or assignment changed
    IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL) 
    OR (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) THEN
        INSERT INTO notifications (user_id, type, title, content, reference_id)
        VALUES (
            NEW.assigned_to,
            'ticket_assigned',
            'New Ticket Assigned',
            'You have been assigned ticket: ' || NEW.title,
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for ticket assignments
CREATE TRIGGER on_ticket_assignment_notification
    AFTER INSERT OR UPDATE OF assigned_to ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION create_assignment_notification();

-- Add RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- System can create notifications
CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (true); 