import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { PlusCircle, X, Search, ChevronDown, ChevronUp } from "lucide-react";
import { routingService } from '../../services/api/routing';
import { supabase } from '../../services/supabase';
import RoutingStats from './RoutingStats';

export default function RoutingSettings() {
  const [rules, setRules] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [agentSkills, setAgentSkills] = useState([]);
  const [newSkill, setNewSkill] = useState({
    category: '',
    skill_name: '',
    proficiency_level: 1
  });
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    conditions: { priority: null, tags: [], custom_fields: {} },
    target_skills: { required: [] },
    weight: 1,
    is_active: true
  });
  const [alert, setAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRuleId, setExpandedRuleId] = useState(null);

  useEffect(() => {
    loadRoutingRules();
    loadAgents();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      loadAgentSkills(selectedAgent);
    }
  }, [selectedAgent]);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'agent')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      setAlert({ variant: 'destructive', message: 'Failed to load agents' });
    }
  };

  const loadRoutingRules = async () => {
    try {
      const data = await routingService.getRoutingRules();
      setRules(data);
    } catch (error) {
      setAlert({ variant: 'destructive', message: 'Failed to load routing rules' });
    }
  };

  const loadAgentSkills = async (agentId) => {
    try {
      const data = await routingService.getAgentSkills(agentId);
      setAgentSkills(data);
    } catch (error) {
      setAlert({ variant: 'destructive', message: 'Failed to load agent skills' });
    }
  };

  const handleAddSkill = async () => {
    try {
      await routingService.updateAgentSkills(selectedAgent, [...agentSkills, newSkill]);
      setAgentSkills([...agentSkills, newSkill]);
      setNewSkill({ category: '', skill_name: '', proficiency_level: 1 });
      setAlert({ variant: 'default', message: 'Skill added successfully' });
    } catch (error) {
      setAlert({ variant: 'destructive', message: 'Failed to add skill' });
    }
  };

  const handleRemoveSkill = async (skillToRemove) => {
    try {
      const updatedSkills = agentSkills.filter(skill => 
        skill.category !== skillToRemove.category || 
        skill.skill_name !== skillToRemove.skill_name
      );
      await routingService.updateAgentSkills(selectedAgent, updatedSkills);
      setAgentSkills(updatedSkills);
      setAlert({ variant: 'default', message: 'Skill removed successfully' });
    } catch (error) {
      setAlert({ variant: 'destructive', message: 'Failed to remove skill' });
    }
  };

  const handleUpdateRule = async (ruleId, updates) => {
    try {
      // Find the existing rule
      const existingRule = rules.find(r => r.id === ruleId);
      if (!existingRule) return;

      // Merge updates with existing rule data
      const updatedRule = {
        ...existingRule,
        ...updates,
        conditions: {
          ...existingRule.conditions,
          ...(updates.conditions || {})
        }
      };

      await routingService.upsertRoutingRule(updatedRule);
      loadRoutingRules();
      setAlert({ variant: 'default', message: 'Rule updated successfully' });
    } catch (error) {
      setAlert({ variant: 'destructive', message: 'Failed to update rule' });
    }
  };

  const handleCreateRule = async () => {
    try {
      await routingService.upsertRoutingRule(newRule);
      setNewRule({
        name: '',
        description: '',
        conditions: { priority: null, tags: [], custom_fields: {} },
        target_skills: { required: [] },
        weight: 1,
        is_active: true
      });
      loadRoutingRules();
      setAlert({ variant: 'default', message: 'Rule created successfully' });
    } catch (error) {
      setAlert({ variant: 'destructive', message: 'Failed to create rule' });
    }
  };

  const toggleRule = (ruleId) => {
    setExpandedRuleId(expandedRuleId === ruleId ? null : ruleId);
  };

  const filteredRules = rules.filter(rule => 
    rule.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {alert && (
        <Alert variant={alert.variant} className="mb-4">
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      {/* Add Statistics Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Routing Statistics</h3>
        <RoutingStats />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Agent Skills Section */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Agent Skills</h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name} ({agent.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedAgent && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select 
                      value={newSkill.category}
                      onValueChange={(value) => setNewSkill({
                        ...newSkill,
                        category: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Skill Name</Label>
                    <Input
                      value={newSkill.skill_name}
                      onChange={(e) => setNewSkill({
                        ...newSkill,
                        skill_name: e.target.value
                      })}
                      placeholder="Enter skill name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Proficiency</Label>
                    <Select
                      value={newSkill.proficiency_level.toString()}
                      onValueChange={(value) => setNewSkill({
                        ...newSkill,
                        proficiency_level: parseInt(value)
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(level => (
                          <SelectItem key={level} value={level.toString()}>
                            Level {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleAddSkill}
                  className="w-full md:w-auto"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Skill
                </Button>

                <div className="flex flex-wrap gap-2 mt-4">
                  {agentSkills.map((skill, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-2"
                    >
                      {skill.category}: {skill.skill_name} (Level {skill.proficiency_level})
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() => handleRemoveSkill(skill)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Routing Rules Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Routing Rules</h3>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* New Rule Form */}
            <Card className="p-4 border">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>New Rule Name</Label>
                  <Input
                    value={newRule.name}
                    onChange={(e) => setNewRule({
                      ...newRule,
                      name: e.target.value
                    })}
                    placeholder="Enter rule name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newRule.description}
                    onChange={(e) => setNewRule({
                      ...newRule,
                      description: e.target.value
                    })}
                    placeholder="Enter rule description"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={newRule.conditions.priority || ''}
                      onValueChange={(value) => setNewRule({
                        ...newRule,
                        conditions: {
                          ...newRule.conditions,
                          priority: value
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Weight</Label>
                    <Select
                      value={newRule.weight.toString()}
                      onValueChange={(value) => setNewRule({
                        ...newRule,
                        weight: parseInt(value)
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(weight => (
                          <SelectItem key={weight} value={weight.toString()}>
                            {weight}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleCreateRule}
                  className="w-full"
                >
                  Create Rule
                </Button>
              </div>
            </Card>

            {/* Existing Rules List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredRules.map((rule) => (
                <Card 
                  key={rule.id} 
                  className={`border p-2 transition-all hover:bg-accent ${expandedRuleId === rule.id ? 'bg-muted' : ''}`}
                >
                  <div 
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => toggleRule(rule.id)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedRuleId === rule.id ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{rule.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.is_active ? "default" : "secondary"}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateRule(rule.id, { is_active: !rule.is_active });
                        }}
                      >
                        {rule.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                  {expandedRuleId === rule.id && (
                    <div className="mt-2 pt-2 border-t space-y-4">
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={rule.description}
                          onChange={(e) => handleUpdateRule(rule.id, { description: e.target.value })}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select
                            value={rule.conditions?.priority || ''}
                            onValueChange={(value) => handleUpdateRule(rule.id, {
                              conditions: {
                                ...rule.conditions,
                                priority: value
                              }
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Weight</Label>
                          <Select
                            value={rule.weight.toString()}
                            onValueChange={(value) => handleUpdateRule(rule.id, { weight: parseInt(value) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map(weight => (
                                <SelectItem key={weight} value={weight.toString()}>
                                  {weight}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
              {filteredRules.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No rules found matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
} 