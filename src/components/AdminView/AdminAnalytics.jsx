import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ChartContainer } from '../ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { supabase } from '../../services/supabase';
import { Alert, AlertDescription } from '../ui/alert';

const TIME_PERIODS = {
  '7d': { days: 7, label: 'Last 7 Days' },
  '30d': { days: 30, label: 'Last 30 Days' },
  '90d': { days: 90, label: 'Last 90 Days' }
};

const chartConfig = {
  responseTime: {
    theme: {
      light: "hsl(var(--primary))",
      dark: "hsl(var(--primary))"
    }
  },
  resolution: {
    theme: {
      light: "hsl(var(--success))",
      dark: "hsl(var(--success))"
    }
  }
};

const AdminAnalytics = () => {
  const [timePeriod, setTimePeriod] = useState('30d');
  const [activeTicketsData, setActiveTicketsData] = useState(null);
  const [responseMetrics, setResponseMetrics] = useState(null);
  const [resolutionMetrics, setResolutionMetrics] = useState(null);
  const [agentMetrics, setAgentMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch metrics for all agents
        const { data: agents, error: agentsError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('role', 'agent');

        if (agentsError) {
          throw new Error('Failed to fetch agents: ' + agentsError.message);
        }

        if (!agents || agents.length === 0) {
          setActiveTicketsData({ total: 0, byStatus: {} });
          setResponseMetrics({ avgFirstResponse: 0, avgResponseTime: 0, trend: [] });
          setResolutionMetrics({ totalResolved: 0, avgResolutionTime: 0, resolutionRate: 0, trend: [] });
          setAgentMetrics([]);
          return;
        }

        const metricsPromises = agents.map(async (agent) => {
          try {
            const [activeTickets, response, resolution] = await Promise.all([
              supabase.rpc('get_agent_active_tickets', { 
                agent_id: agent.id,
                time_period: `${TIME_PERIODS[timePeriod].days} days`
              }),
              supabase.rpc('get_agent_response_metrics', { 
                agent_id: agent.id,
                time_period: `${TIME_PERIODS[timePeriod].days} days`
              }),
              supabase.rpc('get_agent_resolution_metrics', { 
                agent_id: agent.id,
                time_period: `${TIME_PERIODS[timePeriod].days} days`
              })
            ]);

            if (activeTickets.error) throw new Error(`Active tickets error: ${activeTickets.error.message}`);
            if (response.error) throw new Error(`Response metrics error: ${response.error.message}`);
            if (resolution.error) throw new Error(`Resolution metrics error: ${resolution.error.message}`);

            return {
              agent_id: agent.id,
              full_name: agent.full_name,
              email: agent.email,
              activeTickets: activeTickets.data?.[0] || { total_active: 0, by_status: {} },
              response: response.data?.[0] || { avg_first_response: 0, avg_response_time: 0, response_time_trend: [] },
              resolution: resolution.data?.[0] || { total_resolved: 0, avg_resolution_time: 0, resolution_rate: 0, resolution_trend: [] }
            };
          } catch (error) {
            console.error(`Error fetching metrics for agent ${agent.id}:`, error);
            return {
              agent_id: agent.id,
              full_name: agent.full_name,
              email: agent.email,
              activeTickets: { total_active: 0, by_status: {} },
              response: { avg_first_response: 0, avg_response_time: 0, response_time_trend: [] },
              resolution: { total_resolved: 0, avg_resolution_time: 0, resolution_rate: 0, resolution_trend: [] }
            };
          }
        });

        const allMetrics = await Promise.all(metricsPromises);
        setAgentMetrics(allMetrics);
        
        // Aggregate metrics
        const aggregatedActive = {
          total: allMetrics.reduce((sum, m) => sum + (m.activeTickets?.total_active || 0), 0),
          byStatus: allMetrics.reduce((acc, m) => {
            const status = m.activeTickets?.by_status || {};
            Object.entries(status).forEach(([key, value]) => {
              acc[key] = (acc[key] || 0) + value;
            });
            return acc;
          }, {})
        };

        const aggregatedResponse = {
          avgFirstResponse: allMetrics.length ? allMetrics.reduce((sum, m) => sum + (m.response?.avg_first_response || 0), 0) / allMetrics.length : 0,
          avgResponseTime: allMetrics.length ? allMetrics.reduce((sum, m) => sum + (m.response?.avg_response_time || 0), 0) / allMetrics.length : 0,
          trend: allMetrics.flatMap(m => 
            (m.response?.response_time_trend || []).map(t => ({
              ...t,
              agent: m.full_name
            }))
          )
        };

        const aggregatedResolution = {
          totalResolved: allMetrics.reduce((sum, m) => sum + (m.resolution?.total_resolved || 0), 0),
          avgResolutionTime: allMetrics.length ? allMetrics.reduce((sum, m) => sum + (m.resolution?.avg_resolution_time || 0), 0) / allMetrics.length : 0,
          resolutionRate: allMetrics.length ? allMetrics.reduce((sum, m) => sum + (m.resolution?.resolution_rate || 0), 0) / allMetrics.length : 0,
          trend: allMetrics.flatMap(m => 
            (m.resolution?.resolution_trend || []).map(t => ({
              ...t,
              agent: m.full_name
            }))
          )
        };

        setActiveTicketsData(aggregatedActive);
        setResponseMetrics(aggregatedResponse);
        setResolutionMetrics(aggregatedResolution);
      } catch (error) {
        console.error('Error fetching metrics:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [timePeriod]);

  if (loading) {
    return <div className="flex items-center justify-center p-6">Loading metrics...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  const formatDuration = (milliseconds) => {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <div className="flex justify-end">
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time period" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIME_PERIODS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Active Tickets</h3>
          <div className="space-y-2">
            <p className="text-2xl font-bold">{activeTicketsData?.total || 0}</p>
            <div className="text-sm text-muted-foreground">
              {Object.entries(activeTicketsData?.byStatus || {}).map(([status, count]) => (
                <p key={status} className="flex justify-between">
                  <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                  <span>{count}</span>
                </p>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Response Times</h3>
          <div className="space-y-2">
            <p className="text-2xl font-bold">{formatDuration(responseMetrics?.avgResponseTime || 0)}</p>
            <p className="text-sm text-muted-foreground">
              First Response: {formatDuration(responseMetrics?.avgFirstResponse || 0)}
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Resolution Metrics</h3>
          <div className="space-y-2">
            <p className="text-2xl font-bold">{resolutionMetrics?.totalResolved || 0}</p>
            <p className="text-sm text-muted-foreground">
              Resolution Rate: {Math.round(resolutionMetrics?.resolutionRate || 0)}%
            </p>
            <p className="text-sm text-muted-foreground">
              Avg Time: {formatDuration(resolutionMetrics?.avgResolutionTime || 0)}
            </p>
          </div>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card className="p-6">
        <Tabs defaultValue="response">
          <TabsList>
            <TabsTrigger value="response">Response Time Trends</TabsTrigger>
            <TabsTrigger value="resolution">Resolution Trends</TabsTrigger>
            <TabsTrigger value="agents">Agent Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="response" className="pt-4">
            <ChartContainer className="h-[300px]" config={chartConfig}>
              <LineChart data={responseMetrics?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="average_response_time" 
                  name="Avg Response Time" 
                  stroke="hsl(var(--primary))" 
                />
              </LineChart>
            </ChartContainer>
          </TabsContent>

          <TabsContent value="resolution" className="pt-4">
            <ChartContainer className="h-[300px]" config={chartConfig}>
              <LineChart data={resolutionMetrics?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  name="Resolutions" 
                  stroke="hsl(var(--success))" 
                />
              </LineChart>
            </ChartContainer>
          </TabsContent>

          <TabsContent value="agents" className="pt-4">
            <div className="space-y-6">
              {agentMetrics.map((agent) => (
                <Card key={agent.agent_id} className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-semibold">{agent.full_name}</h4>
                      <p className="text-sm text-muted-foreground">{agent.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">Active Tickets: {agent.activeTickets?.total_active || 0}</p>
                      <p className="text-sm text-muted-foreground">
                        Resolution Rate: {Math.round(agent.resolution?.resolution_rate || 0)}%
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Response Time</p>
                      <p className="font-medium">{formatDuration(agent.response?.avg_response_time || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">First Response</p>
                      <p className="font-medium">{formatDuration(agent.response?.avg_first_response || 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Resolved</p>
                      <p className="font-medium">{agent.resolution?.total_resolved || 0}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default AdminAnalytics; 