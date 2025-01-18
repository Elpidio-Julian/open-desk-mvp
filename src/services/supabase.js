import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const auth = {
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },
};

export const tickets = {
  create: async (ticketData) => {
    const { data, error } = await supabase
      .from('tickets')
      .insert([ticketData]);
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
}; 