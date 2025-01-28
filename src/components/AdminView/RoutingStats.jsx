import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { customFieldsService } from '../../services/api/customFields';

export default function RoutingStats() {
  const [stats, setStats] = useState({
    total: 0,
    autoAssigned: 0,
    ruleMatches: [],
    agentAssignments: [],
    avgAssignmentTime: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteRuleId, setDeleteRuleId] = useState(null);
  const [expandedRuleId, setExpandedRuleId] = useState(null);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const formatDuration = (milliseconds) => {
    if (!milliseconds || isNaN(milliseconds)) return '0h 0m';
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const loadStats = async () => {
    try {
      // Get tickets from last 30 days
      const { data: ticketStats, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          id, 
          metadata,
          assigned_agent_id,
          created_at
        `)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (ticketError) throw ticketError;

      // Handle no tickets case
      if (!ticketStats || ticketStats.length === 0) {
        setStats({
          total: 0,
          autoAssigned: 0,
          ruleMatches: [],
          agentAssignments: [],
          avgAssignmentTime: 0
        });
        return;
      }

      // Get rules data
      const { data: rules, error: rulesError } = await customFieldsService.getRoutingRules();
      if (rulesError && rulesError.code !== 'PGRST116') throw rulesError;

      // Get agents data
      const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select(`
          id,
          profile:profile_id (
            id,
            full_name
          )
        `);

      if (agentsError) throw agentsError;

      // Calculate statistics
      const total = ticketStats.length;
      const autoAssigned = ticketStats.filter(t => t.metadata?.auto_assigned === true).length;

      // Calculate rule matches - now using metadata.rule_name
      const ruleMatchCounts = {};
      ticketStats.forEach(ticket => {
        const ruleName = ticket.metadata?.rule_name;
        if (ruleName) {
          ruleMatchCounts[ruleName] = (ruleMatchCounts[ruleName] || 0) + 1;
        }
      });

      // Map rule matches to include both existing rules and rules found in tickets
      const ruleMatches = (rules || []).map(rule => ({
        ...rule,
        count: ruleMatchCounts[rule.name] || 0
      }));

      // Add any rules found in tickets but not in current rules (historical data)
      Object.entries(ruleMatchCounts).forEach(([ruleName, count]) => {
        if (!ruleMatches.some(r => r.name === ruleName)) {
          ruleMatches.push({
            id: ruleName, // Use name as id for historical rules
            name: ruleName,
            count: count,
            isHistorical: true // Flag to indicate this rule no longer exists
          });
        }
      });

      // Sort rules by count
      ruleMatches.sort((a, b) => b.count - a.count);

      // Calculate agent assignments
      const agentAssignments = (agents || []).map(agent => {
        const agentTickets = ticketStats.filter(t => t.assigned_agent_id === agent.profile.id);
        return {
          ...agent.profile,
          count: agentTickets.length,
          autoAssigned: agentTickets.filter(t => t.metadata?.auto_assigned === true).length
        };
      }).sort((a, b) => b.count - a.count);

      // Calculate average assignment time (for auto-assigned tickets)
      const assignedTickets = ticketStats.filter(t => 
        t.metadata?.auto_assigned === true && 
        t.assigned_agent_id && 
        t.metadata?.assignment_time
      );

      const avgTime = assignedTickets.length > 0 
        ? assignedTickets.reduce((acc, t) => {
            const assignTime = t.metadata?.assignment_time || 0;
            return acc + assignTime;
          }, 0) / assignedTickets.length
        : 0;

      setStats({
        total,
        autoAssigned,
        ruleMatches,
        agentAssignments,
        avgAssignmentTime: avgTime
      });

    } catch (error) {
      console.error('Failed to load routing statistics:', error);
      setAlert({ variant: 'destructive', message: 'Failed to load routing statistics' });
    }
  };

  const toggleRule = (ruleId) => {
    setExpandedRuleId(expandedRuleId === ruleId ? null : ruleId);
  };

  const filteredRules = stats.ruleMatches.filter(rule => 
    rule.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Total Tickets (30d)</h4>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        
        <Card className="p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Auto-Assigned</h4>
          <p className="text-2xl font-bold">{stats.autoAssigned}</p>
          <p className="text-sm text-muted-foreground">
            {((stats.autoAssigned / stats.total) * 100).toFixed(1)}% of total
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Avg Assignment Time</h4>
          <p className="text-2xl font-bold">
            {formatDuration(stats.avgAssignmentTime)}
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Active Rules</h4>
          <p className="text-2xl font-bold">
            {stats.ruleMatches.filter(r => r.count > 0).length}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Rule Performance</h3>
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
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredRules.map(rule => (
                <Card 
                  key={rule.id} 
                  className={`border p-2 transition-all hover:bg-accent ${expandedRuleId === rule.id ? 'bg-muted' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{rule.name}</span>
                      {rule.isHistorical && (
                        <Badge variant="outline" className="text-muted-foreground">Historical</Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">{rule.count} matches</Badge>
                      {!rule.isHistorical && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleRule(rule.id)}
                        >
                          {expandedRuleId === rule.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {expandedRuleId === rule.id && !rule.isHistorical && (
                    <div className="mt-2 space-y-2">
                      <Progress value={(rule.count / stats.total) * 100} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        {((rule.count / stats.total) * 100).toFixed(1)}% of total tickets
                      </p>
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

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Agent Assignments</h3>
          <div className="space-y-4">
            {stats.agentAssignments.map(agent => (
              <div key={agent.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{agent.full_name}</span>
                  <div className="space-x-2">
                    <Badge variant="secondary">{agent.count} total</Badge>
                    <Badge variant="outline">{agent.autoAssigned} auto</Badge>
                  </div>
                </div>
                <Progress 
                  value={(agent.count / stats.total) * 100} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ... existing dialog ... */}
    </div>
  );
} 
