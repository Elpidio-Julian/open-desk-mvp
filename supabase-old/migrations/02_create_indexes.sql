-- Add indexes for columns used in policies
CREATE INDEX idx_users_role ON users USING btree (role);
CREATE INDEX idx_tickets_created_by ON tickets USING btree (created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets USING btree (assigned_to);
CREATE INDEX idx_comments_user_id ON comments USING btree (user_id);
CREATE INDEX idx_comments_ticket_id ON comments USING btree (ticket_id);

-- Add indexes for frequently queried columns
CREATE INDEX idx_tickets_status ON tickets USING btree (status);
CREATE INDEX idx_tickets_priority ON tickets USING btree (priority);
CREATE INDEX idx_users_is_active ON users USING btree (is_active); 