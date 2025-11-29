import { useEffect, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/api";
import { DateRangePicker } from "../../components/DateRangePicker";
import { 
  AlertTriangle, ShieldAlert, TrendingDown,
  Database, Globe, Lock
} from 'lucide-react';

// Import vendor logos
import sentineloneLogo from '../../assets/logo/sentinelone.png';
import crowdstrikeLogo from '../../assets/logo/crowdstrike.png';

// SOC/XDR Dark Theme Colors
const COLORS = {
  bgPrimary: '#0E0F14',
  bgPanel: '#1A1C24',
  bgSidebar: '#14151E',
  bgSummary: '#1C1E28',
  textPrimary: '#E4E6EB',
  textSecondary: '#8D93A1',
  textMuted: '#6C6F75',
  borderSoft: 'rgba(255,255,255,0.04)',
  borderMedium: 'rgba(255,255,255,0.07)',
  severityMalicious: '#FF4A64',
  severityBenign: '#28C76F',
  accentPink: '#FF6B9C',
  accentBlue: '#54A3FF',
  accentDefender: '#3AA0FF',
  accentPurple: '#7E57FF',
};

// Vendor Logo Components - ใช้ PNG สำหรับ vendors ที่มี logo
const VendorLogo = ({ source }: { source: string }) => {
  const sourceLower = source.toLowerCase();
  
  // ใช้ PNG logo สำหรับ vendors ที่มี
  if (sourceLower === 'sentinelone') {
    return (
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 p-2">
        <img src={sentineloneLogo} alt="SentinelOne" className="w-8 h-8 object-contain" />
      </div>
    );
  }
  
  if (sourceLower === 'crowdstrike') {
    return (
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 p-2">
        <img src={crowdstrikeLogo} alt="CrowdStrike" className="w-8 h-8 object-contain" />
      </div>
    );
  }
  
  // Fallback icons สำหรับ vendors อื่น
  const iconMap: Record<string, { icon: JSX.Element; bg: string; color: string }> = {
    okta: { 
      icon: <Lock className="w-6 h-6" />, 
      bg: 'rgba(84,163,255,0.15)', 
      color: '#54A3FF' 
    },
    defender: { 
      icon: <ShieldAlert className="w-6 h-6" />, 
      bg: 'rgba(58,160,255,0.15)', 
      color: '#3AA0FF' 
    },
    imperva: { 
      icon: <Globe className="w-6 h-6" />, 
      bg: 'rgba(126,87,255,0.15)', 
      color: '#7E57FF' 
    },
    default: { 
      icon: <Database className="w-6 h-6" />, 
      bg: 'rgba(141,147,161,0.15)', 
      color: '#8D93A1' 
    },
  };
  
  const logo = iconMap[sourceLower] || iconMap.default;
  
  return (
    <div 
      className="w-12 h-12 rounded-xl flex items-center justify-center"
      style={{ backgroundColor: logo.bg }}
    >
      <div style={{ color: logo.color }}>{logo.icon}</div>
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
    if (['critical', 'high'].includes(severity.toLowerCase())) {
      return {
        bg: COLORS.severityMalicious,
        text: '#FFFFFF',
        label: 'Malicious',
        glow: '0 0 8px rgba(255, 70, 100, 0.55)'
      };
    }
    return {
      bg: COLORS.severityBenign,
      text: '#FFFFFF',
      label: 'Benign',
      glow: '0 0 8px rgba(40, 199, 111, 0.45)'
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
      <div 
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: COLORS.bgPrimary }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bgPrimary }}>
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(255,107,156,0.15)' }}
            >
              <AlertTriangle className="w-6 h-6" style={{ color: COLORS.accentPink }} />
            </div>
            <h1 className="text-xl font-semibold" style={{ color: COLORS.textPrimary }}>
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
              variant="flat" 
              className="bg-[#1C1E28] border border-white/5 text-[#E4E6EB]"
              onPress={() => navigate('/dashboard')}
            >
              Dashboard
            </Button>
          </div>
        </div>

        {/* Summary Panel */}
        <div 
          className="rounded-[14px] p-5 mb-6 flex items-center justify-between"
          style={{ 
            backgroundColor: COLORS.bgSummary,
            border: `1px solid ${COLORS.borderSoft}`,
            boxShadow: '0px 2px 15px rgba(0,0,0,0.30)'
          }}
        >
          {/* Alerts */}
          <div className="flex items-center gap-4">
            <div 
              className="p-3 rounded-full"
              style={{ backgroundColor: 'rgba(255,107,156,0.15)' }}
            >
              <AlertTriangle className="w-6 h-6" style={{ color: COLORS.accentPink }} />
            </div>
            <div>
              <p className="text-3xl font-semibold" style={{ color: COLORS.textPrimary }}>
                {summary?.total?.toLocaleString() || 0}
              </p>
              <p className="text-sm" style={{ color: COLORS.textSecondary }}>Alerts</p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-12 w-px" style={{ backgroundColor: COLORS.borderMedium }} />

          {/* Incidents */}
          <div className="flex items-center gap-4">
            <div 
              className="p-3 rounded-full"
              style={{ backgroundColor: 'rgba(255,74,100,0.15)' }}
            >
              <ShieldAlert className="w-6 h-6" style={{ color: COLORS.severityMalicious }} />
            </div>
            <div>
              <p className="text-3xl font-semibold" style={{ color: COLORS.textPrimary }}>
                {incidents.toLocaleString()}
              </p>
              <p className="text-sm" style={{ color: COLORS.textSecondary }}>Incidents</p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-12 w-px" style={{ backgroundColor: COLORS.borderMedium }} />

          {/* Alerts Reduction */}
          <div className="flex items-center gap-4">
            <div 
              className="p-3 rounded-full"
              style={{ backgroundColor: 'rgba(40,199,111,0.15)' }}
            >
              <TrendingDown className="w-6 h-6" style={{ color: COLORS.severityBenign }} />
            </div>
            <div>
              <p className="text-3xl font-semibold" style={{ color: COLORS.severityBenign }}>
                {alertsReduction}%
              </p>
              <p className="text-sm" style={{ color: COLORS.textSecondary }}>Alerts reduction</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="px-6 pb-6 space-y-4">
        {alerts.length === 0 ? (
          <div 
            className="rounded-[12px] p-8 text-center"
            style={{ backgroundColor: COLORS.bgPanel, border: `1px solid ${COLORS.borderSoft}` }}
          >
            <p style={{ color: COLORS.textMuted }}>No alerts found for the selected date range</p>
          </div>
        ) : (
          alerts.map((alert, i) => {
            const severityStyle = getSeverityStyle(alert.severity);
            return (
              <div
                key={alert.id || i}
                className="rounded-[12px] p-5 flex items-center justify-between transition-all cursor-pointer hover:border-white/10"
                style={{ 
                  backgroundColor: COLORS.bgPanel,
                  border: `1px solid ${COLORS.borderSoft}`,
                  boxShadow: '0px 2px 15px rgba(0,0,0,0.30)'
                }}
                onClick={() => navigate(`/logs?search=${encodeURIComponent(alert.title)}`)}
              >
                {/* Left: Logo + Content */}
                <div className="flex items-center gap-4 flex-1">
                  <VendorLogo source={alert.source} />
                  <div className="flex-1 min-w-0">
                    <h3 
                      className="text-base font-semibold truncate mb-1"
                      style={{ color: COLORS.textPrimary }}
                    >
                      {alert.title}
                    </h3>
                    <p className="text-sm" style={{ color: COLORS.textSecondary }}>
                      {getCategoryLabel(alert.source)}
                    </p>
                  </div>
                </div>

                {/* Right: Status Pill */}
                <div
                  className="px-4 py-1.5 rounded-full text-sm font-bold"
                  style={{ 
                    backgroundColor: severityStyle.bg,
                    color: severityStyle.text,
                    boxShadow: severityStyle.glow
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
