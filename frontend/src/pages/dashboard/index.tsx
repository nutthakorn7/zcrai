import { useEffect, useState } from "react";
import { Button, Tooltip as HerouiTooltip } from "@heroui/react";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";
import { DateRangePicker } from "../../components/DateRangePicker";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from 'recharts';
import { Icon } from '../../shared/ui';

// Import Types from separate file
import { 
  Summary, 
  TopHost, 
  TopUser, 
  SourceBreakdown, 
  TimelineData, 
  MitreData, 
  IntegrationData, 
  SiteData, 
  RecentDetection 
} from './type.ts';

// Import logos
import sentineloneLogo from '../../assets/logo/sentinelone.png';
import crowdstrikeLogo from '../../assets/logo/crowdstrike.png';

// Severity color mapping (Can also be moved to a constants file if used elsewhere)
const severityColors = {
  critical: '#FF0202',
  high: '#FFA735',
  medium: '#FFEE00',
  low: '#BBF0FF',
};

// Source color mapping
const sourceColors: { [key: string]: string } = {
  crowdstrike: '#EF4444', // Red
  sentinelone: '#A855F7', // Purple
};

export default function DashboardPage() {
  const { setPageContext } = usePageContext();
  
  const [loading, setLoading] = useState(true);
  // Date Range State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Set to tomorrow to include all of today's data
    return d;
  });
  
  // Filter State: 'all', 'sentinelone', 'crowdstrike'
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  
  const [summary, setSummary] = useState<Summary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<Summary | null>(null);
  const [topHosts, setTopHosts] = useState<TopHost[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [sources, setSources] = useState<SourceBreakdown[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [mitreData, setMitreData] = useState<MitreData[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [sites, setSites] = useState<SiteData[]>([]);
  const [recentDetections, setRecentDetections] = useState<RecentDetection[]>([]);

  // Available providers for filter buttons
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);

  useEffect(() => {
    loadDashboard();
  }, [startDate, endDate, selectedProvider]);

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const loadDashboard = async () => {
    setLoading(true);
    // Use local date string to avoid timezone issues
    const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    let dateParams = `startDate=${start}&endDate=${end}`;
    
    try {
      // 1. Fetch Active Integrations
      const activeIntRes = await api.get('/integrations');
      const activeIntegrations = activeIntRes.data || [];
      
      const activeProviders = activeIntegrations
        .map((i: any) => i.provider.toLowerCase())
        .filter((p: string) => ['sentinelone', 'crowdstrike'].includes(p));
        
      const uniqueActiveProviders = Array.from(new Set(activeProviders)) as string[];
      setAvailableProviders(uniqueActiveProviders);

      // 2. Determine sources query param
      let targetSources = uniqueActiveProviders;
      if (selectedProvider !== 'all') {
        targetSources = [selectedProvider];
      }

      if (targetSources.length > 0) {
        dateParams += `&sources=${targetSources.join(',')}`;
      } else if (selectedProvider === 'all') {
        dateParams += `&sources=none`; 
      } else {
         dateParams += `&sources=${selectedProvider}`;
      }

      // Calculate previous day date range
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 1);
      const prevEndDate = new Date(endDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevStart = `${prevStartDate.getFullYear()}-${String(prevStartDate.getMonth() + 1).padStart(2, '0')}-${String(prevStartDate.getDate()).padStart(2, '0')}`;
      const prevEnd = `${prevEndDate.getFullYear()}-${String(prevEndDate.getMonth() + 1).padStart(2, '0')}-${String(prevEndDate.getDate()).padStart(2, '0')}`;
      const prevDateParams = `startDate=${prevStart}&endDate=${prevEnd}`;

      const [summaryRes, prevSummaryRes, hostsRes, usersRes, sourcesRes, timelineRes, mitreRes, intRes, sitesRes, recentRes] = await Promise.all([
        api.get(`/dashboard/summary?${dateParams}`),
        api.get(`/dashboard/summary?${prevDateParams}`),
        api.get(`/dashboard/top-hosts?${dateParams}&limit=20`),
        api.get(`/dashboard/top-users?${dateParams}&limit=20`),
        api.get(`/dashboard/sources?${dateParams}`),
        api.get(`/dashboard/timeline?${dateParams}&interval=day`),
        api.get(`/dashboard/mitre-heatmap?${dateParams}`),
        api.get(`/dashboard/integrations?${dateParams}`),
        api.get(`/dashboard/sites?${dateParams}`),
        api.get(`/dashboard/recent-detections?${dateParams}&limit=5`),
      ]);

      // 3. Set Data
      setSummary(summaryRes.data);
      setPreviousSummary(prevSummaryRes.data);
      
      const hostsData = Array.isArray(hostsRes.data) ? hostsRes.data : [];
      const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
      
      setTopHosts(hostsData.slice(0, 5));
      setTopUsers(usersData.slice(0, 5));
      
      setSources(sourcesRes.data);
      setTimeline(timelineRes.data);
      setMitreData(mitreRes.data);
      
      const activeIntegrationIds = new Set(activeIntegrations.map((i: any) => i.id));
      const filteredIntegrations = intRes.data.filter((i: IntegrationData) => 
        activeIntegrationIds.has(i.integration_id)
      );
      setIntegrations(filteredIntegrations);
      
      setSites(sitesRes.data);

      // Recent detections now come pre-sorted from the backend
      const detections = Array.isArray(recentRes.data) ? recentRes.data : [];
      setRecentDetections(detections);
      
      setPageContext({
        pageName: 'Dashboard',
        pageDescription: 'Security monitoring dashboard showing alerts and events summary',
        data: {
          stats: summaryRes.data,
          timeRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        }
      });
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };


  // Transform timeline data for chart
  const chartData = timeline.map(t => ({
    time: new Date(t.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    total: parseInt(t.count),
    critical: parseInt(t.critical),
    high: parseInt(t.high),
    medium: parseInt(t.medium),
    low: parseInt(t.low),
  }));

  // Transform source data for pie chart
  const pieData = sources.map(s => ({
    name: s.source,
    value: parseInt(s.count),
  }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full animate-spin" 
               style={{ borderTopColor: 'var(--color-primary)' }} />
          <Icon.ShieldAlert className="absolute inset-0 m-auto w-6 h-6 text-primary" />
        </div>
        <p className="mt-4 text-sm text-foreground/50">Loading security data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-background">
      {/* Header with Provider Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 animate-fade-in gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Security Dashboard
          </h1>
          <p className="text-sm mt-1 text-foreground/50">
            Real-time threat monitoring & analytics
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Provider Filter Buttons */}
          <div className="flex bg-content1 rounded-lg p-1 border border-white/5">
            <HerouiTooltip content="All Providers">
              <button
                onClick={() => setSelectedProvider('all')}
                className={`p-2 rounded-md transition-all ${selectedProvider === 'all' ? 'bg-content2 text-foreground shadow-sm' : 'text-foreground/50 hover:text-foreground'}`}
              >
                <div className="flex items-center gap-2 px-1">
                  <Icon.Database className="w-4 h-4" />
                  <span className="text-xs font-medium">All</span>
                </div>
              </button>
            </HerouiTooltip>
            
            {(availableProviders.includes('sentinelone') || selectedProvider === 'sentinelone') && (
              <>
                <div className="w-px bg-white/5 my-1 mx-1" />
                <HerouiTooltip content="SentinelOne">
                  <button
                    onClick={() => setSelectedProvider('sentinelone')}
                    className={`p-2 rounded-md transition-all ${selectedProvider === 'sentinelone' ? 'bg-content2 shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                  >
                    <img src={sentineloneLogo} alt="S1" className="w-5 h-5 object-contain" />
                  </button>
                </HerouiTooltip>
              </>
            )}

            {(availableProviders.includes('crowdstrike') || selectedProvider === 'crowdstrike') && (
              <>
                <div className="w-px bg-white/5 my-1 mx-1" />
                <HerouiTooltip content="CrowdStrike">
                  <button
                    onClick={() => setSelectedProvider('crowdstrike')}
                    className={`p-2 rounded-md transition-all ${selectedProvider === 'crowdstrike' ? 'bg-content2 shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                  >
                    <img src={crowdstrikeLogo} alt="CS" className="w-5 h-5 object-contain" />
                  </button>
                </HerouiTooltip>
              </>
            )}
          </div>

          <DateRangePicker 
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
          />
          
          <Button 
            size="sm" 
            className="bg-primary hover:bg-primary/90 text-background border-0 transition-colors"
            onPress={loadDashboard}
          >
            <Icon.Refresh className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 animate-fade-in">
        {/* Critical */}
        <div className="bg-content1 border border-white/5 hover:border-white/10 rounded-xl p-5 group transition-all" style={{ backgroundColor: `${severityColors.critical}15` }}>
          <div className="flex items-start justify-between mb-6">
            <p className="text-sm text-foreground/50">Critical</p>
            {(() => {
              const current = summary?.critical || 0;
              const previous = previousSummary?.critical || 0;
              const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
              const isIncrease = change > 0;
              return (
                <div className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-foreground/30'}`}>
                  {change !== 0 && (
                    isIncrease ? 
                      <Icon.TrendingUp className="w-3 h-3" /> : 
                      <Icon.TrendingDown className="w-3 h-3" />
                  )}
                  <span>{Math.abs(change).toFixed(1)}%</span>
                </div>
              );
            })()}
          </div>
          <div>
            <p className="text-3xl font-semibold text-foreground">
              {summary?.critical?.toLocaleString() || 0}
            </p>
          </div>
        </div>
        
        {/* High */}
        <div className="bg-content1 border border-white/5 hover:border-white/10 rounded-xl p-5 group transition-all" style={{ backgroundColor: `${severityColors.high}15` }}>
          <div className="flex items-start justify-between mb-6">
            <p className="text-sm text-foreground/50">High</p>
            {(() => {
              const current = summary?.high || 0;
              const previous = previousSummary?.high || 0;
              const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
              const isIncrease = change > 0;
              return (
                <div className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-foreground/30'}`}>
                  {change !== 0 && (
                    isIncrease ? 
                      <Icon.TrendingUp className="w-3 h-3" /> : 
                      <Icon.TrendingDown className="w-3 h-3" />
                  )}
                  <span>{Math.abs(change).toFixed(1)}%</span>
                </div>
              );
            })()}
          </div>
          <div>
            <p className="text-3xl font-semibold text-foreground">
              {summary?.high?.toLocaleString() || 0}
            </p>
          </div>
        </div>
        
        {/* Medium */}
        <div className="bg-content1 border border-white/5 hover:border-white/10 rounded-xl p-5 group transition-all" style={{ backgroundColor: `${severityColors.medium}15` }}>
          <div className="flex items-start justify-between mb-6">
            <p className="text-sm text-foreground/50">Medium</p>
            {(() => {
              const current = summary?.medium || 0;
              const previous = previousSummary?.medium || 0;
              const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
              const isIncrease = change > 0;
              return (
                <div className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-foreground/30'}`}>
                  {change !== 0 && (
                    isIncrease ? 
                      <Icon.TrendingUp className="w-3 h-3" /> : 
                      <Icon.TrendingDown className="w-3 h-3" />
                  )}
                  <span>{Math.abs(change).toFixed(1)}%</span>
                </div>
              );
            })()}
          </div>
          <div>
            <p className="text-3xl font-semibold text-foreground">
              {summary?.medium?.toLocaleString() || 0}
            </p>
          </div>
        </div>
        
        {/* Low */}
        <div className="bg-content1 border border-white/5 hover:border-white/10 rounded-xl p-5 group transition-all" style={{ backgroundColor: `${severityColors.low}15` }}>
          <div className="flex items-start justify-between mb-6">
            <p className="text-sm text-foreground/50">Low</p>
            {(() => {
              const current = summary?.low || 0;
              const previous = previousSummary?.low || 0;
              const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
              const isIncrease = change > 0;
              return (
                <div className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-foreground/30'}`}>
                  {change !== 0 && (
                    isIncrease ? 
                      <Icon.TrendingUp className="w-3 h-3" /> : 
                      <Icon.TrendingDown className="w-3 h-3" />
                  )}
                  <span>{Math.abs(change).toFixed(1)}%</span>
                </div>
              );
            })()}
          </div>
          <div>
            <p className="text-3xl font-semibold text-foreground">
              {summary?.low?.toLocaleString() || 0}
            </p>
          </div>
        </div>
        
        {/* Total */}
        <div className="bg-primary/[0.08] border-2 border-primary/30 hover:border-primary/50 rounded-xl p-5 group transition-all shadow-lg shadow-primary/10">
          <div className="flex items-start justify-between mb-6">
            <p className="text-sm text-primary font-medium">Total Events</p>
            {(() => {
              const current = summary?.total || 0;
              const previous = previousSummary?.total || 0;
              const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
              const isIncrease = change > 0;
              return (
                <div className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-foreground/30'}`}>
                  {change !== 0 && (
                    isIncrease ? 
                      <Icon.TrendingUp className="w-3 h-3" /> : 
                      <Icon.TrendingDown className="w-3 h-3" />
                  )}
                  <span>{Math.abs(change).toFixed(1)}%</span>
                </div>
              );
            })()}
          </div>
          <div>
            <p className="text-3xl font-semibold text-foreground">
              {summary?.total?.toLocaleString() || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Bento Grid: Timeline + Sources */}
      <div className="grid grid-cols-12 gap-3 mb-6 animate-fade-in">
        {/* Timeline Chart - 8 columns */}
        <div className="col-span-12 lg:col-span-8 bg-content1 border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Events Timeline</h2>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: severityColors.critical }} />
                <span className="text-xs text-foreground/50">Critical</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: severityColors.high }} />
                <span className="text-xs text-foreground/50">High</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: severityColors.medium }} />
                <span className="text-xs text-foreground/50">Medium</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: severityColors.low }} />
                <span className="text-xs text-foreground/50">Low</span>
              </div>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" stroke="#4A4D50" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#4A4D50" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1A1D1F', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: 12,
              }}
              labelStyle={{ color: '#ECEDEE', fontWeight: 600 }}
              itemStyle={{ color: '#ECEDEE' }}
            />
            <Line type="monotone" dataKey="critical" stroke={severityColors.critical} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="high" stroke={severityColors.high} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="medium" stroke={severityColors.medium} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="low" stroke={severityColors.low} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sources Distribution - 4 columns */}
        <div className="col-span-12 lg:col-span-4 bg-content1 border border-white/5 rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Icon.Chart className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Sources</h2>
          </div>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  dataKey="value"
                  paddingAngle={4}
                  label={({ cx, x, y, percent, name }: any) => {
                    return (
                      <text 
                        x={x} 
                        y={y} 
                        fill="#ECEDEE" 
                        textAnchor={x > cx ? 'start' : 'end'} 
                        dominantBaseline="central"
                        fontSize={11}
                      >
                        {`${name} ${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                  labelLine={{ stroke: '#4A4D50', strokeWidth: 1 }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={['rgb(239, 68, 68)', 'rgb(245, 158, 11)', 'rgb(99, 102, 241)', 'rgb(34, 197, 94)', 'rgb(100, 116, 139)'][i % 5]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--heroui-content1))', 
                    border: '1px solid rgba(255,255,255,0.05)', 
                    borderRadius: 12,
                  }}
                  itemStyle={{ color: 'hsl(var(--heroui-foreground))' }}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Detections, Hosts, Users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6 animate-fade-in">
        {/* Most Recent Detections */}
        <div className="bg-content1 border border-white/5 rounded-xl p-5 h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Icon.ShieldAlert className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Recent Detections</h2>
            </div>
          </div>
          <div className="space-y-2 overflow-y-auto scrollbar-thin flex-1 pr-2">
            {recentDetections.length > 0 ? (
              recentDetections.map((detection) => {
                const severityColor = severityColors[detection.severity.toLowerCase() as keyof typeof severityColors] || severityColors.low;
                const source = detection.source?.toLowerCase() || '';
                const sourceColor = sourceColors[source] || '#6B7280';
                const sourceLogo = source === 'crowdstrike' ? crowdstrikeLogo : source === 'sentinelone' ? sentineloneLogo : null;
                
                return (
                  <div
                    key={detection.id}
                    className="relative flex items-center justify-between p-3 rounded-lg bg-content2/50 hover:bg-content2 transition-all group overflow-hidden"
                  >
                    {/* Left colored border */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                      style={{ backgroundColor: sourceColor }}
                    />
                    
                    <div className="flex items-center gap-3 flex-1 min-w-0 pl-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: severityColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                            style={{ backgroundColor: `${severityColor}15`, color: severityColor }}
                          >
                            {detection.severity}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-foreground truncate block mb-1">
                          {detection.mitre_technique || 'Unknown'}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-foreground/50">
                          <Icon.Clock className="w-3 h-3" />
                          <span className="truncate">
                            {new Date(detection.timestamp).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })} {new Date(detection.timestamp).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: false 
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Source logo on the right */}
                    {sourceLogo && (
                      <div className="ml-2 flex-shrink-0">
                        <img 
                          src={sourceLogo} 
                          alt={detection.source} 
                          className="w-5 h-5 object-contain opacity-60 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-foreground/50 text-center py-4">No recent detections</p>
            )}
          </div>
        </div>

        {/* Top Hosts */}
        <div className="bg-content1 border border-white/5 rounded-xl p-5 h-[400px] flex flex-col">
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <Icon.Server className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Top Hosts</h2>
          </div>
          <div className="space-y-2 overflow-y-auto scrollbar-thin flex-1 pr-2">
            {topHosts.map((host, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-lg bg-content2/50 hover:bg-content2 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <span className="text-sm truncate max-w-[120px] text-foreground group-hover:text-foreground/80 transition-colors">{host.host_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground/50">{parseInt(host.count).toLocaleString()}</span>
                  {parseInt(host.critical) > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full font-medium" style={{ backgroundColor: `${severityColors.critical}15`, color: severityColors.critical }}>
                      {host.critical}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {topHosts.length === 0 && <p className="text-xs text-foreground/50 text-center py-4">No hosts data</p>}
          </div>
        </div>

        {/* Top Users */}
        <div className="bg-content1 border border-white/5 rounded-xl p-5 h-[400px] flex flex-col">
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <Icon.Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Top Users</h2>
          </div>
          <div className="space-y-2 overflow-y-auto scrollbar-thin flex-1 pr-2">
            {topUsers.map((u, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-lg bg-content2/50 hover:bg-content2 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">
                    {i + 1}
                  </div>
                  <span className="text-sm truncate max-w-[120px] text-foreground group-hover:text-foreground/80 transition-colors">{u.user_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground/50">{parseInt(u.count).toLocaleString()}</span>
                  {parseInt(u.critical) > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full font-medium" style={{ backgroundColor: `${severityColors.critical}15`, color: severityColors.critical }}>
                      {u.critical}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {topUsers.length === 0 && <p className="text-xs text-foreground/50 text-center py-4">No users data</p>}
          </div>
        </div>
      </div>

      {/* Integrations & Sites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {/* Integrations */}
        <div className="bg-content1 border border-white/5 rounded-xl p-5 h-[400px] flex flex-col">
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <Icon.Database className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Integrations</h2>
          </div>
          <div className="space-y-2 overflow-y-auto scrollbar-thin flex-1 pr-2">
            {integrations.map((int, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-lg bg-content2/50 hover:bg-content2 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
                    <Icon.Database className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground block">{int.integration_name || int.integration_id.slice(0, 8)}</span>
                    <p className="text-xs capitalize text-foreground/50 mt-0.5">{int.source}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-foreground">{parseInt(int.count).toLocaleString()}</span>
                  {parseInt(int.critical) > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${severityColors.critical}15`, color: severityColors.critical }}>
                      {int.critical} Crit
                    </span>
                  )}
                </div>
              </div>
            ))}
            {integrations.length === 0 && <p className="text-sm text-foreground/50 text-center py-8">No integrations found</p>}
          </div>
        </div>

        {/* Sites */}
        <div className="bg-content1 border border-white/5 rounded-xl p-5 h-[400px] flex flex-col">
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <Icon.Global className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Sites</h2>
          </div>
          <div className="space-y-2 overflow-y-auto scrollbar-thin flex-1 pr-2">
            {sites.map((site, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-lg bg-content2/50 hover:bg-content2 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/10">
                    <Icon.Server className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground block">{site.host_site_name}</span>
                    <p className="text-xs text-foreground/50 mt-0.5">{site.host_account_name || '-'}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-foreground">{parseInt(site.count).toLocaleString()}</span>
                  {parseInt(site.critical) > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${severityColors.critical}15`, color: severityColors.critical }}>
                      {site.critical} Crit
                    </span>
                  )}
                </div>
              </div>
            ))}
            {sites.length === 0 && <p className="text-sm text-foreground/50 text-center py-8">No sites found</p>}
          </div>
        </div>
      </div>

      {/* MITRE ATT&CK */}
      <div className="bg-content1 border border-white/5 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold mb-3 text-foreground">MITRE ATT&CK Techniques</h2>
        {mitreData.length > 0 ? (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mitreData.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" stroke="#4A4D50" fontSize={11} />
              <YAxis 
                dataKey="mitre_technique" 
                type="category" 
                stroke="#4A4D50" 
                fontSize={10} 
                width={120}
                tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 15) + '...' : v}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--heroui-content1))', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: 8,
                  color: 'hsl(var(--heroui-foreground))'
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Count']}
              />
              <Bar dataKey="count" fill="hsl(var(--heroui-primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-center py-8 text-foreground/50">No MITRE ATT&CK data available</p>
        )}
      </div>
    </div>
  );
}