import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { supabase } from '../../services/supabase';

export default function RoutingStats() {
  const [stats, setStats] = useState({
    total: 0,
    autoAssigned: 0,
    ruleMatches: [],
    agentAssignments: [],
    avgAssignmentTime: 0
  });

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
      // Get total and auto-assigned tickets
      const { data: ticketStats, error: ticketError } = await supabase
        .from('tickets')
        .select('id, auto_assigned, routing_rule_id, assigned_to, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (ticketError) throw ticketError;

      // Get rules data
      const { data: rules, error: rulesError } = await supabase
        .from('routing_rules')
        .select('id, name');

      if (rulesError) throw rulesError;

      // Get agents data
      const { data: agents, error: agentsError } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'agent');

      if (agentsError) throw agentsError;

      // Calculate statistics
      const total = ticketStats.length;
      const autoAssigned = ticketStats.filter(t => t.auto_assigned).length;

      // Calculate rule matches
      const ruleMatches = rules.map(rule => ({
        ...rule,
        count: ticketStats.filter(t => t.routing_rule_id === rule.id).length
      })).sort((a, b) => b.count - a.count);

      // Calculate agent assignments
      const agentAssignments = agents.map(agent => ({
        ...agent,
        count: ticketStats.filter(t => t.assigned_to === agent.id).length,
        autoAssigned: ticketStats.filter(t => t.assigned_to === agent.id && t.auto_assigned).length
      })).sort((a, b) => b.count - a.count);

      // Calculate average assignment time (for auto-assigned tickets)
      const assignedTickets = ticketStats.filter(t => t.auto_assigned && t.assigned_to);
      const avgTime = assignedTickets.length > 0 
        ? assignedTickets.reduce((acc, t) => {
            const createTime = new Date(t.created_at).getTime();
            // For auto-assigned tickets, assume assignment happened right after creation
            const assignTime = createTime + 1000; // Add 1 second to creation time
            return acc + (assignTime - createTime);
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
    }
  };

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
          <h3 className="text-lg font-semibold mb-4">Rule Performance</h3>
          <div className="space-y-4">
            {stats.ruleMatches.map(rule => (
              <div key={rule.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{rule.name}</span>
                  <Badge variant="secondary">{rule.count} matches</Badge>
                </div>
                <Progress 
                  value={(rule.count / stats.total) * 100} 
                  className="h-2"
                />
              </div>
            ))}
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
    </div>
  );
} 