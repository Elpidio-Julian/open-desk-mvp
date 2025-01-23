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
        user:user_id (
          id,
          full_name,
          email
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    return { data, error };
  }
}; 