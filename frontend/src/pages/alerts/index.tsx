import { useEffect, useState } from "react";
import { Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Tooltip } from "@heroui/react";
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
const VendorLogo = ({ source }: { source: string }) => {
  const sourceLower = source.toLowerCase();
  
  // ใช้ PNG logo สำหรับ vendors ที่มี
  if (sourceLower === 'sentinelone') {
    return (
      <div className="w-8 h-8 rounded-md flex items-center justify-center border border-white/5 bg-purple-500/20 p-1.5">
        <img src={sentineloneLogo} alt="S1" className="w-full h-full object-contain" />
      </div>
    );
  }
  
  if (sourceLower === 'crowdstrike') {
    return (
      <div className="w-8 h-8 rounded-md flex items-center justify-center border border-white/5 bg-red-500/20 p-1.5">
        <img src={crowdstrikeLogo} alt="CS" className="w-full h-full object-contain" />
      </div>
    );
  } 
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
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Include all of today's data
    return d;
  });
  
  // Filter State: 'all', 'sentinelone', 'crowdstrike'
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, selectedProvider]);

  const loadData = async () => {
    setLoading(true);
    // Use local date string to avoid timezone issues
    const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    
    try {
      // Fetch active integrations to determine sources filter
      const activeIntRes = await api.get('/integrations');
      const activeIntegrations = activeIntRes.data || [];
      
      const activeProviders = activeIntegrations
        .map((i: any) => i.provider.toLowerCase())
        .filter((p: string) => ['sentinelone', 'crowdstrike'].includes(p));
        
      const uniqueActiveProviders = Array.from(new Set(activeProviders)) as string[];
      setAvailableProviders(uniqueActiveProviders);
      
      // Determine target sources based on selected provider
      let targetSources = uniqueActiveProviders;
      if (selectedProvider !== 'all') {
        targetSources = [selectedProvider];
      }
      
      // Build sources parameter (same logic as Dashboard)
      let sourcesParam = '';
      if (targetSources.length > 0) {
        sourcesParam = `&sources=${targetSources.join(',')}`;
      } else if (selectedProvider === 'all') {
        sourcesParam = '&sources=none';
      } else {
        sourcesParam = `&sources=${selectedProvider}`;
      }
      
      const [alertsRes, summaryRes] = await Promise.all([
        api.get(`/logs?startDate=${start}&endDate=${end}&limit=50${sourcesParam}`),
        api.get(`/dashboard/summary?startDate=${start}&endDate=${end}${sourcesParam}`),
      ]);
      
      setAlerts(alertsRes.data.data || []);
      const summaryData = summaryRes.data;
      
      // Validate total = critical + high + medium + low (same validation as Dashboard)
      if (summaryData?.critical !== undefined && summaryData?.high !== undefined && 
          summaryData?.medium !== undefined && summaryData?.low !== undefined) {
        const calculatedTotal = summaryData.critical + summaryData.high + summaryData.medium + summaryData.low;
        if (summaryData.total !== calculatedTotal) {
          console.warn(`❌ Alerts Page Data Mismatch: Backend returned total ${summaryData.total}, but sum of severities is ${calculatedTotal}`);
          summaryData.total = calculatedTotal;
        }
      }
      
      setSummary(summaryData);
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


  const renderCell = (alert: Alert, columnKey: string) => {
    switch (columnKey) {
      case "time":
        const dateObj = new Date(alert.timestamp);
        const time = dateObj.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: false 
        });
        const date = dateObj.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        });
        return (
          <div className="flex flex-col">
            <span className="text-sm text-foreground/70">{time}</span>
            <span className="text-[10px] text-foreground/40">{date}</span>
          </div>
        );
      
      case "source":
        return <VendorLogo source={alert.source} />;
      
      case "details":
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground/80">{alert.title}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-foreground/50">
              {alert.host_name && (
                <div className="flex items-center gap-1.5">
                  <Icon.Server className="w-3 h-3" />
                  <span>{alert.host_name}</span>
                </div>
              )}
              {alert.user_name && (
                <div className="flex items-center gap-1.5">
                  <Icon.User className="w-3 h-3" />
                  <span>{alert.user_name}</span>
                </div>
              )}
            </div>
          </div>
        );
      
      case "severity":
        const sev = alert.severity.toLowerCase() as keyof typeof severityColors;
        const hexColor = severityColors[sev] || severityColors.low;
        return (
          <Chip
            size="sm"
            variant="flat"
            style={{
              backgroundColor: `${hexColor}1A`,
              color: hexColor,
              borderColor: `${hexColor}33`,
            }}
            className="border font-medium uppercase tracking-wide"
            startContent={
              <span 
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: hexColor }}
              />
            }
          >
            {alert.severity}
          </Chip>
        );
      
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full animate-spin" 
               style={{ borderTopColor: 'var(--color-primary)' }} />
          <Icon.ShieldAlert className="absolute inset-0 m-auto w-6 h-6 text-primary" />
        </div>
        <p className="mt-4 text-sm text-foreground/50">Loading alerts...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Glass Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/60 border-b border-white/5 h-16 flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Alerts</h1>
          <span className="text-sm text-foreground/50 border-l border-white/10 pl-3">Real-time incident feed</span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Provider Filter Buttons */}
          <div className="flex bg-content1 rounded-lg p-1 border border-white/5">
            <Tooltip content="All Providers">
              <button
                onClick={() => setSelectedProvider('all')}
                className={`p-2 rounded-md transition-all ${selectedProvider === 'all' ? 'bg-content2 text-foreground shadow-sm' : 'text-foreground/50 hover:text-foreground'}`}
              >
                <div className="flex items-center gap-2 px-1">
                  <Icon.Database className="w-4 h-4" />
                  <span className="text-xs font-medium">All</span>
                </div>
              </button>
            </Tooltip>
            
            {(availableProviders.includes('sentinelone') || selectedProvider === 'sentinelone') && (
              <>
                <div className="w-px bg-white/5 my-1 mx-1" />
                <Tooltip content="SentinelOne">
                  <button
                    onClick={() => setSelectedProvider('sentinelone')}
                    className={`p-2 rounded-md transition-all ${selectedProvider === 'sentinelone' ? 'bg-content2 shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                  >
                    <img src={sentineloneLogo} alt="SentinelOne" className="w-4 h-4 object-contain" />
                  </button>
                </Tooltip>
              </>
            )}

            {(availableProviders.includes('crowdstrike') || selectedProvider === 'crowdstrike') && (
              <>
                <div className="w-px bg-white/5 my-1 mx-1" />
                <Tooltip content="CrowdStrike">
                  <button
                    onClick={() => setSelectedProvider('crowdstrike')}
                    className={`p-2 rounded-md transition-all ${selectedProvider === 'crowdstrike' ? 'bg-content2 shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                  >
                    <img src={crowdstrikeLogo} alt="CrowdStrike" className="w-4 h-4 object-contain" />
                  </button>
                </Tooltip>
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
            isIconOnly
            className="bg-transparent hover:bg-white/5 text-foreground/60 hover:text-foreground border-0"
            onPress={loadData}
          >
            <Icon.Refresh className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="p-8 max-w-[1600px] mx-auto w-full animate-fade-in">
        {/* Summary Metrics */}
        <section className="grid grid-cols-5 gap-6 mb-12 border-b border-white/5 pb-8">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-foreground/50 uppercase tracking-widest">Critical</span>
            <span className="text-4xl font-light tracking-tight text-red-400">
              {summary?.critical?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-foreground/50 uppercase tracking-widest">High</span>
            <span className="text-4xl font-light tracking-tight text-orange-400">
              {summary?.high?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-foreground/50 uppercase tracking-widest">Medium</span>
            <span className="text-4xl font-light tracking-tight text-yellow-200">
              {summary?.medium?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-foreground/50 uppercase tracking-widest">Low</span>
            <span className="text-4xl font-light tracking-tight text-blue-300">
              {summary?.low?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-foreground/50 uppercase tracking-widest">Total Alerts</span>
            <span className="text-4xl font-light tracking-tight text-foreground">
              {summary?.total?.toLocaleString() || 0}
            </span>
          </div>
        </section>

        {/* Alerts Table */}
        <section>
          <Table 
            aria-label="Alerts table"
            classNames={{
              wrapper: "bg-transparent shadow-none border border-white/5 rounded-lg",
              th: "bg-transparent text-[10px] font-bold text-foreground/50 uppercase tracking-widest border-b border-white/5",
              td: "py-4 group-hover:text-foreground",
              tr: "hover:bg-content1 border-b border-white/5 last:border-0 cursor-pointer transition-colors",
            }}
            onRowAction={(key) => {
              const alert = alerts.find(a => a.id === key);
              if (alert) navigate(`/logs?search=${encodeURIComponent(alert.title)}`);
            }}
          >
            <TableHeader>
              <TableColumn key="time" className="w-32">Time</TableColumn>
              <TableColumn key="source" className="w-16 text-center">Src</TableColumn>
              <TableColumn key="details">Alert Details</TableColumn>
              <TableColumn key="severity" align="end">Severity</TableColumn>
            </TableHeader>
            <TableBody 
              items={alerts}
              emptyContent={
                <div className="py-12 text-center">
                  <p className="text-foreground/50">No alerts found for the selected date range</p>
                </div>
              }
            >
              {(alert) => (
                <TableRow key={alert.id} className="group">
                  {(columnKey) => (
                    <TableCell>{renderCell(alert, columnKey as string)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  );
}
