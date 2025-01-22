import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { supabase } from '../../services/supabase';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { useDebounce } from '../../hooks/useDebounce';

const FOCUS_AREAS = [
  { value: 'technical', label: 'Technical Support' },
  { value: 'billing', label: 'Billing Support' },
  { value: 'general', label: 'General Support' }
];

const COMMON_SKILLS = [
  'JavaScript', 'Python', 'Database', 'Networking',
  'Security', 'Cloud', 'DevOps', 'Frontend',
  'Backend', 'Mobile', 'API', 'Infrastructure'
];

const ITEMS_PER_PAGE = 10;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

const TeamManagement = () => {
  const [teams, setTeams] = useState([]);
  const [agents, setAgents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', focusArea: '' });
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedAgents, setSelectedAgents] = useState({});
  const [editingTeam, setEditingTeam] = useState(null);
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState(null);
  const [agentCache, setAgentCache] = useState({});
  const [agentPages, setAgentPages] = useState({});
  const [agentSearch, setAgentSearch] = useState('');
  const [agentLoading, setAgentLoading] = useState({});
  const debouncedSearch = useDebounce(agentSearch, 300);

  // Cache management
  const getCachedData = (key) => {
    const cached = agentCache[key];
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      // Cache expired
      delete agentCache[key];
      return null;
    }
    return cached.data;
  };

  const setCachedData = (key, data) => {
    setAgentCache(prev => ({
      ...prev,
      [key]: {
        data,
        timestamp: Date.now()
      }
    }));
  };

  useEffect(() => {
    fetchTeamsAndAgents();
  }, []);

  const fetchTeamsAndAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase.rpc('list_teams');
      if (teamsError) throw new Error('Failed to fetch teams: ' + teamsError.message);

      setTeams(teamsData || []);

      // Initialize pagination state for each team
      const initialPages = {};
      teamsData?.forEach(team => {
        initialPages[team.id] = 1;
      });
      setAgentPages(initialPages);

      // Fetch first page of agents for each team
      await Promise.all((teamsData || []).map(team => fetchAgentsForTeam(team.id, 1)));
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentsForTeam = async (teamId, page = 1, search = '') => {
    try {
      setAgentLoading(prev => ({ ...prev, [teamId]: true }));

      // Check cache first
      const cacheKey = `${teamId}-${page}-${search}`;
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        setAgents(prev => ({
          ...prev,
          [teamId]: cachedData
        }));
        return;
      }

      // Get available agents with pagination and search
      let query = supabase
        .from('users')
        .select('id, full_name, email, role', { count: 'exact' })
        .eq('role', 'agent')
        .order('full_name');

      // Add search if provided
      if (search) {
        query = query.ilike('full_name', `%${search}%`);
      }

      // Get current team members to exclude
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId);

      // Only add the not-in filter if there are team members
      if (teamMembers && teamMembers.length > 0) {
        const memberIds = teamMembers.map(tm => tm.user_id);
        query = query.not('id', 'in', memberIds);
      }

      // Add pagination
      query = query.range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      const { data: availableAgents, error: agentsError, count } = await query;

      if (agentsError) {
        throw new Error(`Failed to fetch agents for team ${teamId}: ${agentsError.message}`);
      }

      // Cache the results
      const resultData = {
        agents: availableAgents || [],
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
      };

      setCachedData(cacheKey, resultData);
      setAgents(prev => ({
        ...prev,
        [teamId]: resultData
      }));
    } catch (err) {
      console.error('Error fetching agents:', err);
      setError(err.message);
    } finally {
      setAgentLoading(prev => ({ ...prev, [teamId]: false }));
    }
  };

  // Debounced search effect
  useEffect(() => {
    if (debouncedSearch !== agentSearch) {
      teams.forEach(team => {
        fetchAgentsForTeam(team.id, 1, debouncedSearch);
      });
    }
  }, [debouncedSearch]);

  const handlePageChange = (teamId, newPage) => {
    setAgentPages(prev => ({ ...prev, [teamId]: newPage }));
    fetchAgentsForTeam(teamId, newPage, agentSearch);
  };

  const createTeam = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('create_team', {
        team_name: newTeam.name,
        team_focus_area: newTeam.focusArea
      });

      if (error) throw error;

      await fetchTeamsAndAgents();
      setNewTeam({ name: '', focusArea: '' });
    } catch (err) {
      console.error('Error creating team:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addMemberToTeam = async (teamId, userId) => {
    try {
      setError(null);
      const { error } = await supabase.rpc('add_team_member', {
        team_id: teamId,
        user_id: userId
      });

      if (error) throw error;
      
      // Clear the selection for this team
      setSelectedAgents(prev => ({ ...prev, [teamId]: '' }));
      
      // Refresh teams and available agents
      await fetchTeamsAndAgents();
      
      // If team details are open, refresh them
      if (selectedTeam?.team.id === teamId) {
        await viewTeamDetails(teamId);
      }
    } catch (err) {
      console.error('Error adding team member:', err);
      setError(err.message);
    }
  };

  const addSkillToTeam = async (teamId, skill) => {
    try {
      setError(null);
      const { error } = await supabase.rpc('add_team_skill', {
        team_id: teamId,
        skill_name: skill
      });

      if (error) throw error;
      await fetchTeamsAndAgents();
    } catch (err) {
      console.error('Error adding skill:', err);
      setError(err.message);
    }
  };

  const viewTeamDetails = async (teamId) => {
    try {
      setError(null);
      const { data, error } = await supabase.rpc('get_team_details', {
        team_id: teamId
      });

      if (error) throw error;
      setSelectedTeam(data);
    } catch (err) {
      console.error('Error fetching team details:', err);
      setError(err.message);
    }
  };

  const updateTeam = async (teamId, updatedData) => {
    try {
      setError(null);
      const { data, error } = await supabase.rpc('update_team', {
        team_id: teamId,
        new_name: updatedData.name,
        new_focus_area: updatedData.focusArea
      });

      if (error) throw error;
      await fetchTeamsAndAgents();
      setEditingTeam(null);
    } catch (err) {
      console.error('Error updating team:', err);
      setError(err.message);
    }
  };

  const deleteTeam = async (teamId) => {
    try {
      setError(null);
      const { error } = await supabase.rpc('delete_team', {
        team_id: teamId
      });

      if (error) throw error;
      await fetchTeamsAndAgents();
      setDeleteConfirmTeam(null);
    } catch (err) {
      console.error('Error deleting team:', err);
      setError(err.message);
    }
  };

  const removeMemberFromTeam = async (teamId, userId) => {
    try {
      setError(null);
      const { error } = await supabase.rpc('remove_team_member', {
        team_id: teamId,
        user_id: userId
      });

      if (error) throw error;
      await fetchTeamsAndAgents();
      if (selectedTeam?.team.id === teamId) {
        await viewTeamDetails(teamId);
      }
    } catch (err) {
      console.error('Error removing team member:', err);
      setError(err.message);
    }
  };

  const removeSkillFromTeam = async (teamId, skill) => {
    try {
      setError(null);
      const { error } = await supabase.rpc('remove_team_skill', {
        team_id: teamId,
        skill_name: skill
      });

      if (error) throw error;
      await fetchTeamsAndAgents();
      if (selectedTeam?.team.id === teamId) {
        await viewTeamDetails(teamId);
      }
    } catch (err) {
      console.error('Error removing skill:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Create Team Form */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Create New Team</h3>
        <div className="flex gap-4">
          <Input
            placeholder="Team Name"
            value={newTeam.name}
            onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
          />
          <Select
            value={newTeam.focusArea}
            onValueChange={(value) => setNewTeam({ ...newTeam, focusArea: value })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Focus Area" />
            </SelectTrigger>
            <SelectContent>
              {FOCUS_AREAS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={createTeam}
            disabled={!newTeam.name || !newTeam.focusArea}
          >
            Create Team
          </Button>
        </div>
      </Card>

      {/* Teams List */}
      <div className="grid gap-4">
        {teams.map((team) => (
          <Card key={team.id} className="p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-semibold">{team.name}</h4>
                <p className="text-sm text-muted-foreground capitalize">
                  {team.focus_area.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="text-sm text-muted-foreground text-right">
                  <p>{team.member_count} members</p>
                  <p>{team.skill_count} skills</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingTeam(team)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirmTeam(team)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Add Member */}
            <div className="space-y-2 mb-2">
              <Input
                placeholder="Search agents..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="w-full"
              />
              <div className="flex gap-2">
                <Select
                  value={selectedAgents[team.id] || ''}
                  onValueChange={(value) => setSelectedAgents(prev => ({ ...prev, [team.id]: value }))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Add Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentLoading[team.id] ? (
                      <SelectItem value="" disabled>
                        Loading...
                      </SelectItem>
                    ) : agents[team.id]?.agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedAgents[team.id]) {
                      addMemberToTeam(team.id, selectedAgents[team.id]);
                    }
                  }}
                  disabled={!selectedAgents[team.id] || agentLoading[team.id]}
                >
                  Add
                </Button>
              </div>
              {agents[team.id]?.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(team.id, agentPages[team.id] - 1)}
                    disabled={agentPages[team.id] === 1 || agentLoading[team.id]}
                  >
                    Previous
                  </Button>
                  <span className="py-1">
                    Page {agentPages[team.id]} of {agents[team.id]?.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(team.id, agentPages[team.id] + 1)}
                    disabled={agentPages[team.id] === agents[team.id]?.totalPages || agentLoading[team.id]}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>

            {/* Add Skill */}
            <div className="flex gap-2">
              <Select
                value={selectedSkill}
                onValueChange={setSelectedSkill}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Add Skill" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SKILLS.map((skill) => (
                    <SelectItem key={skill} value={skill}>
                      {skill}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedSkill) {
                    addSkillToTeam(team.id, selectedSkill);
                    setSelectedSkill('');
                  }
                }}
                disabled={!selectedSkill}
              >
                Add
              </Button>
            </div>

            <Button
              variant="link"
              onClick={() => viewTeamDetails(team.id)}
              className="mt-2"
            >
              View Details
            </Button>
          </Card>
        ))}
      </div>

      {/* Selected Team Details */}
      {selectedTeam && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{selectedTeam.team.name} Details</h3>
            <Button variant="ghost" onClick={() => setSelectedTeam(null)}>Close</Button>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Members</h4>
              <div className="space-y-2">
                {selectedTeam.members?.map((member) => (
                  <div key={member.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMemberFromTeam(selectedTeam.team.id, member.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Skills</h4>
              <div className="flex flex-wrap gap-2">
                {selectedTeam.skills?.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {skill}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => removeSkillFromTeam(selectedTeam.team.id, skill)}
                    >
                      ×
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Edit Team Dialog */}
      <Dialog open={!!editingTeam} onOpenChange={() => setEditingTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update the team's name and focus area.
            </DialogDescription>
          </DialogHeader>
          {editingTeam && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Input
                  placeholder="Team Name"
                  value={editingTeam.name}
                  onChange={(e) =>
                    setEditingTeam({ ...editingTeam, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Select
                  value={editingTeam.focus_area}
                  onValueChange={(value) =>
                    setEditingTeam({ ...editingTeam, focus_area: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Focus Area" />
                  </SelectTrigger>
                  <SelectContent>
                    {FOCUS_AREAS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTeam(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                updateTeam(editingTeam.id, {
                  name: editingTeam.name,
                  focusArea: editingTeam.focus_area,
                })
              }
              disabled={!editingTeam?.name || !editingTeam?.focus_area}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmTeam} onOpenChange={() => setDeleteConfirmTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteConfirmTeam?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmTeam(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTeam(deleteConfirmTeam.id)}
            >
              Delete Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamManagement; 