import { useEffect, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/api";
import { DateRangePicker } from "../../components/DateRangePicker";
import { Icon } from '../../shared/ui';

// Import vendor logos
import sentineloneLogo from '../../assets/logo/sentinelone.png';
import crowdstrikeLogo from '../../assets/logo/crowdstrike.png';

// Severity color mapping
const severityColors = {
  critical: '#FF0202',
  high: '#FFA735',
  medium: '#FFEE00',
  low: '#BBF0FF',
};

// Vendor Logo Components
// Vendor Logo Components
const VendorLogo = ({ source }: { source: string }) => {
  const sourceLower = source.toLowerCase();
  
  // ใช้ PNG logo สำหรับ vendors ที่มี
  if (sourceLower === 'sentinelone') {
    return (
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 p-2">
        <img src={sentineloneLogo} alt="SentinelOne" className="w-full h-full object-contain" />
      </div>
    );
  }
  
  if (sourceLower === 'crowdstrike') {
    return (
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 p-2">
        <img src={crowdstrikeLogo} alt="CrowdStrike" className="w-full h-full object-contain" />
      </div>
    );
  }
  
  // Fallback icons สำหรับ vendors อื่น
  const iconMap: Record<string, { icon: JSX.Element; color: string }> = {
    okta: { 
      icon: <Icon.Shield className="w-5 h-5" />, 
      color: '#54A3FF'
    },
    defender: { 
      icon: <Icon.Shield className="w-5 h-5" />, 
      color: '#3AA0FF'
    },
    imperva: { 
      icon: <Icon.Server className="w-5 h-5" />, 
      color: '#7E57FF'
    },
    default: { 
      icon: <Icon.Database className="w-5 h-5" />, 
      color: '#8D93A1'
    },
  };
  
  const logo = iconMap[sourceLower] || iconMap.default;
  
  return (
    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5" style={{ color: logo.color }}>
      {logo.icon}
    </div>
  );
};

interface Alert {
  id: string;
  title: string;
  severity: string;
  source: string;
  event_type: string;
  timestamp: string;
  host_name?: string;
  user_name?: string;
}

interface Summary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [endDate, setEndDate] = useState(() => new Date());

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    
    try {
      const [alertsRes, summaryRes] = await Promise.all([
        api.get(`/logs?startDate=${start}&endDate=${end}&limit=50`),
        api.get(`/dashboard/summary?startDate=${start}&endDate=${end}`),
      ]);
      setAlerts(alertsRes.data.data || []);
      setSummary(summaryRes.data);
    } catch (e) {
      console.error('Failed to load alerts:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  // คำนวณ alerts reduction (mock)
  const alertsReduction = summary ? 
    Math.round(((summary.total - (summary.critical + summary.high)) / summary.total) * 100) || 0 : 0;

  // คำนวณจำนวน incidents (critical + high)
  const incidents = summary ? summary.critical + summary.high : 0;

  const getSeverityStyle = (severity: string) => {
    const sev = severity.toLowerCase();
    if (sev === 'critical') {
      return {
        bg: severityColors.critical,
        text: 'rgb(255, 255, 255)',
        label: 'Critical',
      };
    }
    if (sev === 'high') {
      return {
        bg: severityColors.high,
        text: 'rgb(17, 19, 21)',
        label: 'High',
      };
    }
    if (sev === 'medium') {
      return {
        bg: severityColors.medium,
        text: 'rgb(17, 19, 21)',
        label: 'Medium',
      };
    }
    return {
      bg: severityColors.low,
      text: 'rgb(17, 19, 21)',
      label: 'Low',
    };
  };

  const getCategoryLabel = (source: string) => {
    const categoryMap: Record<string, string> = {
      sentinelone: 'Endpoint',
      crowdstrike: 'Endpoint',
      okta: 'Identity',
      defender: 'Endpoint',
      imperva: 'WAF',
    };
    const category = categoryMap[source.toLowerCase()] || 'Security';
    return `${category} | ${source}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Icon.Alert className="w-5 h-5 text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Alerts Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker 
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateChange}
            />
            <Button 
              size="sm"
              className="bg-content1 border border-white/5 text-foreground hover:border-white/10"
              onPress={() => navigate('/dashboard')}
            >
              Dashboard
            </Button>
          </div>
        </div>

        {/* Summary Panel */}
        <div className="bg-content1 border border-white/5 rounded-xl p-5 mb-6 grid grid-cols-3 gap-8">
          {/* Total Alerts */}
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${severityColors.critical}15` }}>
              <Icon.Alert className="w-5 h-5" style={{ color: severityColors.critical }} />
            </div>
            <div>
              <p className="text-3xl font-semibold text-foreground">
                {summary?.total?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-foreground/50">Total Alerts</p>
            </div>
          </div>

          {/* Critical + High */}
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${severityColors.high}15` }}>
              <Icon.ShieldAlert className="w-5 h-5" style={{ color: severityColors.high }} />
            </div>
            <div>
              <p className="text-3xl font-semibold text-foreground">
                {incidents.toLocaleString()}
              </p>
              <p className="text-sm text-foreground/50">Critical & High</p>
            </div>
          </div>

          {/* Alerts Reduction */}
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <Icon.TrendingDown className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-3xl font-semibold text-green-500">
                {alertsReduction}%
              </p>
              <p className="text-sm text-foreground/50">Reduction</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="px-6 pb-6 space-y-3">
        {alerts.length === 0 ? (
          <div className="bg-content1 border border-white/5 rounded-xl p-8 text-center">
            <p className="text-foreground/50">No alerts found for the selected date range</p>
          </div>
        ) : (
          alerts.map((alert, i) => {
            const severityStyle = getSeverityStyle(alert.severity);
            return (
              <div
                key={alert.id || i}
                className="bg-content1 border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center justify-between transition-all cursor-pointer group"
                onClick={() => navigate(`/logs?search=${encodeURIComponent(alert.title)}`)}
              >
                {/* Left: Logo + Content */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <VendorLogo source={alert.source} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate mb-1">
                      {alert.title}
                    </h3>
                    <p className="text-xs text-foreground/50">
                      {getCategoryLabel(alert.source)}
                    </p>
                  </div>
                </div>

                {/* Right: Severity Badge */}
                <div
                  className="px-3 py-1 rounded-lg text-xs font-semibold"
                  style={{ 
                    backgroundColor: severityStyle.bg,
                    color: severityStyle.text,
                  }}
                >
                  {severityStyle.label}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
