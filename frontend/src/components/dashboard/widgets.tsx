import React, { useState, useEffect } from 'react';
import { Chip, Spinner } from '@heroui/react';
import { api } from '../../shared/api/api';
import { Icon } from '../../shared/ui';
import { 
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip
} from 'recharts';

// Color palette

const SEVERITY_COLORS = {
  critical: '#FF0202',
  high: '#FFA735',
  medium: '#FFEE00',
  low: '#BBF0FF',
  info: '#3B82F6',
};

const SOURCE_COLORS: Record<string, string> = {
  crowdstrike: '#EF4444',
  sentinelone: '#A855F7',
  'aws-cloudtrail': '#F59E0B',
  m365: '#3B82F6',
};

interface WidgetProps {
  className?: string;
}

// ============ STATS WIDGET ============
export function StatsWidget({ className }: WidgetProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/metrics');
        setData(res.data);
      } catch (e) {
        console.error('Failed to fetch stats:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <WidgetLoading />;

  const stats = [
    { label: 'Total Alerts', value: data?.alertCount ?? 0, color: 'text-primary', icon: Icon.Bell },
    { label: 'Critical', value: data?.bySeverity?.critical ?? 0, color: 'text-danger', icon: Icon.Alert },
    { label: 'High', value: data?.bySeverity?.high ?? 0, color: 'text-warning', icon: Icon.ShieldAlert },
    { label: 'Active Cases', value: data?.caseCount ?? 0, color: 'text-success', icon: Icon.Folder },
  ];

  return (
    <div className={`grid grid-cols-4 gap-3 h-full ${className}`}>
      {stats.map((stat, i) => (
        <div key={i} className="bg-content2/50 rounded-lg p-3 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <span className="text-xs text-default-500">{stat.label}</span>
          </div>
          <span className={`text-2xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ============ TIMELINE WIDGET ============
export function TimelineWidget({ className }: WidgetProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await api.get('/dashboard/metrics');
        setData(res.data?.timeline ?? []);
      } catch (e) {
        console.error('Failed to fetch timeline:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, []);

  if (loading) return <WidgetLoading />;

  return (
    <div className={`h-full ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Events Over Time</span>
        <Chip size="sm" variant="flat">Last 7 Days</Chip>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10, fill: '#888' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 10, fill: '#888' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a2e', 
              border: '1px solid #333',
              borderRadius: 8 
            }}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke="#6366F1" 
            fillOpacity={1} 
            fill="url(#colorEvents)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============ SEVERITY PIE WIDGET ============
export function SeverityPieWidget({ className }: WidgetProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/dashboard/metrics');
        const bySev = res.data?.bySeverity ?? {};
        const pieData = Object.entries(bySev).map(([name, value]) => ({
          name,
          value: value as number,
          color: SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS] || '#666'
        }));
        setData(pieData);
      } catch (e) {
        console.error('Failed to fetch severity data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <WidgetLoading />;

  return (
    <div className={`h-full ${className}`}>
      <span className="text-sm font-medium">By Severity</span>
      <ResponsiveContainer width="100%" height="80%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={60}
            paddingAngle={2}
            dataKey="value"
            label={({ name }) => name}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 justify-center">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs capitalize">{item.name}: {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ ALERTS FEED WIDGET ============
export function AlertsFeedWidget({ className }: WidgetProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await api.get('/alerts?limit=5&sortBy=createdAt&sortDir=desc');
        setAlerts(res.data?.data ?? []);
      } catch (e) {
        console.error('Failed to fetch alerts:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  if (loading) return <WidgetLoading />;

  const getSeverityColor = (sev: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-400',
      high: 'bg-orange-500/20 text-orange-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-blue-500/20 text-blue-400',
    };
    return colors[sev] || 'bg-default-100';
  };

  return (
    <div className={`h-full overflow-hidden ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Recent Alerts</span>
        <Icon.Bell className="w-4 h-4 text-default-400" />
      </div>
      <div className="space-y-2 overflow-y-auto max-h-[calc(100%-2rem)]">
        {alerts.length === 0 ? (
          <p className="text-xs text-default-500 text-center py-4">No recent alerts</p>
        ) : (
          alerts.map((alert, i) => (
            <div key={i} className="p-2 bg-content2/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium truncate flex-1">{alert.name || alert.title}</span>
                <Chip size="sm" className={getSeverityColor(alert.severity)}>
                  {alert.severity}
                </Chip>
              </div>
              <p className="text-xs text-default-500 line-clamp-1">{alert.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============ TOP HOSTS WIDGET ============
export function TopHostsWidget({ className }: WidgetProps) {
  const [hosts, setHosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHosts = async () => {
      try {
        const res = await api.get('/dashboard/metrics');
        setHosts(res.data?.topHosts ?? []);
      } catch (e) {
        console.error('Failed to fetch hosts:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchHosts();
  }, []);

  if (loading) return <WidgetLoading />;

  return (
    <div className={`h-full ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Top Hosts</span>
        <Icon.Server className="w-4 h-4 text-default-400" />
      </div>
      <div className="space-y-2">
        {hosts.length === 0 ? (
          <p className="text-xs text-default-500 text-center py-4">No host data</p>
        ) : (
          hosts.slice(0, 5).map((host, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-content2/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                  <Icon.Server className="w-3 h-3 text-primary" />
                </div>
                <span className="text-xs font-medium">{host.hostname || host.name || `Host ${i+1}`}</span>
              </div>
              <Chip size="sm" variant="flat">{host.count || host.alertCount || 0}</Chip>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============ SOURCES DONUT WIDGET ============
export function SourcesDonutWidget({ className }: WidgetProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/dashboard/metrics');
        const bySource = res.data?.bySource ?? {};
        const pieData = Object.entries(bySource).map(([name, value]) => ({
          name,
          value: value as number,
          color: SOURCE_COLORS[name] || '#666'
        }));
        setData(pieData);
      } catch (e) {
        console.error('Failed to fetch source data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <WidgetLoading />;

  return (
    <div className={`h-full ${className}`}>
      <span className="text-sm font-medium">By Source</span>
      <ResponsiveContainer width="100%" height="75%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={35}
            outerRadius={55}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 justify-center">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs">{item.name}: {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ LOADING STATE ============
function WidgetLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <Spinner size="sm" />
    </div>
  );
}

// ============ WIDGET RENDERER ============
export function WidgetRenderer({ type, className }: { type: string; className?: string }) {
  // Handle custom widgets
  if (type.startsWith('custom-')) {
    const CustomWidget = React.lazy(() => import('./CustomWidget'));
    const widgetId = type.replace('custom-', '');
    return (
      <React.Suspense fallback={<WidgetLoading />}>
        <CustomWidget widgetId={widgetId} className={className} />
      </React.Suspense>
    );
  }

  switch (type) {
    case 'stats':
      return <StatsWidget className={className} />;
    case 'timeline':
      return <TimelineWidget className={className} />;
    case 'severity-pie':
      return <SeverityPieWidget className={className} />;
    case 'alerts-feed':
      return <AlertsFeedWidget className={className} />;
    case 'top-hosts':
      return <TopHostsWidget className={className} />;
    case 'sources-donut':
      return <SourcesDonutWidget className={className} />;
    default:
      return (
        <div className="h-full flex items-center justify-center text-default-500">
          <div className="text-center">
            <Icon.Chart className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Unknown Widget: {type}</p>
          </div>
        </div>
      );
  }
}

