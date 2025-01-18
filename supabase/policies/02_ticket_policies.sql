-- Tickets policies
CREATE POLICY "Users can view their own tickets"
    ON tickets FOR SELECT
    USING (created_by = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Agents can view all tickets"
    ON tickets FOR SELECT
    USING (check_user_role(auth.uid(), ARRAY['admin', 'agent']));

CREATE POLICY "Users can create tickets"
    ON tickets FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Agents can update tickets"
    ON tickets FOR UPDATE
    USING (check_user_role(auth.uid(), ARRAY['admin', 'agent'])); 