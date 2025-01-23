import { supabase } from '../supabase';

export const ticketsService = {
  // Create operations
  create: async (ticketData) => {
    const { data, error } = await supabase
      .from('tickets')
      .insert([{
        ...ticketData,
        status: 'open'
      }]);
    return { data, error };
  },

  // Read operations
  getTickets: async ({ view, status, priority, userId }) => {
    let query = supabase
      .from('tickets')
      .select(`
        *,
        created_by:users!tickets_created_by_fkey(full_name, email),
        assigned_to:users!tickets_assigned_to_fkey(full_name, email),
        comments(count)
      `);

    // Apply view filters
    switch (view) {
      case 'unassigned':
        query = query.is('assigned_to', null);
        break;
      case 'my_tickets':
        query = query.eq('assigned_to', userId);
        break;
      case 'urgent':
        query = query.eq('priority', 'urgent');
        break;
    }

    // Apply status and priority filters
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);

    // Apply sorting
    query = query.order('priority', { ascending: false })
                .order('created_at', { ascending: false });

    const { data, error } = await query;
    return { data, error };
  },

  getByUser: async (userId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('created_by', userId);
    return { data, error };
  },

  getAssigned: async (agentId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('assigned_to', agentId);
    return { data, error };
  },

  getTicketDetails: async (ticketId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        created_by:users!tickets_created_by_fkey(id, full_name, email),
        assigned_to:users!tickets_assigned_to_fkey(id, full_name, email)
      `)
      .eq('id', ticketId)
      .single();
    return { data, error };
  },

  getCustomerHistory: async (customerId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        title,
        status,
        priority,
        created_at,
        resolved_at
      `)
      .eq('created_by', customerId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // Update operations
  updateTicket: async (ticketId, updates) => {
    const { data, error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticketId);
    return { data, error };
  },

  // Bulk operations
  bulkAssign: async (ticketIds, agentId) => {
    const { data, error } = await supabase
      .from('tickets')
      .update({ assigned_to: agentId })
      .in('id', ticketIds);
    return { data, error };
  },

  bulkUpdateStatus: async (ticketIds, status) => {
    const { data, error } = await supabase
      .from('tickets')
      .update({ status })
      .in('id', ticketIds);
    return { data, error };
  },

  // Comment operations
  addComment: async (ticketId, userId, content, isInternal = false) => {
    const { data, error } = await supabase
      .from('comments')
      .insert([{
        ticket_id: ticketId,
        user_id: userId,
        content,
        is_internal: isInternal
      }]);
    return { data, error };
  },

  getComments: async (ticketId) => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:users(full_name, email)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    return { data, error };
  }
}; 