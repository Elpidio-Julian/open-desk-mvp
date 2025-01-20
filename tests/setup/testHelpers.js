import { supabase } from './testSetup'

// Helper to create a test ticket
export async function createTestTicket(data = {}) {
  const defaultTicket = {
    title: 'Test Ticket',
    description: 'Test Description',
    status: 'open',
    priority: 'medium',
    created_by: 'test-user',
    ...data
  }
  
  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert(defaultTicket)
    .select()
    .single()
    
  if (error) throw error
  return ticket
}

// Helper to cleanup test tickets
export async function cleanupTestTickets() {
  const { error } = await supabase
    .from('tickets')
    .delete()
    .match({ created_by: 'test-user' })
    
  if (error) throw error
}

// Helper to create a test comment
export async function createTestComment(ticketId, data = {}) {
  const defaultComment = {
    ticket_id: ticketId,
    content: 'Test Comment',
    created_by: 'test-user',
    ...data
  }
  
  const { data: comment, error } = await supabase
    .from('comments')
    .insert(defaultComment)
    .select()
    .single()
    
  if (error) throw error
  return comment
} 