-- Comments policies
CREATE POLICY "Users can view comments on their tickets"
    ON comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tickets
            WHERE tickets.id = comments.ticket_id
            AND (tickets.created_by = auth.uid() OR tickets.assigned_to = auth.uid())
        )
    );

CREATE POLICY "Agents can view all comments"
    ON comments FOR SELECT
    USING (check_user_role(auth.uid(), ARRAY['admin', 'agent']));

CREATE POLICY "Users can create comments"
    ON comments FOR INSERT
    WITH CHECK (auth.uid() = user_id); 