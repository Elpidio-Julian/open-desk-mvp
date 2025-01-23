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
  }
}; 