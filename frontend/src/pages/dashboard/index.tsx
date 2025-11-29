import { useEffect, useState } from "react";
import { Button, Spinner, Tooltip as HerouiTooltip } from "@heroui/react";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";
import { DateRangePicker } from "../../components/DateRangePicker";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from 'recharts';
import { 
  ShieldAlert, AlertTriangle, AlertCircle, Activity, 
  Server, Database, TrendingUp, RefreshCw, Filter
} from 'lucide-react';

// Import logos
import sentineloneLogo from '../../assets/logo/sentinelone.png';
import crowdstrikeLogo from '../../assets/logo/crowdstrike.png';

// CSS Animations (inject via style tag)
const animationStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(255, 107, 156, 0.2); }
    50% { box-shadow: 0 0 30px rgba(255, 107, 156, 0.4); }
  }
  .animate-fadeInUp { animation: fadeInUp 0.5s ease-out forwards; }
  .animate-fadeInUp-1 { animation: fadeInUp 0.5s ease-out 0.1s forwards; opacity: 0; }
  .animate-fadeInUp-2 { animation: fadeInUp 0.5s ease-out 0.2s forwards; opacity: 0; }
  .animate-fadeInUp-3 { animation: fadeInUp 0.5s ease-out 0.3s forwards; opacity: 0; }
  .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
  .card-glass {
    background: linear-gradient(135deg, rgba(26, 28, 36, 0.9) 0%, rgba(20, 21, 30, 0.95) 100%);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;
  }
  .card-glass:hover {
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  .stat-card {
    background: linear-gradient(135deg, rgba(30, 32, 42, 0.8) 0%, rgba(20, 22, 30, 0.9) 100%);
    backdrop-filter: blur(10px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .stat-card:hover {
    transform: scale(1.02);
  }
  .gradient-border {
    position: relative;
  }
  .gradient-border::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 16px;
    padding: 1px;
    background: linear-gradient(135deg, rgba(255, 107, 156, 0.3), rgba(126, 87, 255, 0.3));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

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

const COLORS = ['#ef4444', '#f59e0b', '#6366f1', '#22c55e', '#64748b'];

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

      const [summaryRes, hostsRes, usersRes, sourcesRes, timelineRes, mitreRes, intRes, sitesRes] = await Promise.all([
        api.get(`/dashboard/summary?${dateParams}`),
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
      <div className="flex flex-col items-center justify-center min-h-screen" style={{ backgroundColor: '#0E0F14' }}>
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#FF6B9C]/20 rounded-full animate-spin" 
               style={{ borderTopColor: '#FF6B9C' }} />
          <ShieldAlert className="absolute inset-0 m-auto w-6 h-6 text-[#FF6B9C]" />
        </div>
        <p className="mt-4 text-sm text-[#8D93A1]">Loading security data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: '#0E0F14' }}>
      {/* Inject Animation Styles */}
      <style>{animationStyles}</style>
      
      {/* Header with Gradient and Provider Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 animate-fadeInUp gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#E4E6EB] to-[#8D93A1] bg-clip-text text-transparent">
            Security Dashboard
          </h1>
          <p className="text-sm mt-1 text-[#6C6F75]">
            Real-time threat monitoring & analytics
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Provider Filter Buttons */}
          <div className="flex bg-[#1C1E28] rounded-lg p-1 border border-white/5">
            <HerouiTooltip content="All Providers">
              <button
                onClick={() => setSelectedProvider('all')}
                className={`p-2 rounded-md transition-all ${selectedProvider === 'all' ? 'bg-[#2C2E3A] text-white shadow-sm' : 'text-[#6C6F75] hover:text-[#E4E6EB]'}`}
              >
                <div className="flex items-center gap-2 px-1">
                  <Database className="w-4 h-4" />
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
                    className={`p-2 rounded-md transition-all ${selectedProvider === 'sentinelone' ? 'bg-[#2C2E3A] shadow-sm' : 'opacity-50 hover:opacity-100'}`}
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
            className="bg-gradient-to-r from-[#FF6B9C] to-[#7E57FF] text-white border-0 hover:opacity-90 transition-opacity"
            onPress={loadDashboard}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Summary Stats - Glass Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 animate-fadeInUp-1">
        {/* Critical */}
        <div className="stat-card rounded-2xl p-5 cursor-pointer group">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#FF4A64]/20 to-[#FF4A64]/5 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5 h-5 text-[#FF4A64]" />
            </div>
            <div>
              <p className="text-xs text-[#6C6F75] mb-1">Critical</p>
              <p className="text-2xl font-bold text-[#FF4A64]">
                {summary?.critical?.toLocaleString() || 0}
              </p>
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-[#FF4A64]/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#FF4A64] to-[#FF6B9C] rounded-full" 
                 style={{ width: `${Math.min((summary?.critical || 0) / (summary?.total || 1) * 100, 100)}%` }} />
          </div>
        </div>
        
        {/* High */}
        <div className="stat-card rounded-2xl p-5 cursor-pointer group">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#f59e0b]/20 to-[#f59e0b]/5 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-xs text-[#6C6F75] mb-1">High</p>
              <p className="text-2xl font-bold text-[#f59e0b]">
                {summary?.high?.toLocaleString() || 0}
              </p>
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-[#f59e0b]/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] rounded-full" 
                 style={{ width: `${Math.min((summary?.high || 0) / (summary?.total || 1) * 100, 100)}%` }} />
          </div>
        </div>
        
        {/* Medium */}
        <div className="stat-card rounded-2xl p-5 cursor-pointer group">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#eab308]/20 to-[#eab308]/5 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-5 h-5 text-[#eab308]" />
            </div>
            <div>
              <p className="text-xs text-[#6C6F75] mb-1">Medium</p>
              <p className="text-2xl font-bold text-[#eab308]">
                {summary?.medium?.toLocaleString() || 0}
              </p>
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-[#eab308]/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#eab308] to-[#fde047] rounded-full" 
                 style={{ width: `${Math.min((summary?.medium || 0) / (summary?.total || 1) * 100, 100)}%` }} />
          </div>
        </div>
        
        {/* Low */}
        <div className="stat-card rounded-2xl p-5 cursor-pointer group">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#28C76F]/20 to-[#28C76F]/5 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5 text-[#28C76F]" />
            </div>
            <div>
              <p className="text-xs text-[#6C6F75] mb-1">Low</p>
              <p className="text-2xl font-bold text-[#28C76F]">
                {summary?.low?.toLocaleString() || 0}
              </p>
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-[#28C76F]/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#28C76F] to-[#4ade80] rounded-full" 
                 style={{ width: `${Math.min((summary?.low || 0) / (summary?.total || 1) * 100, 100)}%` }} />
          </div>
        </div>
        
        {/* Total - Featured */}
        <div className="stat-card rounded-2xl p-5 cursor-pointer group gradient-border animate-pulse-glow">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#FF6B9C]/20 to-[#7E57FF]/20 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5 text-[#FF6B9C]" />
            </div>
            <div>
              <p className="text-xs text-[#6C6F75] mb-1">Total Events</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-[#FF6B9C] to-[#7E57FF] bg-clip-text text-transparent">
                {summary?.total?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="card-glass rounded-2xl p-6 mb-6 animate-fadeInUp-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#E4E6EB]">Events Timeline</h2>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF4A64]" />
              <span className="text-xs text-[#6C6F75]">Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
              <span className="text-xs text-[#6C6F75]">High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
              <span className="text-xs text-[#6C6F75]">Medium</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF4A64" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#FF4A64" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="highGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="mediumGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="time" stroke="#3A3D47" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#3A3D47" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(26, 28, 36, 0.95)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}
              labelStyle={{ color: '#E4E6EB', fontWeight: 600 }}
              itemStyle={{ color: '#8D93A1' }}
            />
            <Area type="monotone" dataKey="critical" stackId="1" stroke="#FF4A64" strokeWidth={2} fill="url(#criticalGradient)" />
            <Area type="monotone" dataKey="high" stackId="1" stroke="#f59e0b" strokeWidth={2} fill="url(#highGradient)" />
            <Area type="monotone" dataKey="medium" stackId="1" stroke="#eab308" strokeWidth={2} fill="url(#mediumGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Main Grid: Hosts, Users, Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6 animate-fadeInUp-3">
        {/* Top Hosts */}
        <div className="card-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-[#7E57FF]" />
            <h2 className="text-sm font-semibold text-[#E4E6EB]">Top Hosts</h2>
          </div>
          <div className="space-y-2">
            {topHosts.map((host, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7E57FF]/20 to-[#7E57FF]/5 flex items-center justify-center text-xs font-bold text-[#7E57FF]">
                    {i + 1}
                  </div>
                  <span className="text-sm truncate max-w-[100px] text-[#E4E6EB] group-hover:text-white transition-colors">{host.host_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6C6F75]">{parseInt(host.count).toLocaleString()}</span>
                  {parseInt(host.critical) > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-[#FF4A64]/15 text-[#FF4A64] font-medium">
                      {host.critical}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {topHosts.length === 0 && <p className="text-xs text-[#6C6F75] text-center py-4">No hosts data</p>}
          </div>
        </div>

        {/* Top Users */}
        <div className="card-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-[#54A3FF]" />
            <h2 className="text-sm font-semibold text-[#E4E6EB]">Top Users</h2>
          </div>
          <div className="space-y-2">
            {topUsers.map((u, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#54A3FF]/20 to-[#54A3FF]/5 flex items-center justify-center text-xs font-bold text-[#54A3FF]">
                    {i + 1}
                  </div>
                  <span className="text-sm truncate max-w-[100px] text-[#E4E6EB] group-hover:text-white transition-colors">{u.user_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6C6F75]">{parseInt(u.count).toLocaleString()}</span>
                  {parseInt(u.critical) > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-[#FF4A64]/15 text-[#FF4A64] font-medium">
                      {u.critical}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {topUsers.length === 0 && <p className="text-xs text-[#6C6F75] text-center py-4">No users data</p>}
          </div>
        </div>

        {/* Sources Donut */}
        <div className="card-glass rounded-2xl p-5 h-[380px] flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[#FF6B9C]" />
            <h2 className="text-sm font-semibold text-[#E4E6EB]">Sources Distribution</h2>
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
                        fill="#E4E6EB" 
                        textAnchor={x > cx ? 'start' : 'end'} 
                        dominantBaseline="central"
                        fontSize={12}
                      >
                        {`${name} ${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                  labelLine={{ stroke: '#6C6F75', strokeWidth: 1 }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(26, 28, 36, 0.95)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                  }}
                  itemStyle={{ color: '#E4E6EB' }}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-[#E4E6EB] capitalize">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integrations & Sites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Integrations */}
        <div className="card-glass rounded-2xl p-5 h-[400px] flex flex-col">
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <Database className="w-4 h-4 text-[#54A3FF]" />
            <h2 className="text-sm font-semibold text-[#E4E6EB]">Integrations</h2>
          </div>
          <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
            {integrations.map((int, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#54A3FF]/10">
                    <Database className="w-5 h-5 text-[#54A3FF]" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-[#E4E6EB] block">{int.integration_name || int.integration_id.slice(0, 8)}</span>
                    <p className="text-xs capitalize text-[#6C6F75] mt-0.5">{int.source}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-[#E4E6EB]">{parseInt(int.count).toLocaleString()}</span>
                  {parseInt(int.critical) > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FF4A64]/15 text-[#FF4A64] font-medium">
                      {int.critical} Crit
                    </span>
                  )}
                </div>
              </div>
            ))}
            {integrations.length === 0 && <p className="text-sm text-[#6C6F75] text-center py-8">No integrations found</p>}
          </div>
        </div>

        {/* Sites */}
        <div className="card-glass rounded-2xl p-5 h-[400px] flex flex-col">
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            <Server className="w-4 h-4 text-[#7E57FF]" />
            <h2 className="text-sm font-semibold text-[#E4E6EB]">Sites</h2>
          </div>
          <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
            {sites.map((site, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#7E57FF]/10">
                    <Server className="w-5 h-5 text-[#7E57FF]" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-[#E4E6EB] block">{site.host_site_name}</span>
                    <p className="text-xs text-[#6C6F75] mt-0.5">{site.host_account_name || '-'}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-[#E4E6EB]">{parseInt(site.count).toLocaleString()}</span>
                  {parseInt(site.critical) > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FF4A64]/15 text-[#FF4A64] font-medium">
                      {site.critical} Crit
                    </span>
                  )}
                </div>
              </div>
            ))}
            {sites.length === 0 && <p className="text-sm text-[#6C6F75] text-center py-8">No sites found</p>}
          </div>
        </div>
      </div>

      {/* MITRE ATT&CK */}
      <div 
        className="rounded-[12px] p-5 mb-6 border"
        style={{ backgroundColor: '#1A1C24', borderColor: 'rgba(255,255,255,0.04)' }}
      >
        <h2 className="text-base font-semibold mb-3" style={{ color: '#E4E6EB' }}>MITRE ATT&CK Techniques</h2>
        {mitreData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mitreData.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" stroke="#6C6F75" fontSize={11} />
              <YAxis 
                dataKey="mitre_technique" 
                type="category" 
                stroke="#6C6F75" 
                fontSize={10} 
                width={120}
                tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 15) + '...' : v}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1A1C24', 
                  border: '1px solid rgba(255,255,255,0.07)', 
                  borderRadius: 8,
                  color: '#E4E6EB'
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Count']}
              />
              <Bar dataKey="count" fill="#7E57FF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-8" style={{ color: '#6C6F75' }}>No MITRE ATT&CK data available</p>
        )}
      </div>
    </div>
  );
}
