-- Create notification type enum
CREATE TYPE notification_type AS ENUM ('ticket_assigned', 'ticket_updated', 'ticket_commented', 'mention');

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    reference_id UUID, -- Can be ticket_id, comment_id etc.
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (for marking as read)
CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- System can create notifications
CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Create function to create notification on ticket assignment
CREATE OR REPLACE FUNCTION create_assignment_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create notification if this is a new assignment or assignment changed
    IF (TG_OP = 'UPDATE' AND OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id AND NEW.assigned_agent_id IS NOT NULL) 
    OR (TG_OP = 'INSERT' AND NEW.assigned_agent_id IS NOT NULL) THEN
        INSERT INTO notifications (
            user_id,
            type,
            title,
            content,
            reference_id
        )
        SELECT
            p.id,
            'ticket_assigned',
            'New Ticket Assigned',
            'You have been assigned ticket: ' || NEW.title,
            NEW.id
        FROM profiles p
        WHERE p.id = (
            SELECT profile_id 
            FROM agents 
            WHERE id = NEW.assigned_agent_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for ticket assignments
CREATE TRIGGER on_ticket_assignment_notification
    AFTER INSERT OR UPDATE OF assigned_agent_id ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION create_assignment_notification(); 