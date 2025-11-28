import { useEffect, useState } from "react";
import { 
  Card, CardBody, Button, Spinner, Table, TableHeader, TableColumn, 
  TableBody, TableRow, TableCell, Select, SelectItem
} from "@heroui/react";
import { useAuth } from "../../shared/store/useAuth";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/api";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';

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
  
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
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
  }, [days]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [summaryRes, hostsRes, usersRes, sourcesRes, timelineRes, mitreRes, intRes, sitesRes] = await Promise.all([
        api.get(`/dashboard/summary?days=${days}`),
        api.get(`/dashboard/top-hosts?days=${days}&limit=5`),
        api.get(`/dashboard/top-users?days=${days}&limit=5`),
        api.get(`/dashboard/sources?days=${days}`),
        api.get(`/dashboard/timeline?days=${days}&interval=day`),
        api.get(`/dashboard/mitre-heatmap?days=${days}`),
        api.get(`/dashboard/integrations?days=${days}`),
        api.get(`/dashboard/sites?days=${days}`),
      ]);
      setSummary(summaryRes.data);
      setTopHosts(hostsRes.data);
      setTopUsers(usersRes.data);
      setSources(sourcesRes.data);
      setTimeline(timelineRes.data);
      setMitreData(mitreRes.data);
      setIntegrations(intRes.data);
      setSites(sitesRes.data);
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
    <div className="p-6 min-h-screen dark bg-background text-foreground">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          zcrAI Dashboard
        </h1>
        <div className="flex items-center gap-4">
          <Select
            label="Time Range"
            selectedKeys={[days.toString()]}
            onSelectionChange={(keys) => setDays(parseInt(Array.from(keys)[0] as string))}
            className="w-32"
            size="sm"
          >
            <SelectItem key="1">1 Day</SelectItem>
            <SelectItem key="7">7 Days</SelectItem>
            <SelectItem key="30">30 Days</SelectItem>
            <SelectItem key="90">90 Days</SelectItem>
          </Select>
          <p className="text-sm">Welcome, {user?.email}</p>
          <Button color="danger" variant="light" size="sm" onPress={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card className="bg-red-500/10 border border-red-500/30">
          <CardBody className="text-center py-4">
            <p className="text-xs text-red-400">Critical</p>
            <p className="text-2xl font-bold text-red-500">{summary?.critical || 0}</p>
          </CardBody>
        </Card>
        <Card className="bg-orange-500/10 border border-orange-500/30">
          <CardBody className="text-center py-4">
            <p className="text-xs text-orange-400">High</p>
            <p className="text-2xl font-bold text-orange-500">{summary?.high || 0}</p>
          </CardBody>
        </Card>
        <Card className="bg-yellow-500/10 border border-yellow-500/30">
          <CardBody className="text-center py-4">
            <p className="text-xs text-yellow-400">Medium</p>
            <p className="text-2xl font-bold text-yellow-500">{summary?.medium || 0}</p>
          </CardBody>
        </Card>
        <Card className="bg-blue-500/10 border border-blue-500/30">
          <CardBody className="text-center py-4">
            <p className="text-xs text-blue-400">Low</p>
            <p className="text-2xl font-bold text-blue-500">{summary?.low || 0}</p>
          </CardBody>
        </Card>
        <Card className="bg-slate-500/10 border border-slate-500/30">
          <CardBody className="text-center py-4">
            <p className="text-xs text-slate-400">Total</p>
            <p className="text-2xl font-bold">{summary?.total || 0}</p>
          </CardBody>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card className="bg-content1 mb-6">
        <CardBody>
          <h2 className="text-lg font-bold mb-4">Events Timeline</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
              <Area type="monotone" dataKey="high" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
              <Area type="monotone" dataKey="medium" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      {/* Main Grid: Hosts, Users, Sources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Top Hosts */}
        <Card className="bg-content1">
          <CardBody>
            <h2 className="text-lg font-bold mb-3">Top Hosts</h2>
            <Table aria-label="Top hosts" removeWrapper isCompact>
              <TableHeader>
                <TableColumn>Host</TableColumn>
                <TableColumn>Events</TableColumn>
                <TableColumn>Crit</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No hosts">
                {topHosts.map((host, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs truncate max-w-[120px]">{host.host_name}</TableCell>
                    <TableCell className="text-xs">{host.count}</TableCell>
                    <TableCell className="text-xs text-danger">{host.critical}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        {/* Top Users */}
        <Card className="bg-content1">
          <CardBody>
            <h2 className="text-lg font-bold mb-3">Top Users</h2>
            <Table aria-label="Top users" removeWrapper isCompact>
              <TableHeader>
                <TableColumn>User</TableColumn>
                <TableColumn>Events</TableColumn>
                <TableColumn>Crit</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No users">
                {topUsers.map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs truncate max-w-[120px]">{u.user_name}</TableCell>
                    <TableCell className="text-xs">{u.count}</TableCell>
                    <TableCell className="text-xs text-danger">{u.critical}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        {/* Sources Pie */}
        <Card className="bg-content1">
          <CardBody>
            <h2 className="text-lg font-bold mb-3">Sources</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, value }: any) => `${name || ''} (${value?.toLocaleString() || 0})`}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Integrations & Sites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Integrations */}
        <Card className="bg-content1">
          <CardBody>
            <h2 className="text-lg font-bold mb-3">Integrations</h2>
            <Table aria-label="Integrations" removeWrapper isCompact>
              <TableHeader>
                <TableColumn>Integration</TableColumn>
                <TableColumn>Source</TableColumn>
                <TableColumn>Events</TableColumn>
                <TableColumn>Crit</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No integrations">
                {integrations.map((int, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs truncate max-w-[100px]">{int.integration_name || int.integration_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs capitalize">{int.source}</TableCell>
                    <TableCell className="text-xs">{int.count}</TableCell>
                    <TableCell className="text-xs text-danger">{int.critical}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        {/* S1 Sites */}
        <Card className="bg-content1">
          <CardBody>
            <h2 className="text-lg font-bold mb-3">SentinelOne Sites</h2>
            <Table aria-label="Sites" removeWrapper isCompact>
              <TableHeader>
                <TableColumn>Account</TableColumn>
                <TableColumn>Site</TableColumn>
                <TableColumn>Events</TableColumn>
                <TableColumn>Crit</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No sites">
                {sites.map((site, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs truncate max-w-[80px]">{site.host_account_name || '-'}</TableCell>
                    <TableCell className="text-xs truncate max-w-[100px]">{site.host_site_name}</TableCell>
                    <TableCell className="text-xs">{site.count}</TableCell>
                    <TableCell className="text-xs text-danger">{site.critical}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>

      {/* MITRE ATT&CK */}
      <Card className="bg-content1 mb-6">
        <CardBody>
          <h2 className="text-lg font-bold mb-3">MITRE ATT&CK Techniques</h2>
          {mitreData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mitreData.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis 
                  dataKey="mitre_technique" 
                  type="category" 
                  stroke="#9ca3af" 
                  fontSize={10} 
                  width={120}
                  tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 15) + '...' : v}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                  formatter={(value: number) => [value, 'Count']}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-default-500 py-8">No MITRE ATT&CK data available</p>
          )}
        </CardBody>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button color="primary" variant="shadow" onPress={() => navigate('/logs')}>
          📋 View Logs
        </Button>
        <Button color="secondary" variant="flat" onPress={loadDashboard}>
          🔄 Refresh
        </Button>
        <Button color="default" variant="flat" onPress={() => navigate('/settings')}>
          ⚙️ Settings
        </Button>
      </div>
    </div>
  );
}
