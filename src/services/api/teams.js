import { supabase } from '../supabase';

export const teamsService = {
  // Team operations
  listTeams: async () => {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        agents:agents(*)
      `)
      .order('name');
    
    if (data) {
      // Transform data to include counts
      data.forEach(team => {
        team.member_count = team.agents?.length || 0;
        team.skill_count = team.skills?.length || 0;
      });
    }

    return { data, error };
  },

  createTeam: async ({ name, metadata }) => {
    const { data, error } = await supabase
      .from('teams')
      .insert({
        name,
        metadata
      })
      .select()
      .single();

    return { data, error };
  },

  updateTeam: async (teamId, { name, metadata }) => {
    // Get current team data first
    const { data: currentTeam } = await supabase
      .from('teams')
      .select('metadata')
      .eq('id', teamId)
      .single();

    // Prepare update data
    const updateData = {
      name,
      metadata: {
        ...(currentTeam?.metadata || {}),
        ...metadata
      }
    };

    const { data, error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', teamId)
      .select()
      .single();

    return { data, error };
  },

  deleteTeam: async (teamId) => {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    return { error };
  },

  getTeamDetails: async (teamId) => {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        agents:agents(
          id,
          profile:profile_id(
            id,
            full_name,
            email,
            role
          )
        )
      `)
      .eq('id', teamId)
      .single();

    if (data) {
      return {
        data: {
          team: {
            id: data.id,
            name: data.name,
            metadata: data.metadata
          },
          members: data.agents?.map(agent => ({
            id: agent.id,
            profile: agent.profile
          })) || [],
          skills: data.skills || []
        },
        error: null
      };
    }

    return { data: null, error };
  },

  // Team member operations
  getTeamMembers: async (teamId) => {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        *,
        profile:profile_id (
          id,
          full_name,
          email,
          role
        )
      `)
      .eq('team_id', teamId);
    return { data, error };
  },

  addTeamMember: async (teamId, profileId) => {
    const { data, error } = await supabase
      .from('agents')
      .insert({
        team_id: teamId,
        profile_id: profileId
      })
      .select()
      .single();
    return { data, error };
  },

  removeTeamMember: async (teamId, profileId) => {
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('team_id', teamId)
      .eq('profile_id', profileId);
    return { error };
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
    // First get the list of profile IDs already in the team
    const { data: existingMembers } = await supabase
      .from('agents')
      .select('profile_id')
      .eq('team_id', teamId);

    const existingIds = existingMembers?.map(m => m.profile_id) || [];

    // Then get all eligible profiles not in the team
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['agent', 'admin']);

    if (existingIds.length > 0) {
      query = query.not('id', 'in', existingIds);
    }

    // Add search filter if provided
    if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }

    query = query.order('full_name');

    const { data, error } = await query;
    return { data, error, count: data?.length || 0 };
  }
}; 