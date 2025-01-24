import { supabase } from '../supabase';

export const customersService = {
  getCustomerDetails: async (customerId) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();
    return { data, error };
  },

  getCustomerTickets: async (customerId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        customer:customer_id (
          id,
          name,
          email
        )
      `)
      .eq('customer_id', customerId);
    return { data, error };
  },

  searchCustomers: async (searchTerm) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .limit(10);
    return { data, error };
  },

  updateCustomerDetails: async (customerId, updates) => {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId);
    return { data, error };
  },

  // Profile operations
  getProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  updateProfile: async (userId, updates) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    return { data, error };
  },

  // Customer-specific ticket operations
  getTickets: async (userId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        created_by:users!tickets_created_by_fkey(full_name, email),
        assigned_to:users!tickets_assigned_to_fkey(full_name, email),
        comments(count)
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  getTicketDetails: async (ticketId, userId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        created_by:users!tickets_created_by_fkey(full_name, email),
        assigned_to:users!tickets_assigned_to_fkey(full_name, email)
      `)
      .eq('id', ticketId)
      .eq('created_by', userId)
      .single();
    return { data, error };
  },

  getTicketComments: async (ticketId) => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        is_internal,
        user:users(id, full_name, email)
      `)
      .eq('ticket_id', ticketId)
      .eq('is_internal', false) // Only non-internal comments for customers
      .order('created_at', { ascending: true });
    return { data, error };
  },

  createTicket: async (ticketData) => {
    const { data, error } = await supabase
      .from('tickets')
      .insert([{
        ...ticketData,
        status: 'open'
      }]);
    return { data, error };
  },

  addComment: async (ticketId, userId, content) => {
    const { data, error } = await supabase
      .from('comments')
      .insert([{
        ticket_id: ticketId,
        user_id: userId,
        content,
        is_internal: false // Customers can't create internal comments
      }]);
    return { data, error };
  }
}; 