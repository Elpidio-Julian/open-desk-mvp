import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';

const MetricCard = ({ title, value, subtitle, trend, loading }) => (
  <Card>
    <CardHeader className="space-y-1">
      <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          {subtitle && <Skeleton className="h-4 w-32" />}
        </div>
      ) : (
        <>
          <div className="text-3xl font-semibold">{value}</div>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          {trend && <div className="mt-4">{trend}</div>}
        </>
      )}
    </CardContent>
  </Card>
);

const LoadingChart = () => (
  <div className="space-y-4">
    <Skeleton className="h-4 w-48" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const parseInterval = (interval) => {
  if (!interval) return null;
  
  // If already a number, return it
  if (typeof interval === 'number') return interval;
  
  // Convert to string if not already
  const intervalStr = String(interval);
  
  // Handle PostgreSQL interval format
  let seconds = 0;
  
  // Parse days if present
  const dayMatch = intervalStr.match(/(\d+) day/);
  if (dayMatch) {
    seconds += parseInt(dayMatch[1]) * 24 * 3600;
  }
  
  // Parse time component (HH:MM:SS.ms)
  const timeMatch = intervalStr.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (timeMatch) {
    seconds += parseInt(timeMatch[1]) * 3600; // Hours
    seconds += parseInt(timeMatch[2]) * 60;   // Minutes
    seconds += parseInt(timeMatch[3]);        // Seconds
  }
  
  return seconds;
};

const formatDuration = (interval) => {
  if (!interval) return 'N/A';
  
  const seconds = parseInterval(interval);
  if (seconds === null) return 'N/A';

  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
};

const AgentPerformanceMetrics = () => {
  const { user } = useAuth();
  const [activeTickets, setActiveTickets] = useState(null);
  const [responseMetrics, setResponseMetrics] = useState(null);
  const [resolutionMetrics, setResolutionMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30'); // days

  useEffect(() => {
    if (user) {
      fetchMetrics();
    }
  }, [user, timeRange]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch active tickets metrics
      const { data: activeData, error: activeError } = await supabase.rpc(
        'get_agent_active_tickets',
        { 
          agent_id: user.id,
          time_period: `${timeRange} days`
        }
      );
      if (activeError) throw activeError;
      setActiveTickets(activeData[0]);

      // Fetch response time metrics
      const { data: responseData, error: responseError } = await supabase.rpc(
        'get_agent_response_metrics',
        {
          agent_id: user.id,
          time_period: `${timeRange} days`
        }
      );
      if (responseError) throw responseError;
      setResponseMetrics(responseData[0]);

      // Fetch resolution metrics
      const { data: resolutionData, error: resolutionError } = await supabase.rpc(
        'get_agent_resolution_metrics',
        {
          agent_id: user.id,
          time_period: `${timeRange} days`
        }
      );
      if (resolutionError) throw resolutionError;
      setResolutionMetrics(resolutionData[0]);

    } catch (err) {
      console.error('Error in fetchMetrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Active Tickets Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Active Tickets" loading />
          <MetricCard title="By Priority" loading />
          <MetricCard title="By Status" loading />
        </div>

        {/* Response Times Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard title="Average First Response Time" loading />
          <MetricCard title="Average Response Time" loading />
          <Card className="col-span-2">
            <CardContent className="pt-6">
              <LoadingChart />
            </CardContent>
          </Card>
        </div>

        {/* Resolution Metrics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Resolved Today" loading />
          <MetricCard title="Average Resolution Time" loading />
          <MetricCard title="Resolution Rate" loading />
          <Card className="col-span-3">
            <CardContent className="pt-6">
              <LoadingChart />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-600">
        Error loading metrics: {error}
      </div>
    );
  }

  const chartConfig = {
    responseTime: {
      theme: {
        light: "#3B82F6",
        dark: "#60A5FA"
      }
    },
    resolutions: {
      theme: {
        light: "#10B981",
        dark: "#34D399"
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Performance Metrics</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Tickets Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Active Tickets"
          value={activeTickets?.total_active || 0}
          subtitle={`Oldest: ${formatDuration(activeTickets?.oldest_ticket_age)}`}
        />
        <MetricCard
          title="By Priority"
          value={
            <div className="space-y-1 text-sm">
              {activeTickets?.by_priority && Object.entries(activeTickets.by_priority).map(([priority, count]) => (
                <div key={priority} className="flex justify-between">
                  <span className="capitalize">{priority}:</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          }
        />
        <MetricCard
          title="By Status"
          value={
            <div className="space-y-1 text-sm">
              {activeTickets?.by_status && Object.entries(activeTickets.by_status).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <span className="capitalize">{status.replace(/_/g, ' ')}:</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          }
        />
      </div>

      {/* Response Times Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          title="Average First Response Time"
          value={formatDuration(responseMetrics?.avg_first_response)}
        />
        <MetricCard
          title="Average Response Time"
          value={formatDuration(responseMetrics?.avg_response_time)}
        />
        {responseMetrics?.response_time_trend && (
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Response Time Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[2/1] w-full">
                <ChartContainer config={chartConfig}>
                  <LineChart 
                    data={responseMetrics.response_time_trend.map(point => ({
                      date: point.date,
                      average_response_time: parseInterval(point.average_response_time) || 0,
                      raw_response_time: point.average_response_time
                    }))}
                    margin={{ top: 10, right: 30, left: 60, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => {
                        const d = new Date(date);
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                      height={50}
                    />
                    <YAxis 
                      tickFormatter={(value) => {
                        const hours = Math.floor(value / 3600);
                        const minutes = Math.floor((value % 3600) / 60);
                        return hours > 0 ? `${hours}h` : `${minutes}m`;
                      }}
                      width={50}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const date = new Date(payload[0].payload.date);
                        return (
                          <ChartTooltipContent
                            active={active}
                            payload={payload?.map(p => ({
                              ...p,
                              name: "Response Time",
                              value: formatDuration(p.payload.raw_response_time)
                            }))}
                            labelFormatter={() => date.toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          />
                        );
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="average_response_time"
                      name="Response Time"
                      stroke="var(--color-responseTime)"
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Resolution Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Resolved Today"
          value={resolutionMetrics?.resolved_today || 0}
          subtitle={`This Week: ${resolutionMetrics?.resolved_this_week || 0}`}
        />
        <MetricCard
          title="Average Resolution Time"
          value={resolutionMetrics?.avg_resolution_time ? formatDuration(resolutionMetrics.avg_resolution_time) : "No data"}
          subtitle={resolutionMetrics?.avg_resolution_time ? null : "No tickets resolved in this period"}
        />
        <MetricCard
          title="Resolution Rate"
          value={resolutionMetrics?.resolution_rate ? `${Math.round(resolutionMetrics.resolution_rate)}%` : "No data"}
          subtitle={resolutionMetrics?.resolution_rate ? null : "No tickets resolved in this period"}
        />
        {resolutionMetrics?.resolution_trend ? (
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Resolution Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[2/1] w-full">
                <ChartContainer config={chartConfig}>
                  <LineChart 
                    data={resolutionMetrics.resolution_trend}
                    margin={{ top: 10, right: 30, left: 60, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => {
                        const d = new Date(date);
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                      height={50}
                    />
                    <YAxis 
                      width={50}
                      tickFormatter={(value) => Math.round(value)}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const date = new Date(payload[0].payload.date);
                        return (
                          <ChartTooltipContent
                            active={active}
                            payload={payload?.map(p => ({
                              ...p,
                              name: "Resolutions",
                              value: p.value
                            }))}
                            labelFormatter={() => date.toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          />
                        );
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count"
                      name="Resolutions"
                      stroke="var(--color-resolutions)"
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Resolution Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                No resolution data available for the selected time period
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AgentPerformanceMetrics; 