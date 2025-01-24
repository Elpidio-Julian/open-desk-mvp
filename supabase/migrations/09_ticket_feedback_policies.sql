-- Enable RLS on tickets table if not already enabled
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Add feedback columns if they don't exist
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS feedback_rating INTEGER,
ADD COLUMN IF NOT EXISTS feedback_comment TEXT; 

-- Allow customers to update their own tickets (for feedback and resolving)
CREATE POLICY "Users can update their own tickets"
ON tickets
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (
  auth.uid() = created_by 
  AND (
    -- Only allow updating specific fields
    (
      -- For resolving tickets
      status = 'resolved' 
      AND EXISTS (
        SELECT 1 FROM tickets t 
        WHERE t.id = tickets.id 
        AND t.status NOT IN ('resolved', 'closed')
      )
    ) OR (
      -- For providing feedback
      status = 'closed' 
      AND EXISTS (
        SELECT 1 FROM tickets t 
        WHERE t.id = tickets.id 
        AND t.status = 'resolved'
      )
      AND feedback_rating IS NOT NULL
    )
  )
);

