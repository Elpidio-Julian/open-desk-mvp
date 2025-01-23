import { supabase } from '../supabase';

export const analyticsService = {
  getAllAgents: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'agent');
    return { data, error };
  },

  getAgentActiveTickets: async (agentId, timePeriod) => {
    const { data, error } = await supabase.rpc('get_agent_active_tickets', {
      agent_id: agentId,
      time_period: timePeriod
    });
    return { data: data?.[0], error };
  },

  getAgentResponseMetrics: async (agentId, timePeriod) => {
    const { data, error } = await supabase.rpc('get_agent_response_metrics', {
      agent_id: agentId,
      time_period: timePeriod
    });
    return { data: data?.[0], error };
  },

  getAgentResolutionMetrics: async (agentId, timePeriod) => {
    const { data, error } = await supabase.rpc('get_agent_resolution_metrics', {
      agent_id: agentId,
      time_period: timePeriod
    });
    return { data: data?.[0], error };
  },

  // Helper method to get all metrics for an agent
  getAllAgentMetrics: async (agentId, timePeriod) => {
    try {
      const [activeTickets, response, resolution] = await Promise.all([
        analyticsService.getAgentActiveTickets(agentId, timePeriod),
        analyticsService.getAgentResponseMetrics(agentId, timePeriod),
        analyticsService.getAgentResolutionMetrics(agentId, timePeriod)
      ]);

      return {
        data: {
          activeTickets: activeTickets.data || { total_active: 0, by_status: {} },
          response: response.data || { avg_first_response: 0, avg_response_time: 0, response_time_trend: [] },
          resolution: resolution.data || { total_resolved: 0, avg_resolution_time: 0, resolution_rate: 0, resolution_trend: [] }
        },
        error: activeTickets.error || response.error || resolution.error
      };
    } catch (error) {
      return { data: null, error };
    }
  }
}; 