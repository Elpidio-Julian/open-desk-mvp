import { supabase } from '../supabase';

export const teamsService = {
  // Team operations
  listTeams: async () => {
    const { data, error } = await supabase.rpc('list_teams');
    return { data, error };
  },

  createTeam: async ({ name, focusArea }) => {
    const { data, error } = await supabase.rpc('create_team', {
      team_name: name,
      team_focus_area: focusArea
    });
    return { data, error };
  },

  updateTeam: async (teamId, { name, focusArea }) => {
    const { data, error } = await supabase.rpc('update_team', {
      team_id: teamId,
      new_name: name,
      new_focus_area: focusArea
    });
    return { data, error };
  },

  deleteTeam: async (teamId) => {
    const { data, error } = await supabase.rpc('delete_team', {
      team_id: teamId
    });
    return { data, error };
  },

  getTeamDetails: async (teamId) => {
    const { data, error } = await supabase.rpc('get_team_details', {
      team_id: teamId
    });
    return { data, error };
  },

  // Team member operations
  getTeamMembers: async (teamId) => {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        profiles:user_id (*)
      `)
      .eq('team_id', teamId);
    return { data, error };
  },

  addTeamMember: async (teamId, userId) => {
    const { data, error } = await supabase.rpc('add_team_member', {
      team_id: teamId,
      user_id: userId
    });
    return { data, error };
  },

  removeTeamMember: async (teamId, userId) => {
    const { data, error } = await supabase.rpc('remove_team_member', {
      team_id: teamId,
      user_id: userId
    });
    return { data, error };
  },

  // Team skills operations
  addTeamSkill: async (teamId, skillName) => {
    const { data, error } = await supabase.rpc('add_team_skill', {
      team_id: teamId,
      skill_name: skillName
    });
    return { data, error };
  },

  removeTeamSkill: async (teamId, skillName) => {
    const { data, error } = await supabase.rpc('remove_team_skill', {
      team_id: teamId,
      skill_name: skillName
    });
    return { data, error };
  },

  // Agent operations for teams
  getAvailableAgents: async (teamId, search = '') => {
    // First get team members to exclude
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);

    // Build the query
    let query = supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('role', 'agent')
      .order('full_name');

    // Add search filter if provided
    if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }

    // Add exclusion filter if there are team members
    if (teamMembers && teamMembers.length > 0) {
      const memberIds = teamMembers.map(tm => tm.user_id);
      query = query.not('id', 'in', `(${memberIds.join(',')})`);
    }

    // Execute query
    const { data, error } = await query;
    return { data, error, count: data?.length || 0 };
  }
}; 