import { useEffect, useState } from "react";
import { Button, Tooltip as HerouiTooltip } from "@heroui/react";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";
import { DateRangePicker } from "../../components/DateRangePicker";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from 'recharts';
import { Icon } from '../../shared/ui';

// Import logos
import sentineloneLogo from '../../assets/logo/sentinelone.png';
import crowdstrikeLogo from '../../assets/logo/crowdstrike.png';

// Severity color mapping
const severityColors = {
  critical: '#FF0202',
  high: '#FFA735',
  medium: '#FFEE00',
  low: '#BBF0FF',
};

interface Summary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

interface TopHost {
  host_name: string;
  count: string;
  critical: string;
  high: string;
}

interface TopUser {
  user_name: string;
  count: string;
  critical: string;
  high: string;
}

interface SourceBreakdown {
  source: string;
  count: string;
}

interface TimelineData {
  time: string;
  count: string;
  critical: string;
  high: string;
  medium: string;
  low: string;
}

interface MitreData {
  mitre_tactic: string;
  mitre_technique: string;
  count: string;
}

interface IntegrationData {
  integration_id: string;
  integration_name: string;
  source: string;
  count: string;
  critical: string;
  high: string;
}

interface SiteData {
  host_account_name: string;
  host_site_name: string;
  count: string;
  critical: string;
  high: string;
}

