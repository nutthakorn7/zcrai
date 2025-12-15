import { useEffect, useState } from "react";
import { Button, Tooltip as HerouiTooltip, Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";
import { DateRangePicker } from "../../components/DateRangePicker";
import { useNavigate } from "react-router-dom";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, AreaChart, Area
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
import { SystemMetricsCard } from '../../components/SystemMetricsCard';
import { AnomalyDashboardCard } from '../../components/AnomalyDashboardCard';

// Import logos
import sentineloneLogo from '../../assets/logo/sentinelone.png';
import crowdstrikeLogo from '../../assets/logo/crowdstrike.png';
import awsLogo from '../../assets/logo/aws.png';

// Logo mapping for providers
const providerLogos: { [key: string]: string } = {
  sentinelone: sentineloneLogo,
  crowdstrike: crowdstrikeLogo,
  'aws-cloudtrail': awsLogo,
};

// Severity color mapping (Can also be moved to a constants file if used elsewhere)
const severityColors = {
  critical: '#FF0202',
  high: '#FFA735',
  medium: '#FFEE00',
  low: '#BBF0FF',
  info: '#3B82F6', // Added info for cloud logs usually
};

// Source color mapping
const sourceColors: { [key: string]: string } = {
  crowdstrike: '#EF4444', // Red
  sentinelone: '#A855F7', // Purple
  'aws-cloudtrail': '#F59E0B', // Orange
};

export default function DashboardPage() {
  const { setPageContext } = usePageContext();
  
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const navigate = useNavigate();

  const handleTimelineClick = (data: any) => {
    if (data && data.activeLabel) {
      navigate(`/alerts?date=${data.activeLabel}`);
    }
  };

  const handlePieClick = (data: any) => {
    if (data && data.name) {
      navigate(`/alerts?source=${data.name.toLowerCase()}`);
    }
  };

  const handleSummaryClick = (sev: string) => {
      if (sev === 'total') return navigate('/alerts');
      navigate(`/alerts?severity=${sev.toLowerCase()}`);
  };

  useEffect(() => {
    loadDashboard();
  }, [startDate, endDate, selectedProvider]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadDashboard();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, startDate, endDate, selectedProvider]);

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  // Quick date preset helpers
  const setDatePreset = (days: number) => {
    const end = new Date();
    end.setDate(end.getDate() + 1); // Include today
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start);
    setEndDate(end);
  };

  // Calculate percentage change: Compare current vs previous period
  // Logic: ((current - previous) / previous) * 100
  // Edge cases:
  //   - previous = 0, current > 0 → Infinity (show as +100% but note it's new)
  //   - previous = 0, current = 0 → No change (0%)
  //   - previous > 0, current = 0 → -100% (decrease to zero)
  //   - previous = current → 0% (no change)
  const calculateChange = (current: number, previous: number): { change: number; isIncrease: boolean } => {
    // Both zero: no change
    if (previous === 0 && current === 0) {
      return { change: 0, isIncrease: false };
    }
    
    // Previous is 0 but current > 0: New alerts (show as +100% for indication, but it's technically infinite)
    if (previous === 0 && current > 0) {
      return { change: 100, isIncrease: true };
    }
    
    // Normal case: calculate percentage change
    const change = ((current - previous) / previous) * 100;
    return { change, isIncrease: change >= 0 };
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
        .filter((p: string) => ['sentinelone', 'crowdstrike', 'aws-cloudtrail'].includes(p));
        
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

      // Calculate previous period (same length as current period, but shifted back)
      // Example: 
      //   - Current:  Nov 26 - Dec 3 (8 days)
      //   - Previous: Nov 18 - Nov 25 (8 days before current)
      // This gives true period-over-period comparison
      const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1); // Last day before current period starts
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - (periodDays - 1)); // Go back by period length
      const prevStart = `${prevStartDate.getFullYear()}-${String(prevStartDate.getMonth() + 1).padStart(2, '0')}-${String(prevStartDate.getDate()).padStart(2, '0')}`;
      const prevEnd = `${prevEndDate.getFullYear()}-${String(prevEndDate.getMonth() + 1).padStart(2, '0')}-${String(prevEndDate.getDate()).padStart(2, '0')}`;
      let prevDateParams = `startDate=${prevStart}&endDate=${prevEnd}`;
      
      // Add same sources filter to previous period for fair comparison
      if (targetSources.length > 0) {
        prevDateParams += `&sources=${targetSources.join(',')}`;
      } else if (selectedProvider === 'all') {
        prevDateParams += `&sources=none`;
      } else {
        prevDateParams += `&sources=${selectedProvider}`;
      }

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

      // 3. Set Data with Validation
      const summaryData = summaryRes.data;
      const prevSummaryData = prevSummaryRes.data;
      
      // Validate total = critical + high + medium + low
      if (summaryData?.critical !== undefined && summaryData?.high !== undefined && 
          summaryData?.medium !== undefined && summaryData?.low !== undefined) {
        const calculatedTotal = summaryData.critical + summaryData.high + summaryData.medium + summaryData.low;
        if (summaryData.total !== calculatedTotal) {
          console.warn(`❌ Data Mismatch: Backend returned total ${summaryData.total}, but sum of severities is ${calculatedTotal}`);
          // Optionally correct it
          summaryData.total = calculatedTotal;
        }
      }
      
      setSummary(summaryData);
      setPreviousSummary(prevSummaryData);
      
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

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const dateParams = `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      
      const response = await api.get(`/reports/dashboard/pdf?${dateParams}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dashboard-report-${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export PDF:', e);
      // You could add a toast notification here
    } finally {
      setExporting(false);
    }
  };


  // Transform timeline data for chart - รวม data ตาม time และแยก source
  // Output format: { time: 'Jan 1', crowdstrike_total: 10, crowdstrike_critical: 2, sentinelone_total: 50, ... }
  const chartData = (() => {
    const grouped: { [time: string]: any } = {};
    
    timeline.forEach(t => {
      const formattedTime = new Date(t.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const src = t.source?.toLowerCase() || 'unknown';
      
      if (!grouped[formattedTime]) {
        grouped[formattedTime] = { time: formattedTime };
      }
      
      // Add source-specific data
      grouped[formattedTime][`${src}_total`] = (grouped[formattedTime][`${src}_total`] || 0) + parseInt(t.count);
      grouped[formattedTime][`${src}_critical`] = (grouped[formattedTime][`${src}_critical`] || 0) + parseInt(t.critical);
      grouped[formattedTime][`${src}_high`] = (grouped[formattedTime][`${src}_high`] || 0) + parseInt(t.high);
      grouped[formattedTime][`${src}_medium`] = (grouped[formattedTime][`${src}_medium`] || 0) + parseInt(t.medium);
      grouped[formattedTime][`${src}_low`] = (grouped[formattedTime][`${src}_low`] || 0) + parseInt(t.low);
    });
    
    return Object.values(grouped);
  })();

  // หา sources ที่มีใน timeline data
  const timelineSources = [...new Set(timeline.map(t => t.source?.toLowerCase()).filter(Boolean))];

  // Transform source data for pie chart
  const pieData = sources.map(s => ({
    name: s.source,
    value: parseInt(s.count),
  }));

  const Sparkline = ({ data, dataKey, color }: { data: any[], dataKey: string, color: string }) => (
    <div className="h-[40px] w-[80px]">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <Area 
                    type="monotone" 
                    dataKey={dataKey} 
                    stroke={color} 
                    strokeWidth={2} 
                    fill={`url(#grad-${dataKey})`} 
                    isAnimationActive={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    </div>
  );

  const SummaryCard = ({ title, count, prevCount, color, icon, dataKey }: any) => {
    const { change, isIncrease } = calculateChange(count || 0, prevCount || 0);

    // Prepare data for sparkline
    const sparkData = timeline.map(t => ({
        ...t,
        [dataKey]: Number((t as any)[dataKey] || 0) || 0 // Handle potentially missing keys
    }));

    return (
        <Card className="bg-content1/50 border border-white/5 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardBody className="p-4 overflow-hidden">
                <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                         <div 
                            className="p-3 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${color}15`, color: color }}
                         >
                             {icon}
                         </div>
                         <div>
                            <p className="text-sm text-default-600 font-medium uppercase tracking-wider">{title}</p>
                            <h3 className="text-3xl font-bold mt-1" style={{ color: color === 'var(--color-primary)' ? undefined : color }}>{count?.toLocaleString() || 0}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Chip 
                                    size="sm" 
                                    variant="flat" 
                                    className="h-5 px-1 bg-transparent border border-white/5"
                                    classNames={{ content: `text-[10px] font-semibold ${isIncrease ? 'text-green-500' : 'text-default-400'}` }}
                                    startContent={isIncrease && <Icon.TrendingUp className="size-3 text-green-500" />}
                                >
                                    {isIncrease ? '+' : ''}{change !== Infinity ? change.toFixed(1) : 'New'}%
                                </Chip>
                            </div>
                         </div>
                    </div>
                    {/* Sparkline */}
                    <div className="opacity-50 hover:opacity-100 transition-opacity">
                        <Sparkline data={sparkData} dataKey={dataKey} color={color} />
                    </div>
                </div>
            </CardBody>
        </Card>
    );
  };

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

            {(availableProviders.includes('aws-cloudtrail') || selectedProvider === 'aws-cloudtrail') && (
              <>
                <div className="w-px bg-white/5 my-1 mx-1" />
                <HerouiTooltip content="AWS CloudTrail">
                  <button
                    onClick={() => setSelectedProvider('aws-cloudtrail')}
                    className={`p-2 rounded-md transition-all ${selectedProvider === 'aws-cloudtrail' ? 'bg-content2 shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                  >
                    <img src={awsLogo} alt="AWS" className="w-5 h-5 object-contain" />
                  </button>
                </HerouiTooltip>
              </>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={startDate && (Date.now() - startDate.getTime()) < 8 * 24 * 60 * 60 * 1000 ? 'solid' : 'flat'}
              color="primary"
              className="text-xs"
              onPress={() => setDatePreset(7)}
            >
              Last 7d
            </Button>
            <Button
              size="sm"
              variant={startDate && (Date.now() - startDate.getTime()) > 8 * 24 * 60 * 60 * 1000 && (Date.now() - startDate.getTime()) < 31 * 24 * 60 * 60 * 1000 ? 'solid' : 'flat'}
              color="primary"
              className="text-xs"
              onPress={() => setDatePreset(30)}
            >
              Last 30d
            </Button>
            <Button
              size="sm"
              variant={startDate && (Date.now() - startDate.getTime()) > 85 * 24 * 60 * 60 * 1000 ? 'solid' : 'flat'}
              color="primary"
              className="text-xs"
              onPress={() => setDatePreset(90)}
            >
              Last 90d
            </Button>
          </div>

          <DateRangePicker 
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
          />

          <Button
            size="sm"
            isLoading={exporting}
            className="bg-content2 hover:bg-content3 text-foreground border border-white/5"
            startContent={!exporting && <Icon.Document className="w-4 h-4" />}
            onPress={handleExportPDF}
          >
            Export PDF
          </Button>

          {/* Auto-refresh Toggle */}
          <HerouiTooltip content={autoRefresh ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}>
            <Button 
              size="sm"
              isIconOnly
              color={autoRefresh ? 'success' : 'default'}
              variant={autoRefresh ? 'solid' : 'flat'}
              className={autoRefresh ? '' : 'bg-transparent hover:bg-white/5 text-foreground/60 hover:text-foreground border-0'}
              onPress={() => setAutoRefresh(!autoRefresh)}
            >
              <Icon.Clock className="w-4 h-4" />
            </Button>
          </HerouiTooltip>

          <Button 
            size="sm"
            isIconOnly
            className="bg-transparent hover:bg-white/5 text-foreground/60 hover:text-foreground border-0"
            onPress={loadDashboard}
          >
            <Icon.Refresh className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Summary Stats */}
      <h2 className="sr-only">Alert Summary</h2>
      {/* Summary Cards with Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 animate-fade-in">
        <div onClick={() => handleSummaryClick('critical')} className="cursor-pointer transition-transform hover:scale-[1.02]">
            <SummaryCard 
                title="Critical" 
                count={summary?.critical} 
                prevCount={previousSummary?.critical} 
                color={severityColors.critical} 
                icon={<Icon.Alert className="size-6 text-current" />}
                dataKey="critical"
            />
        </div>
        <div onClick={() => handleSummaryClick('high')} className="cursor-pointer transition-transform hover:scale-[1.02]">
            <SummaryCard 
                title="High" 
                count={summary?.high} 
                prevCount={previousSummary?.high} 
                color={severityColors.high} 
                icon={<Icon.Alert className="size-6 text-current" />}
                dataKey="high"
            />
        </div>
        <div onClick={() => handleSummaryClick('medium')} className="cursor-pointer transition-transform hover:scale-[1.02]">
            <SummaryCard 
                title="Medium" 
                count={summary?.medium} 
                prevCount={previousSummary?.medium} 
                color={severityColors.medium} 
                icon={<Icon.Alert className="size-6 text-current" />}
                dataKey="medium"
            />
        </div>
        <div onClick={() => handleSummaryClick('low')} className="cursor-pointer transition-transform hover:scale-[1.02]">
            <SummaryCard 
                title="Low" 
                count={summary?.low} 
                prevCount={previousSummary?.low} 
                color={severityColors.low} 
                icon={<Icon.Alert className="size-6 text-current" />}
                dataKey="low"
            />
        </div>
        <div onClick={() => handleSummaryClick('total')} className="cursor-pointer transition-transform hover:scale-[1.02]">
            <SummaryCard 
                title="Total Events" 
                count={summary?.total} 
                prevCount={previousSummary?.total} 
                color="var(--color-primary)" 
                icon={<Icon.Chart className="size-6 text-current" />}
                dataKey="count" // 'count' in timeline is total
            />
        </div>
      </div>

      {/* Bento Grid: Timeline + Sources */}
      <div className="grid grid-cols-12 gap-3 mb-6 animate-fade-in">
        {/* Timeline Chart - 8 columns */}
        <Card className="col-span-12 lg:col-span-8 border border-white/5 bg-content1/50">
          <CardBody className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Icon.Chart className="w-4 h-4 text-primary" />
                Events Timeline
              </h2>
              {/* Legend */}
              <div className="flex gap-4">
                {timelineSources.includes('crowdstrike') && (
                  <Chip size="sm" variant="flat" classNames={{ base: "bg-danger/10", content: "text-danger" }} startContent={<div className="w-2 h-2 rounded-full bg-danger animate-pulse" />}>
                    CrowdStrike
                  </Chip>
                )}
                {timelineSources.includes('sentinelone') && (
                  <Chip size="sm" variant="flat" classNames={{ base: "bg-purple-500/10", content: "text-purple-500" }} startContent={<div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}>
                    SentinelOne
                  </Chip>
                )}
                {timelineSources.includes('aws-cloudtrail') && (
                  <Chip size="sm" variant="flat" classNames={{ base: "bg-orange-500/10", content: "text-orange-500" }} startContent={<div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />}>
                    AWS CloudTrail
                  </Chip>
                )}
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} onClick={handleTimelineClick} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="#4A4D50" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#4A4D50" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0]?.payload || {};
                      return (
                        <div className="bg-[#1A1D1F] border border-white/10 rounded-xl p-3 shadow-xl min-w-[200px]">
                          <p className="text-sm font-semibold text-foreground mb-2 border-b border-white/5 pb-2">{label}</p>
                          {/* CrowdStrike Section */}
                          {data.crowdstrike_total > 0 && (
                            <div className="mb-2">
                              <div className="flex items-center gap-2 mb-1">
                                <img src={providerLogos['crowdstrike']} alt="CrowdStrike" className="w-4 h-4" />
                                <span className="text-xs font-medium text-foreground">CrowdStrike</span>
                                <span className="text-xs font-bold text-[#EF4444] ml-auto">{data.crowdstrike_total}</span>
                              </div>
                            </div>
                          )}
                          {/* SentinelOne Section */}
                          {data.sentinelone_total > 0 && (
                            <div className="mb-2">
                              <div className="flex items-center gap-2 mb-1">
                                <img src={providerLogos['sentinelone']} alt="SentinelOne" className="w-4 h-4" />
                                <span className="text-xs font-medium text-foreground">SentinelOne</span>
                                <span className="text-xs font-bold text-[#A855F7] ml-auto">{data.sentinelone_total}</span>
                              </div>
                            </div>
                          )}
                          {/* AWS Section */}
                          {data['aws-cloudtrail_total'] > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <img src={providerLogos['aws-cloudtrail']} alt="AWS" className="w-4 h-4" />
                                <span className="text-xs font-medium text-foreground">AWS CloudTrail</span>
                                <span className="text-xs font-bold text-[#F59E0B] ml-auto">{data['aws-cloudtrail_total']}</span>
                              </div>
                            </div>
                          )}
                          <div className="mt-2 text-[10px] text-default-400 text-center italic">
                              Click to analyze specific events
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="crowdstrike_total" name="crowdstrike_total" stroke="#EF4444" strokeWidth={2.5} dot={false} activeDot={{ r: 6, fill: '#EF4444' }} />
                  <Line type="monotone" dataKey="sentinelone_total" name="sentinelone_total" stroke="#A855F7" strokeWidth={2.5} dot={false} activeDot={{ r: 6, fill: '#A855F7' }} />
                  <Line type="monotone" dataKey="aws-cloudtrail_total" name="aws-cloudtrail_total" stroke="#F59E0B" strokeWidth={2.5} dot={false} activeDot={{ r: 6, fill: '#F59E0B' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Sources Distribution - 4 columns */}
        <Card className="col-span-12 lg:col-span-4 border border-white/5 bg-content1/50">
          <CardBody className="p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Icon.Chart className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Source Distribution</h2>
            </div>
            <div className="flex-1 min-h-[250px] flex items-center justify-center">
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
                    stroke="none"
                    onClick={handlePieClick}
                    className="cursor-pointer"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={['#EF4444', '#A855F7', '#3B82F6', '#22C55E'][i % 4]} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}
                    itemStyle={{ color: '#e4e4e7' }}
                    formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Custom Legend */}
            <div className="grid grid-cols-2 gap-2 mt-4">
               {pieData.map((entry, index) => (
                 <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-content2/50 cursor-pointer hover:bg-content2 transition-colors" onClick={() => handlePieClick(entry)}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#EF4444', '#A855F7', '#3B82F6', '#22C55E'][index % 4] }} />
                    <span className="text-xs text-foreground/70 capitalize truncate">{entry.name}</span>
                    <span className="text-xs font-bold ml-auto">{entry.value}</span>
                 </div>
               ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* System Metrics */}
      <div className="mb-8 animate-fade-in">
        <SystemMetricsCard />
      </div>

      {/* ML Anomaly Detection */}
      <div className="mb-8 animate-fade-in">
        <AnomalyDashboardCard />
      </div>

      {/* Main Grid: Recent Detections, Hosts, Users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6 animate-fade-in">
        {/* Most Recent Detections */}
        <Card className="bg-content1/50 border border-white/5 h-[450px]">
          <CardHeader className="flex gap-3 px-5 pt-5">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon.ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <p className="text-md font-bold text-foreground">Recent Detections</p>
              <p className="text-small text-default-500">Latest security events</p>
            </div>
          </CardHeader>
          <CardBody className="px-5 pb-5">
            <div className="space-y-2 overflow-y-auto scrollbar-thin h-full pr-2">
              {recentDetections.length > 0 ? (
                recentDetections.map((detection) => {
                  const severityColor = severityColors[detection.severity.toLowerCase() as keyof typeof severityColors] || severityColors.low;
                  const source = detection.source?.toLowerCase() || '';
                  const sourceColor = sourceColors[source] || '#6B7280';
                  const sourceLogo = providerLogos[source] || null;
                  
                  return (
                    <div
                      key={detection.id}
                      className="relative flex items-center justify-between p-3 rounded-xl bg-content2/30 hover:bg-content2 transition-all group overflow-hidden border border-transparent hover:border-white/5"
                    >
                      {/* Left colored border indicator */}
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                        style={{ backgroundColor: sourceColor }}
                      />
                      
                      <div className="flex items-center gap-3 flex-1 min-w-0 pl-2">
                        {sourceLogo && (
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center p-1.5 flex-shrink-0">
                            <img 
                              src={sourceLogo} 
                              alt={detection.source} 
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                             <Chip 
                              size="sm" 
                              variant="flat"
                              classNames={{ 
                                base: "h-5 px-1", 
                                content: "text-[10px] font-bold uppercase px-1" 
                              }}
                              style={{ 
                                backgroundColor: `${severityColor}20`, 
                                color: severityColor 
                              }}
                            >
                              {detection.severity}
                            </Chip>
                            <span className="text-xs text-default-400">
                              {new Date(detection.timestamp).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-foreground truncate block">
                            {detection.mitre_technique || 'Unknown Threat'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-default-400 gap-2">
                  <Icon.Shield className="w-8 h-8 opacity-20" />
                  <p className="text-xs">No recent detections</p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Top Hosts */}
        <Card className="bg-content1/50 border border-white/5 h-[450px]">
          <CardHeader className="flex gap-3 px-5 pt-5">
            <div className="p-2 rounded-lg bg-secondary/10">
              <Icon.Server className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex flex-col">
              <p className="text-md font-bold text-foreground">Top Hosts</p>
              <p className="text-small text-default-500">Most targeted endpoints</p>
            </div>
          </CardHeader>
          <CardBody className="px-5 pb-5">
            <div className="space-y-2 overflow-y-auto scrollbar-thin h-full pr-2">
              {topHosts.map((host, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-3 rounded-xl bg-content2/30 hover:bg-content2 transition-all cursor-pointer group border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-content3 flex items-center justify-center text-xs font-bold text-foreground/70">
                      {i + 1}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground block truncate max-w-[120px]">{host.host_name}</span>
                      <span className="text-[10px] text-default-400 font-mono">{host.count} Alerts</span>
                    </div>
                  </div>
                  {parseInt(host.critical) > 0 && (
                     <Chip size="sm" color="danger" variant="flat" className="h-6">
                        {host.critical} Crit
                     </Chip>
                  )}
                </div>
              ))}
              {topHosts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-default-400 gap-2">
                  <Icon.Server className="w-8 h-8 opacity-20" />
                  <p className="text-xs">No host data available</p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Top Users */}
        <Card className="bg-content1/50 border border-white/5 h-[450px]">
          <CardHeader className="flex gap-3 px-5 pt-5">
            <div className="p-2 rounded-lg bg-warning/10">
              <Icon.Users className="w-5 h-5 text-warning" />
            </div>
            <div className="flex flex-col">
              <p className="text-md font-bold text-foreground">Top Users</p>
              <p className="text-small text-default-500">Most targeted identities</p>
            </div>
          </CardHeader>
          <CardBody className="px-5 pb-5">
             <div className="space-y-2 overflow-y-auto scrollbar-thin h-full pr-2">
              {topUsers.map((u, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-3 rounded-xl bg-content2/30 hover:bg-content2 transition-all cursor-pointer group border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-content3 flex items-center justify-center text-xs font-bold text-foreground/70">
                      {i + 1}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground block truncate max-w-[120px]">{u.user_name}</span>
                      <span className="text-[10px] text-default-400 font-mono">{u.count} Alerts</span>
                    </div>
                  </div>
                  {parseInt(u.critical) > 0 && (
                     <Chip size="sm" color="danger" variant="flat" className="h-6">
                        {u.critical} Crit
                     </Chip>
                  )}
                </div>
              ))}
              {topUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-default-400 gap-2">
                   <Icon.Users className="w-8 h-8 opacity-20" />
                   <p className="text-xs">No user data available</p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Integrations & Sites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {/* Integrations */}
        <Card className="bg-content1/50 border border-white/5 h-[450px]">
          <CardHeader className="flex gap-3 px-5 pt-5">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon.Database className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <p className="text-md font-bold text-foreground">Integrations</p>
              <p className="text-small text-default-500">Connected data sources</p>
            </div>
          </CardHeader>
          <CardBody className="px-5 pb-5">
            <div className="space-y-2 overflow-y-auto scrollbar-thin h-full pr-2">
              {integrations.map((int, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-3 rounded-xl bg-content2/30 hover:bg-content2 transition-all border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 overflow-hidden p-1.5 flex-shrink-0">
                      {providerLogos[int.source] ? (
                        <img src={providerLogos[int.source]} alt={int.source} className="w-full h-full object-contain" />
                      ) : (
                        <Icon.Database className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground block capitalize">{int.source}</span>
                      <p className="text-xs text-default-400 mt-0.5">{int.integration_name || int.integration_id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <Chip 
                    size="sm" 
                    variant="dot" 
                    color={int.status === 'active' ? 'success' : 'danger'}
                    classNames={{ base: "border-none" }}
                  >
                    {/* Fallback to 'active' if status is undefined, assuming list filters active ones anyway */}
                    {int.status || 'active'}
                  </Chip>
                </div>
              ))}
              {integrations.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-default-400 gap-2">
                    <Icon.Database className="w-8 h-8 opacity-20" />
                    <p className="text-xs">No integrations connected</p>
                 </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Sites */}
        <Card className="bg-content1/50 border border-white/5 h-[450px]">
          <CardHeader className="flex gap-3 px-5 pt-5">
            <div className="p-2 rounded-lg bg-secondary/10">
              <Icon.Building className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex flex-col">
              <p className="text-md font-bold text-foreground">Protected Sites</p>
              <p className="text-small text-default-500">Monitored locations</p>
            </div>
          </CardHeader>
          <CardBody className="px-5 pb-5">
            <div className="space-y-2 overflow-y-auto scrollbar-thin h-full pr-2">
              {sites.map((site, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-3 rounded-xl bg-content2/30 hover:bg-content2 transition-all border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/10 text-secondary">
                      <Icon.Building className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground block">{site.host_site_name}</span>
                      <p className="text-xs text-default-400 mt-0.5">{parseInt(site.count).toLocaleString()} alerts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {parseInt(site.critical) > 0 && (
                      <Chip size="sm" color="danger" variant="flat" className="h-6">
                        {site.critical}
                      </Chip>
                    )}
                    {(parseInt(site.high) > 0 && parseInt(site.critical) === 0) && (
                      <Chip size="sm" color="warning" variant="flat" className="h-6">
                        {site.high}
                      </Chip>
                    )}
                  </div>
                </div>
              ))}
              {sites.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-default-400 gap-2">
                   <Icon.Building className="w-8 h-8 opacity-20" />
                   <p className="text-xs">No sites found</p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
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