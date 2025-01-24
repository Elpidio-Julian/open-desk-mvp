-- Add RLS policy for users to update their own notifications
CREATE POLICY "Users can update their own notifications"
    ON notifications 
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add RLS policy for users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
    ON notifications 
    FOR DELETE
    USING (auth.uid() = user_id); 