import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
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
import { teamsService } from '../../services/api/teams';
import { customFieldsService } from '../../services/api/customFields';

const COMMON_SKILLS = [
  'JavaScript', 'Python', 'Database', 'Networking',
  'Security', 'Cloud', 'DevOps', 'Frontend',
  'Backend', 'Mobile', 'API', 'Infrastructure'
];

const TeamManagement = () => {
  const [teams, setTeams] = useState([]);
  const [focusAreas, setFocusAreas] = useState([]);
  const [agents, setAgents] = useState({});
  const [selectedAgents, setSelectedAgents] = useState({});
  const [loading, setLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState({});
  const [error, setError] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', focusArea: '' });
  const [editingTeam, setEditingTeam] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState(null);
  const [selectedSkills, setSelectedSkills] = useState({});

  useEffect(() => {
    fetchTeamsAndAgents();
    fetchFocusAreas();
  }, []);

  const fetchFocusAreas = async () => {
    try {
      const { data: field, error } = await customFieldsService.getFieldByName('Focus Areas');
      if (error && error.code !== 'PGRST116') throw error;
      
      if (field?.options && Object.keys(field.options).length > 0) {
      // Convert options object to array of { value, label } pairs
      const areas = Object.entries(field.options).map(([key, value]) => ({
        value: key,
        label: value
      }));
      setFocusAreas(areas);
      } else {
        // If no focus areas are set, clear the array
        setFocusAreas([]);
      }
    } catch (err) {
      console.error('Error fetching focus areas:', err);
      setFocusAreas([]); // Clear focus areas on error
      setError(err.message);
    }
  };

  const fetchTeamsAndAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: teamsData, error: teamsError } = await teamsService.listTeams();
      if (teamsError) throw new Error('Failed to fetch teams: ' + teamsError.message);

      setTeams(teamsData || []);

      // Fetch available agents for each team
      await Promise.all((teamsData || []).map(team => fetchAgentsForTeam(team.id)));
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentsForTeam = async (teamId, search = '') => {
    try {
      setAgentLoading(prev => ({ ...prev, [teamId]: true }));

      const { data: availableAgents, error: agentsError, count } = 
        await teamsService.getAvailableAgents(teamId, search);

      if (agentsError) throw agentsError;

      setAgents(prev => ({
        ...prev,
        [teamId]: {
          items: availableAgents || [],
          totalCount: count || 0
        }
      }));
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError(error.message);
    } finally {
      setAgentLoading(prev => ({ ...prev, [teamId]: false }));
    }
  };

  const createTeam = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the focus area value and label
      let focusAreaValue = 'general';
      let focusAreaLabel = 'General Support';

      if (focusAreas.length > 0 && newTeam.focusArea) {
        const selectedArea = focusAreas.find(area => area.value === newTeam.focusArea);
        focusAreaValue = selectedArea.value;
        focusAreaLabel = selectedArea.label;
      }

      const teamData = {
        name: newTeam.name,
        metadata: {
          focus_area: {
            value: focusAreaValue,
            label: focusAreaLabel
          }
        }
      };

      const { error } = await teamsService.createTeam(teamData);
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

  const addMemberToTeam = async (teamId, profileId) => {
    try {
      setError(null);
      const { error } = await teamsService.addTeamMember(teamId, profileId);
      if (error) throw error;
      
      setSelectedAgents(prev => ({ ...prev, [teamId]: '' }));
      await fetchTeamsAndAgents();
      
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
      const { error } = await teamsService.addTeamSkill(teamId, skill);
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
      const { data, error } = await teamsService.getTeamDetails(teamId);
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

      // Get the focus area value and label
      let focusAreaValue = 'general';
      let focusAreaLabel = 'General Support';

      if (focusAreas.length > 0 && updatedData.focusArea) {
        const selectedArea = focusAreas.find(area => area.value === updatedData.focusArea);
        focusAreaValue = selectedArea.value;
        focusAreaLabel = selectedArea.label;
      }

      const teamData = {
        name: updatedData.name,
        metadata: {
          focus_area: {
            value: focusAreaValue,
            label: focusAreaLabel
          }
        }
      };

      const { error } = await teamsService.updateTeam(teamId, teamData);
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
      const { error } = await teamsService.deleteTeam(teamId);
      if (error) throw error;
      await fetchTeamsAndAgents();
      setDeleteConfirmTeam(null);
    } catch (err) {
      console.error('Error deleting team:', err);
      setError(err.message);
    }
  };

  const removeMemberFromTeam = async (teamId, profileId) => {
    try {
      setError(null);
      const { error } = await teamsService.removeTeamMember(teamId, profileId);
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
      const { error } = await teamsService.removeTeamSkill(teamId, skill);
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
          {focusAreas.length > 0 && (
            <Select
              value={newTeam.focusArea}
              onValueChange={(value) => setNewTeam({ ...newTeam, focusArea: value })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Focus Area" />
              </SelectTrigger>
              <SelectContent>
                {focusAreas.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={createTeam}
            disabled={!newTeam.name || (focusAreas.length > 0 && !newTeam.focusArea)}
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
                {team.metadata?.focus_area && (
                  <p className="text-sm text-muted-foreground capitalize">
                    {team.metadata.focus_area.label}
                  </p>
                )}
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
                    ) : agents[team.id]?.items.map((agent) => (
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
            </div>

            {/* Add Skill */}
            <div className="flex gap-2">
              <Select
                value={selectedSkills[team.id] || ''}
                onValueChange={(value) => setSelectedSkills(prev => ({ ...prev, [team.id]: value }))}
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
                  if (selectedSkills[team.id]) {
                    addSkillToTeam(team.id, selectedSkills[team.id]);
                    setSelectedSkills(prev => ({ ...prev, [team.id]: '' }));
                  }
                }}
                disabled={!selectedSkills[team.id]}
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
                      <p className="font-medium">{member.profile.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.profile.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMemberFromTeam(selectedTeam.team.id, member.profile.id)}
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
              {focusAreas.length > 0 
                ? "Update the team's name and focus area."
                : "Update the team's name."
              }
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
              {focusAreas.length > 0 && (
                <div className="space-y-2">
                  <Select
                    value={editingTeam.metadata?.focus_area?.value}
                    onValueChange={(value) =>
                      setEditingTeam({
                        ...editingTeam,
                        focusArea: value
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Focus Area" />
                    </SelectTrigger>
                    <SelectContent>
                      {focusAreas.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                  focusArea: editingTeam.metadata?.focus_area?.value || editingTeam.focusArea
                })
              }
              disabled={!editingTeam?.name || (focusAreas.length > 0 && !editingTeam?.metadata?.focus_area?.value && !editingTeam?.focusArea)}
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