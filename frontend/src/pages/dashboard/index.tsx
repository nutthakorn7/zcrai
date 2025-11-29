import { useEffect, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { useAuth } from "../../shared/store/useAuth";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";
import { DateRangePicker } from "../../components/DateRangePicker";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { 
  ShieldAlert, AlertTriangle, AlertCircle, Activity, 
  Server, Database, TrendingUp
} from 'lucide-react';

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
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { setPageContext } = usePageContext();
  
  const [loading, setLoading] = useState(true);
  // Date Range State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [endDate, setEndDate] = useState(() => new Date());
  
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topHosts, setTopHosts] = useState<TopHost[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [sources, setSources] = useState<SourceBreakdown[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [mitreData, setMitreData] = useState<MitreData[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [sites, setSites] = useState<SiteData[]>([]);

  useEffect(() => {
    loadDashboard();
  }, [startDate, endDate]);

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const loadDashboard = async () => {
    setLoading(true);
    // Format dates as ISO strings for API
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    const dateParams = `startDate=${start}&endDate=${end}`;
    
    try {
      const [summaryRes, hostsRes, usersRes, sourcesRes, timelineRes, mitreRes, intRes, sitesRes] = await Promise.all([
        api.get(`/dashboard/summary?${dateParams}`),
        api.get(`/dashboard/top-hosts?${dateParams}&limit=5`),
        api.get(`/dashboard/top-users?${dateParams}&limit=5`),
        api.get(`/dashboard/sources?${dateParams}`),
        api.get(`/dashboard/timeline?${dateParams}&interval=day`),
        api.get(`/dashboard/mitre-heatmap?${dateParams}`),
        api.get(`/dashboard/integrations?${dateParams}`),
        api.get(`/dashboard/sites?${dateParams}`),
      ]);
      setSummary(summaryRes.data);
      setTopHosts(hostsRes.data);
      setTopUsers(usersRes.data);
      setSources(sourcesRes.data);
      setTimeline(timelineRes.data);
      setMitreData(mitreRes.data);
      setIntegrations(intRes.data);
      setSites(sitesRes.data);
      
      // Update Page Context for AI Assistant
      setPageContext({
        pageName: 'Dashboard',
        pageDescription: 'Security monitoring dashboard showing alerts and events summary',
        data: {
          stats: {
            totalEvents: summaryRes.data?.total || 0,
            criticalAlerts: summaryRes.data?.critical || 0,
            highAlerts: summaryRes.data?.high || 0,
            mediumAlerts: summaryRes.data?.medium || 0,
            lowAlerts: summaryRes.data?.low || 0,
          },
          topThreats: hostsRes.data?.slice(0, 5).map((h: TopHost) => ({
            name: h.host_name,
            count: parseInt(h.count),
            critical: parseInt(h.critical),
            high: parseInt(h.high)
          })),
          topUsers: usersRes.data?.slice(0, 5),
          sources: sourcesRes.data,
          timeRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        }
      });
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
      <div className="flex items-center justify-center min-h-screen dark bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: '#0E0F14' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#E4E6EB' }}>
          Security Dashboard
        </h1>
        <div className="flex items-center gap-3">
          {/* Tenant Selector สำหรับ Super Admin */}
          {user?.role === 'superadmin' && (
            <Button 
              size="sm" 
              variant="flat" 
              className="bg-[#1C1E28] border border-white/5 text-[#E4E6EB]"
              onPress={() => navigate('/admin')}
            >
              Admin Panel
            </Button>
          )}
          <DateRangePicker 
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
          />
          <Button size="sm" variant="flat" className="bg-[#1C1E28] border border-white/5 text-[#E4E6EB]" onPress={() => navigate('/logs')}>
            Log Viewer
          </Button>
          <Button size="sm" variant="flat" className="bg-[#1C1E28] border border-white/5 text-[#E4E6EB]" onPress={() => navigate('/settings')}>
            Settings
          </Button>
          <span className="text-sm" style={{ color: '#8D93A1' }}>{user?.email}</span>
          <Button color="danger" variant="light" size="sm" onPress={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
      
      {/* Summary Panel */}
      <div 
        className="rounded-[14px] p-6 mb-6 border"
        style={{ 
          backgroundColor: '#1C1E28',
          borderColor: 'rgba(255,255,255,0.04)',
          boxShadow: '0px 2px 15px rgba(0,0,0,0.30)'
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {/* Critical */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(255, 74, 100, 0.15)' }}>
              <ShieldAlert className="w-6 h-6" style={{ color: '#FF4A64' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: '#8D93A1' }}>Critical Alerts</p>
              <p className="text-2xl font-semibold" style={{ color: '#FF4A64' }}>
                {summary?.critical?.toLocaleString() || 0}
              </p>
            </div>
          </div>
          
          {/* High */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}>
              <AlertTriangle className="w-6 h-6" style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: '#8D93A1' }}>High Alerts</p>
              <p className="text-2xl font-semibold" style={{ color: '#f59e0b' }}>
                {summary?.high?.toLocaleString() || 0}
              </p>
            </div>
          </div>
          
          {/* Medium */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)' }}>
              <AlertCircle className="w-6 h-6" style={{ color: '#eab308' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: '#8D93A1' }}>Medium Alerts</p>
              <p className="text-2xl font-semibold" style={{ color: '#eab308' }}>
                {summary?.medium?.toLocaleString() || 0}
              </p>
            </div>
          </div>
          
          {/* Low */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(40, 199, 111, 0.15)' }}>
              <Activity className="w-6 h-6" style={{ color: '#28C76F' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: '#8D93A1' }}>Low Alerts</p>
              <p className="text-2xl font-semibold" style={{ color: '#28C76F' }}>
                {summary?.low?.toLocaleString() || 0}
              </p>
            </div>
          </div>
          
          {/* Total */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(255, 107, 156, 0.15)' }}>
              <TrendingUp className="w-6 h-6" style={{ color: '#FF6B9C' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: '#8D93A1' }}>Total Events</p>
              <p className="text-2xl font-semibold" style={{ color: '#E4E6EB' }}>
                {summary?.total?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div 
        className="rounded-[12px] p-5 mb-6 border"
        style={{ 
          backgroundColor: '#1A1C24',
          borderColor: 'rgba(255,255,255,0.04)'
        }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#E4E6EB' }}>Events Timeline</h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" stroke="#6C6F75" fontSize={11} />
            <YAxis stroke="#6C6F75" fontSize={11} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1A1C24', 
                border: '1px solid rgba(255,255,255,0.07)', 
                borderRadius: 8,
                color: '#E4E6EB'
              }}
              labelStyle={{ color: '#8D93A1' }}
            />
            <Legend wrapperStyle={{ color: '#8D93A1' }} />
            <Area type="monotone" dataKey="critical" stackId="1" stroke="#FF4A64" fill="#FF4A64" fillOpacity={0.6} />
            <Area type="monotone" dataKey="high" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
            <Area type="monotone" dataKey="medium" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Main Grid: Hosts, Users, Sources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Top Hosts */}
        <div 
          className="rounded-[12px] p-5 border"
          style={{ backgroundColor: '#1A1C24', borderColor: 'rgba(255,255,255,0.04)' }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: '#E4E6EB' }}>Top Hosts</h2>
          <div className="space-y-2">
            {topHosts.map((host, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span className="text-sm truncate max-w-[120px]" style={{ color: '#E4E6EB' }}>{host.host_name}</span>
                <div className="flex gap-3">
                  <span className="text-xs" style={{ color: '#8D93A1' }}>{parseInt(host.count).toLocaleString()}</span>
                  {parseInt(host.critical) > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: 'rgba(255,74,100,0.15)', color: '#FF4A64' }}>
                      {host.critical}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {topHosts.length === 0 && <p className="text-xs" style={{ color: '#6C6F75' }}>No hosts</p>}
          </div>
        </div>

        {/* Top Users */}
        <div 
          className="rounded-[12px] p-5 border"
          style={{ backgroundColor: '#1A1C24', borderColor: 'rgba(255,255,255,0.04)' }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: '#E4E6EB' }}>Top Users</h2>
          <div className="space-y-2">
            {topUsers.map((u, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span className="text-sm truncate max-w-[120px]" style={{ color: '#E4E6EB' }}>{u.user_name}</span>
                <div className="flex gap-3">
                  <span className="text-xs" style={{ color: '#8D93A1' }}>{parseInt(u.count).toLocaleString()}</span>
                  {parseInt(u.critical) > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: 'rgba(255,74,100,0.15)', color: '#FF4A64' }}>
                      {u.critical}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {topUsers.length === 0 && <p className="text-xs" style={{ color: '#6C6F75' }}>No users</p>}
          </div>
        </div>

        {/* Sources Pie */}
        <div 
          className="rounded-[12px] p-5 border"
          style={{ backgroundColor: '#1A1C24', borderColor: 'rgba(255,255,255,0.04)' }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: '#E4E6EB' }}>Sources</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                label={({ name, value }: any) => `${name || ''}`}
                labelLine={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1A1C24', 
                  border: '1px solid rgba(255,255,255,0.07)', 
                  borderRadius: 8,
                  color: '#E4E6EB'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Integrations & Sites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Integrations */}
        <div 
          className="rounded-[12px] p-5 border"
          style={{ backgroundColor: '#1A1C24', borderColor: 'rgba(255,255,255,0.04)' }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: '#E4E6EB' }}>Integrations</h2>
          <div className="space-y-2">
            {integrations.map((int, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(84,163,255,0.15)' }}>
                    <Database className="w-4 h-4" style={{ color: '#54A3FF' }} />
                  </div>
                  <div>
                    <span className="text-sm" style={{ color: '#E4E6EB' }}>{int.integration_name || int.integration_id.slice(0, 8)}</span>
                    <p className="text-xs capitalize" style={{ color: '#6C6F75' }}>{int.source}</p>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="text-xs" style={{ color: '#8D93A1' }}>{parseInt(int.count).toLocaleString()}</span>
                  {parseInt(int.critical) > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: 'rgba(255,74,100,0.15)', color: '#FF4A64' }}>
                      {int.critical}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {integrations.length === 0 && <p className="text-xs" style={{ color: '#6C6F75' }}>No integrations</p>}
          </div>
        </div>

        {/* S1 Sites */}
        <div 
          className="rounded-[12px] p-5 border"
          style={{ backgroundColor: '#1A1C24', borderColor: 'rgba(255,255,255,0.04)' }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: '#E4E6EB' }}>SentinelOne Sites</h2>
          <div className="space-y-2">
            {sites.map((site, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(126,87,255,0.15)' }}>
                    <Server className="w-4 h-4" style={{ color: '#7E57FF' }} />
                  </div>
                  <div>
                    <span className="text-sm" style={{ color: '#E4E6EB' }}>{site.host_site_name}</span>
                    <p className="text-xs" style={{ color: '#6C6F75' }}>{site.host_account_name || '-'}</p>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="text-xs" style={{ color: '#8D93A1' }}>{parseInt(site.count).toLocaleString()}</span>
                  {parseInt(site.critical) > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: 'rgba(255,74,100,0.15)', color: '#FF4A64' }}>
                      {site.critical}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {sites.length === 0 && <p className="text-xs" style={{ color: '#6C6F75' }}>No sites</p>}
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

      {/* Actions */}
      <div className="flex gap-3">
        <Button 
          className="text-white"
          style={{ backgroundColor: '#7E57FF' }}
          onPress={() => navigate('/logs')}
        >
          View Logs
        </Button>
        <Button 
          variant="flat" 
          className="bg-[#1C1E28] border border-white/5 text-[#E4E6EB]"
          onPress={loadDashboard}
        >
          Refresh
        </Button>
        <Button 
          variant="flat" 
          className="bg-[#1C1E28] border border-white/5 text-[#E4E6EB]"
          onPress={() => navigate('/settings')}
        >
          Settings
        </Button>
      </div>
    </div>
  );
}
