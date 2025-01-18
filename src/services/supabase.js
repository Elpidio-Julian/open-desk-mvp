import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a single instance of the Supabase client
let supabaseInstance = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();

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