export default function DashboardPage() {
  const { setPageContext } = usePageContext();
  
  const [loading, setLoading] = useState(true);
  // Date Range State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [endDate, setEndDate] = useState(() => new Date());
  
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
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    let dateParams = `startDate=${start}&endDate=${end}`;
    
    try {
      // 1. Fetch Active Integrations first to determine valid sources
      const activeIntRes = await api.get('/integrations');
      const activeIntegrations = activeIntRes.data || [];
      
      const activeProviders = activeIntegrations
        .map((i: any) => i.provider.toLowerCase())
        .filter((p: string) => ['sentinelone', 'crowdstrike'].includes(p));
        
      const uniqueActiveProviders = Array.from(new Set(activeProviders)) as string[];
      setAvailableProviders(uniqueActiveProviders);

      // 2. Determine sources query param
      // If 'all' is selected, we filter by ALL ACTIVE providers to hide historical data of removed integrations.
      // If a specific provider is selected, we filter by that provider.
      let targetSources = uniqueActiveProviders;
      if (selectedProvider !== 'all') {
        targetSources = [selectedProvider];
      }

      // If no active providers and 'all' is selected, we should probably fetch nothing or handle empty state.
      // But if we send empty sources param to backend (if implemented correctly), it might return everything (bad) or nothing.
      // My backend implementation: if (sources && sources.length > 0) ... else no filter.
      // So if we send NO param, it returns ALL history.
      // If we want to return NOTHING, we should maybe pass a dummy source or handle in backend.
      // However, if targetSources is empty, let's just not fetch or pass a dummy 'none'.
      
      if (targetSources.length > 0) {
        dateParams += `&sources=${targetSources.join(',')}`;
      } else if (selectedProvider === 'all') {
        // No active providers: force empty result by passing a non-existent source
        dateParams += `&sources=none`; 
      } else {
         // Selected provider is not active? Should unlikely happen if UI is correct, 
         // but if it happens, just pass it to get (likely empty) data.
         dateParams += `&sources=${selectedProvider}`;
      }

      // Calculate previous day date range for comparison
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 1);
      const prevEndDate = new Date(endDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevDateParams = `startDate=${prevStartDate.toISOString().split('T')[0]}&endDate=${prevEndDate.toISOString().split('T')[0]}`;

      const [summaryRes, prevSummaryRes, hostsRes, usersRes, sourcesRes, timelineRes, mitreRes, intRes, sitesRes] = await Promise.all([
        api.get(`/dashboard/summary?${dateParams}`),
        api.get(`/dashboard/summary?${prevDateParams}`),
        api.get(`/dashboard/top-hosts?${dateParams}&limit=20`),
        api.get(`/dashboard/top-users?${dateParams}&limit=20`),
        api.get(`/dashboard/sources?${dateParams}`),
        api.get(`/dashboard/timeline?${dateParams}&interval=day`),
        api.get(`/dashboard/mitre-heatmap?${dateParams}`),
        api.get(`/dashboard/integrations?${dateParams}`),
        api.get(`/dashboard/sites?${dateParams}`),
      ]);

      // 3. Set Data
      setSummary(summaryRes.data);
      setPreviousSummary(prevSummaryRes.data);
      
      setTopHosts(hostsRes.data.slice(0, 5));
      setTopUsers(usersRes.data.slice(0, 5));
      
      setSources(sourcesRes.data);
      setTimeline(timelineRes.data);
      setMitreData(mitreRes.data);
      
      // Filter integrations to show only active ones
      const activeIntegrationIds = new Set(activeIntegrations.map((i: any) => i.id));
      const filteredIntegrations = intRes.data.filter((i: IntegrationData) => 
        activeIntegrationIds.has(i.integration_id)
      );
      setIntegrations(filteredIntegrations);
      
      setSites(sitesRes.data);
      
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
            
            {/* SentinelOne Button - Show if available or if selected */}
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

            {/* CrowdStrike Button - Show if available or if selected */}
            {(availableProviders.includes('crowdstrike') || selectedProvider === 'crowdstrike') && (
              <>
                <div className="w-px bg-white/5 my-1 mx-1" />
                <HerouiTooltip content="CrowdStrike">
                  <button
                    onClick={() => setSelectedProvider('crowdstrike')}
                    className={`p-2 rounded-md transition-all ${selectedProvider === 'crowdstrike' ? 'bg-[#2C2E3A] shadow-sm' : 'opacity-50 hover:opacity-100'}`}
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
                <div className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-red-500' : change < 0 ? 'text-green-500' : 'text-foreground/30'}`}>
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
                <div className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-red-500' : change < 0 ? 'text-green-500' : 'text-foreground/30'}`}>
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
                <div className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-red-500' : change < 0 ? 'text-green-500' : 'text-foreground/30'}`}>
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
                <div className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-red-500' : change < 0 ? 'text-green-500' : 'text-foreground/30'}`}>
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
        <div className="bg-content1 border-2 border-primary/30 hover:border-primary/50 rounded-xl p-5 group transition-all shadow-lg shadow-primary/10" style={{ backgroundColor: '#C0DBEF20' }}>
          <div className="flex items-start justify-between mb-6">
            <p className="text-sm text-primary font-medium">Total Events</p>
            {(() => {
              const current = summary?.total || 0;
              const previous = previousSummary?.total || 0;
              const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
              const isIncrease = change > 0;
              return (
                <div className={`flex items-center gap-1 text-xs font-medium ${isIncrease ? 'text-primary' : change < 0 ? 'text-green-500' : 'text-foreground/30'}`}>
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

      {/* Timeline Chart */}
      <div className="bg-content1 border border-white/5 rounded-xl p-6 mb-6 animate-fade-in">
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
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={severityColors.critical} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={severityColors.critical} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="highGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={severityColors.high} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={severityColors.high} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="mediumGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={severityColors.medium} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={severityColors.medium} stopOpacity={0}/>
              </linearGradient>
            </defs>
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
            <Area type="monotone" dataKey="critical" stackId="1" stroke={severityColors.critical} strokeWidth={2} fill="url(#criticalGradient)" />
            <Area type="monotone" dataKey="high" stackId="1" stroke={severityColors.high} strokeWidth={2} fill="url(#highGradient)" />
            <Area type="monotone" dataKey="medium" stackId="1" stroke={severityColors.medium} strokeWidth={2} fill="url(#mediumGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Main Grid: Hosts, Users, Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6 animate-fade-in">
        {/* Top Hosts */}
        <div className="bg-content1 border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon.Server className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Top Hosts</h2>
          </div>
          <div className="space-y-2">
            {topHosts.map((host, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <span className="text-sm truncate max-w-[100px] text-foreground group-hover:text-foreground/80 transition-colors">{host.host_name}</span>
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
        <div className="bg-content1 border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon.Users className="w-4 h-4 text-secondary" />
            <h2 className="text-sm font-semibold text-foreground">Top Users</h2>
          </div>
          <div className="space-y-2">
            {topUsers.map((u, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">
                    {i + 1}
                  </div>
                  <span className="text-sm truncate max-w-[100px] text-foreground group-hover:text-foreground/80 transition-colors">{u.user_name}</span>
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

        {/* Sources Donut */}
        <div className="bg-content1 border border-white/5 rounded-xl p-5 h-[380px] flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Icon.Chart className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Sources Distribution</h2>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
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
                        fontSize={12}
                      >
                        {`${name} ${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                  labelLine={{ stroke: '#4A4D50', strokeWidth: 1 }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={['#ef4444', '#f59e0b', '#6366f1', '#22c55e', '#64748b'][i % 5]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1A1D1F', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: 12,
                  }}
                  itemStyle={{ color: '#ECEDEE' }}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#ef4444', '#f59e0b', '#6366f1', '#22c55e', '#64748b'][i % 5] }} />
                <span className="text-xs text-foreground capitalize">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integrations & Sites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all"
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
            <Icon.Server className="w-4 h-4 text-secondary" />
            <h2 className="text-sm font-semibold text-foreground">Sites</h2>
          </div>
          <div className="space-y-2 overflow-y-auto scrollbar-thin flex-1 pr-2">
            {sites.map((site, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all"
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
          <ResponsiveContainer width="100%" height={200}>
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
                  backgroundColor: '#1A1D1F', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: 8,
                  color: '#ECEDEE'
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Count']}
              />
              <Bar dataKey="count" fill="#C0DBEF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-8 text-foreground/50">No MITRE ATT&CK data available</p>
        )}
      </div>
    </div>
  );
}
