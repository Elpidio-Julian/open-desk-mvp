import { supabase } from '../supabase';
import { routingService } from './routing';

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
      .eq('is_internal', false); // Only non-internal comments for customers
    return { data, error };
  },

  async isIssueCategoryEnabled() {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('name', 'Issue Category')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking issue category status:', error);
      return false;
    }
  },

  async getIssueCategories() {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('options')
        .eq('name', 'Issue Category')
        .single();

      if (error) throw error;
      return data?.options || [];
    } catch (error) {
      console.error('Error fetching issue categories:', error);
      return [];
    }
  },

  async createTicket(ticketData) {
    try {
      const isCategoryEnabled = await this.isIssueCategoryEnabled();
      
      if (isCategoryEnabled && !ticketData.custom_fields?.['Issue Category']) {
        throw new Error('Issue Category is required');
      }

      const { data, error } = await supabase
        .from('tickets')
        .insert([{
          ...ticketData,
          status: 'open',
          custom_fields: {
            ...ticketData.custom_fields,
          }
        }])
        .select()
        .single();

      if (error) throw error;
      return { data };
    } catch (error) {
      return { error: error.message };
    }
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
  },

  updateTicket: async (ticketId, updates) => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .update(updates)
        .match({ id: ticketId })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}; 