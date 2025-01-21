-- Enable RLS on new tables
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;

-- Tags policies
CREATE POLICY "Everyone can view tags"
    ON tags FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Agents can manage tags"
    ON tags FOR ALL
    USING (check_user_role(auth.uid(), ARRAY['admin', 'agent']))
    WITH CHECK (check_user_role(auth.uid(), ARRAY['admin', 'agent']));

-- Custom fields policies
CREATE POLICY "Everyone can view custom fields"
    ON custom_field_definitions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Agents can manage custom fields"
    ON custom_field_definitions FOR ALL
    USING (check_user_role(auth.uid(), ARRAY['admin', 'agent']))
    WITH CHECK (check_user_role(auth.uid(), ARRAY['admin', 'agent']));

-- Ticket tags policies
CREATE POLICY "Users can view ticket tags for their tickets"
    ON ticket_tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tickets
            WHERE tickets.id = ticket_tags.ticket_id
            AND (tickets.created_by = auth.uid() OR tickets.assigned_to = auth.uid())
        )
    );

CREATE POLICY "Agents can view all ticket tags"
    ON ticket_tags FOR SELECT
    USING (check_user_role(auth.uid(), ARRAY['admin', 'agent']));

CREATE POLICY "Agents can manage ticket tags"
    ON ticket_tags FOR ALL
    USING (check_user_role(auth.uid(), ARRAY['admin', 'agent']))
    WITH CHECK (check_user_role(auth.uid(), ARRAY['admin', 'agent']));

-- Ticket history policies
CREATE POLICY "Users can view history of their tickets"
    ON ticket_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tickets
            WHERE tickets.id = ticket_history.ticket_id
            AND (tickets.created_by = auth.uid() OR tickets.assigned_to = auth.uid())
        )
    );

CREATE POLICY "Agents can view all ticket history"
    ON ticket_history FOR SELECT
    USING (check_user_role(auth.uid(), ARRAY['admin', 'agent']));

-- Ticket history is insert-only and managed by triggers
CREATE POLICY "System can create ticket history"
    ON ticket_history FOR INSERT
    WITH CHECK (auth.uid() = user_id); 