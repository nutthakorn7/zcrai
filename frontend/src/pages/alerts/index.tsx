import { useEffect, useState, useCallback } from "react";
import { Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Tooltip, Card, CardBody, Tabs, Tab } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/api";
import { CasesAPI } from "../../shared/api/cases";
import { DateRangePicker } from "../../components/DateRangePicker";
import { AlertDetailDrawer } from '../../components/alerts/AlertDetailDrawer';
import { Icon } from '../../shared/ui';
import sentineloneLogo from '../../assets/logo/sentinelone.png';
import crowdstrikeLogo from '../../assets/logo/crowdstrike.png';
import { Copy, AlertTriangle, FileText, XCircle } from 'lucide-react';

// Severity color mapping
const severityColors = {
  critical: '#FF0202',
  high: '#FFA735',
  medium: '#FFEE00',
  low: '#BBF0FF',
  info: '#A1A1AA',
};

// Vendor Logo Components
const VendorLogo = ({ source }: { source: string }) => {
  const sourceLower = source.toLowerCase();
  
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

  return (
    <div className="w-8 h-8 rounded-md flex items-center justify-center border border-white/5 bg-default-100 p-1.5">
      <Icon.Shield className="w-4 h-4 text-foreground/50" />
    </div>
  );
};



// Unified Alert Interface (Combines API Alert and Log Entry)
interface PageAlert {
  id: string;
  title: string;
  severity: string;
  source: string;
  status?: string; // For Incidents
  description?: string; // For Incidents
  event_type?: string; // For Logs
  timestamp?: string; // For Logs
  createdAt?: string; // For Incidents
  host_name?: string;
  user_name?: string;
  duplicateCount?: number;
  aiAnalysis?: {
    classification: 'FALSE_POSITIVE' | 'TRUE_POSITIVE';
    confidence: number;
    reasoning: string;
    suggested_action: string;
  };
}

interface Summary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
  // Alert specific stats
  new?: number;
  reviewing?: number;
  dismissed?: number;
  promoted?: number;
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'incidents' | 'logs'>('incidents');
  const [alerts, setAlerts] = useState<PageAlert[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  
  // Filter State
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [queueFilter, setQueueFilter] = useState<'all' | 'unassigned' | 'my_queue'>('unassigned'); 
  const [aiStatus, setAiStatus] = useState<string>('all'); // 'all' | 'verified' | 'blocked' | 'pending'

  
  // Promotion State
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Drawer State
  const [selectedAlert, setSelectedAlert] = useState<PageAlert | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    
    try {
      // Fetch active integrations
      const activeIntRes = await api.get('/integrations');
      const activeIntegrations = activeIntRes.data || [];
      const activeProviders = activeIntegrations
        .map((i: any) => i.provider.toLowerCase())
        .filter((p: string) => ['sentinelone', 'crowdstrike'].includes(p));
      setAvailableProviders(Array.from(new Set(activeProviders)) as string[]);
      
      let params = `startDate=${start}&endDate=${end}`;
      if (selectedProvider !== 'all') params += `&source=${selectedProvider}`;
      if (aiStatus !== 'all') params += `&aiStatus=${aiStatus}`;

      if (viewMode === 'incidents') {
          if (queueFilter === 'unassigned') params += '&status=new';
          if (queueFilter === 'my_queue') params += '&status=investigating';

          const [alertsRes, statsRes] = await Promise.all([
            api.get(`/alerts?${params}`),
            api.get(`/alerts/stats/summary`)
          ]);
        
        setAlerts(alertsRes.data.data || []);
        setSummary(statsRes.data.data);
        
      } else {
        const [logsRes, summaryRes] = await Promise.all([
          api.get(`/logs?${params}&limit=50`),
          api.get(`/dashboard/summary?${params}`),
        ]);
        
        setAlerts(logsRes.data.data || []);
        setSummary(summaryRes.data);
      }

    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedProvider, aiStatus, viewMode, queueFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePromote = async (alert: PageAlert) => {
    if (promotingId) return;
    setPromotingId(alert.id);
    try {
      // 1. Create Case
      const newCase = await CasesAPI.create({
        title: `[Incident] ${alert.title}`,
        description: `Source: ${alert.source}\nSeverity: ${alert.severity}\nTime: ${alert.createdAt || alert.timestamp}\nOrigin Alert ID: ${alert.id}\n\n${alert.description || ''}`,
        severity: ['critical', 'high', 'medium', 'low'].includes(alert.severity.toLowerCase()) ? alert.severity.toLowerCase() : 'medium',
        tags: ['promoted-from-alert', alert.source]
      });

      // 2. Update Alert Status locally (optimistic update)
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'promoted' } : a));
      
      // 3. User Feedback
      const confirmView = window.confirm('Case created successfully! View it now?');
      if (confirmView) {
        navigate(`/cases/${newCase.id}`);
      }
    } catch (e: any) {
      console.error('Failed to promote alert:', e);
      // More specific error message if available
      const errMsg = e.response?.data?.error || 'Failed to create case. Please try again.';
      window.alert(errMsg);
    } finally {
      setPromotingId(null);
    }
  };

  const renderCell = (alert: PageAlert, columnKey: string) => {
    switch (columnKey) {
      case "time":
        const ts = alert.createdAt || alert.timestamp;
        if (!ts) return <span className="text-xs">-</span>;
        const dateObj = new Date(ts);
        return (
          <div className="flex flex-col">
            <span className="text-sm text-foreground/70">{dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            <span className="text-[10px] text-foreground/50">{dateObj.toLocaleDateString()}</span>
          </div>
        );
      
      case "source":
        return <VendorLogo source={alert.source} />;

      case "status":
         // For Incidents only
         const statusColors: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
           new: "primary",
           investigating: "warning",
           resolved: "success",
           dismissed: "default",
           promoted: "secondary"
         };
         return (
           <Chip size="sm" variant="flat" color={statusColors[alert.status || 'new'] || "default"} className="capitalize">
             {alert.status}
           </Chip>
         );
         
      case "ai":
        // AI Verdict Logic
        const severity = alert.severity.toLowerCase();
        let analysis = alert.aiAnalysis;
        
        // Mock fallback if backend hasn't processed it yet
        if (!analysis) {
             // Fallback Logic mimicking the backend Mock
             if (severity === 'critical') {
                 analysis = { classification: 'TRUE_POSITIVE', confidence: 95, reasoning: 'Critical TTPs detected matching APT behaviors.', suggested_action: 'Isolate & Escalate' };
             } else if (severity === 'info' || severity === 'low') {
                 analysis = { classification: 'FALSE_POSITIVE', confidence: 90, reasoning: 'Routine administrative noise.', suggested_action: 'Auto-Close' };
             } else {
                 analysis = { classification: 'TRUE_POSITIVE', confidence: 60, reasoning: 'Suspicious anomaly requiring manual review.', suggested_action: 'Investigate' };
             }
        }

        const isSafe = analysis.classification === 'FALSE_POSITIVE';
        const isCritical = analysis.classification === 'TRUE_POSITIVE' && analysis.confidence > 80;
        
        const badgeColor = isSafe ? "default" : (isCritical ? "danger" : "warning");
        const badgeText = isSafe ? "Noise" : (isCritical ? "Threat" : "Suspicious");

        return (
          <Tooltip content={
             <div className="px-3 py-2 max-w-xs">
               <div className="font-bold mb-1 flex items-center justify-between">
                 <span>{analysis.classification}</span>
                 <span className={`text-xs ${analysis.confidence > 80 ? 'text-green-500' : 'text-yellow-500'}`}>{analysis.confidence}% Confidence</span>
               </div>
               <div className="text-xs text-foreground/80 mb-2">{analysis.reasoning}</div>
               <div className="text-[10px] text-foreground/50 border-t border-white/10 pt-1">
                 Suggest: {analysis.suggested_action}
               </div>
             </div>
          }>
            <Chip 
              size="sm" 
              color={badgeColor} 
              variant="flat" 
              className="cursor-help min-w-[80px]"
              startContent={!isSafe && <AlertTriangle className="w-3 h-3" />}
            >
               {badgeText} ({analysis.confidence}%)
            </Chip>
          </Tooltip>
        );
      
      case "details":
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground/80">{alert.title}</span>
              {alert.duplicateCount && alert.duplicateCount > 1 && (
                <Chip size="sm" variant="flat" color="warning" className="h-5 px-1 bg-warning/10 text-warning" startContent={<Copy className="w-3 h-3" />}>
                    +{alert.duplicateCount - 1}
                </Chip>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-foreground/60">
              {viewMode === 'incidents' && <span className="truncate max-w-[300px]">{alert.description}</span>}
              {(alert.host_name || alert.user_name) && (
                <div className="flex gap-2 opacity-70">
                   {alert.host_name && <span>💻 {alert.host_name}</span>}
                   {alert.user_name && <span>👤 {alert.user_name}</span>}
                </div>
              )}
            </div>
          </div>
        );
      
      case "severity":
        const sev = alert.severity.toLowerCase() as keyof typeof severityColors;
        const hexColor = severityColors[sev] || severityColors.info;
        return (
          <Chip
            size="sm"
            variant="flat"
            style={{ backgroundColor: `${hexColor}1A`, color: hexColor, borderColor: `${hexColor}33` }}
            className="border font-medium uppercase tracking-wide"
            startContent={<span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hexColor }} />}
          >
            {alert.severity}
          </Chip>
        );

      case "actions":
        return (
            <div className="flex justify-end gap-2">
                {viewMode === 'incidents' && alert.status === 'new' && (
                  <Button size="sm" color="default" variant="light" isIconOnly onPress={() => { /* dismiss logic */ }}>
                    <XCircle className="w-4 h-4" />
                  </Button>
                )}
                <Button 
                    size="sm" 
                    color="primary" 
                    variant={alert.status === 'promoted' ? "flat" : "ghost"}
                    isDisabled={alert.status === 'promoted' || (promotingId === alert.id && promotingId !== null)}
                    isLoading={promotingId === alert.id}
                    startContent={promotingId !== alert.id && <Icon.Shield className="w-3 h-3" />}
                    onPress={() => handlePromote(alert)}
                >
                    {alert.status === 'promoted' ? 'Promoted' : 'Promote'}
                </Button>
            </div>
        );
      
      default: return null;
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
        <p className="mt-4 text-sm text-foreground/60">Loading alerts...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/60 border-b border-white/5 h-16 flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Detections
            </h1>
            <span className="text-sm text-foreground/60 border-l border-white/10 pl-3">
              {viewMode === 'incidents' ? 'Review Active Incidents' : 'Explore Raw Telemetry'}
            </span>
          </div>
          
          <Tabs 
            aria-label="View Mode" 
            selectedKey={viewMode}
            onSelectionChange={(key) => setViewMode(key as 'incidents' | 'logs')}
            color="primary" variant="bordered" size="sm"
            classNames={{
              tabList: "bg-transparent border border-white/10",
              cursor: "bg-primary/20",
            }}
          >
            <Tab key="incidents" title={
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Incidents</span>
              </div>
            }/>
            <Tab key="logs" title={
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Raw Logs</span>
              </div>
            }/>
          </Tabs>

          {viewMode === 'incidents' && (
            <div className="flex bg-content1 rounded-lg p-1 border border-white/5 ml-4 h-8 items-center">
                <button
                    onClick={() => setQueueFilter('unassigned')}
                    className={`px-3 h-6 flex items-center rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${queueFilter === 'unassigned' ? 'bg-primary/20 text-primary' : 'text-foreground/50 hover:text-foreground'}`}
                >
                    Queue
                </button>
                <div className="w-px h-3 bg-white/10 mx-1" />
                 <button
                    onClick={() => setQueueFilter('my_queue')}
                     className={`px-3 h-6 flex items-center rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${queueFilter === 'my_queue' ? 'bg-warning/20 text-warning' : 'text-foreground/50 hover:text-foreground'}`}
                >
                    In Progress
                </button>
                <div className="w-px h-3 bg-white/10 mx-1" />
                <button
                    onClick={() => setQueueFilter('all')}
                    className={`px-3 h-6 flex items-center rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${queueFilter === 'all' ? 'bg-content2 text-foreground' : 'text-foreground/50 hover:text-foreground'}`}
                >
                    All
                </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Provider Filter Buttons */}
          <div className="flex bg-content1 rounded-lg p-1 border border-white/5">
            <Tooltip content="All Providers">
              <button
                onClick={() => setSelectedProvider('all')}
                className={`p-2 rounded-md transition-all ${selectedProvider === 'all' ? 'bg-content2 text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'}`}
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

           {/* AI Status Filter */}
           <div className="flex bg-content1 rounded-lg p-1 border border-white/5">
                <Tooltip content="All AI Status">
                    <button
                        onClick={() => setAiStatus('all')}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${aiStatus === 'all' ? 'bg-content2 text-foreground shadow-sm' : 'text-foreground/50 hover:text-foreground'}`}
                    >
                        All
                    </button>
                </Tooltip>
                
                <div className="w-px bg-white/10 mx-1 my-1" />

                <Tooltip content="AI Verified Threats">
                    <button
                        onClick={() => setAiStatus('verified')}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${aiStatus === 'verified' ? 'bg-danger/20 text-danger border border-danger/20' : 'text-foreground/50 hover:text-danger hover:bg-danger/10'}`}
                    >
                        <Icon.ShieldAlert className="w-3 h-3" />
                        Verified
                    </button>
                </Tooltip>

                <div className="w-px bg-white/10 mx-1 my-1" />

                <Tooltip content="Auto-Blocked IPs">
                    <button
                         onClick={() => setAiStatus('blocked')}
                         className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${aiStatus === 'blocked' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' : 'text-foreground/50 hover:text-purple-400 hover:bg-purple-500/10'}`}
                    >
                        <Icon.Shield className="w-3 h-3" />
                        Blocked
                    </button>
                </Tooltip>
           </div>
          
           {/* Filters */}
           <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
           <Button size="sm" isIconOnly variant="light" onPress={loadData}><Icon.Refresh className="w-4 h-4" /></Button>
        </div>
      </header>

      <div className="p-6 w-full animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {viewMode === 'incidents' ? (
             // Incident Stats
             [
               { label: 'Total Incidents', value: summary?.total || 0, color: 'var(--color-primary)' },
               { label: 'New', value: summary?.new || 0, color: '#3B82F6' },
               { label: 'Investigating', value: summary?.reviewing || 0, color: '#F59E0B' },
               { label: 'Promoted', value: summary?.promoted || 0, color: '#8B5CF6' },
               { label: 'Dismissed', value: summary?.dismissed || 0, color: '#71717A' },
               // Placeholder for alignment or maybe "High Priority" subset? For now leaving empty or repeating logic? 
               // Actually, Incidents only has 5 metrics usually. We can make the grid dynamic or span.
               // Let's keep Incidents as is (maybe span 2 for Total?) or just add a filler.
               // Let's stick to 5 columns for Incidents logic IF possible, OR distinct grids.
               // EASIER: Check viewMode for className grid-cols.
             ].map((item) => (
                <Card key={item.label} className="border border-white/5 bg-content1/50 last:md:col-span-1"> 
                  <CardBody className="p-4">
                    <p className="text-sm text-foreground/60 mb-2">{item.label}</p>
                    <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
                  </CardBody>
                </Card>
             ))
          ) : (
             // Log Stats
             [
               { label: 'Total Logs', value: summary?.total || 0, color: 'var(--color-primary)' },
               { label: 'Critical Events', value: summary?.critical || 0, color: severityColors.critical },
               { label: 'High Events', value: summary?.high || 0, color: severityColors.high },
               { label: 'Medium Events', value: summary?.medium || 0, color: severityColors.medium },
               { label: 'Low Events', value: summary?.low || 0, color: severityColors.low },
               { label: 'Info Events', value: summary?.info || 0, color: severityColors.info },
             ].map((item) => (
                <Card key={item.label} className="border border-white/5 bg-content1/50">
                  <CardBody className="p-4">
                    <p className="text-sm text-foreground/60 mb-2">{item.label}</p>
                    <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value.toLocaleString()}</p>
                  </CardBody>
                </Card>
             ))
          )}
        </div>

        {/* Table */}
        <section>
          {(() => {
             const columns = [
                 { uid: 'time', name: 'Time', width: 100 },
                 { uid: 'source', name: 'Src', width: 60, align: 'center' as const },
                 { uid: 'details', name: 'Details' },
                 { uid: 'severity', name: 'Severity', width: 100 },
                 ...(viewMode === 'incidents' ? [{ uid: 'status', name: 'Status', width: 100 }] : []),
                 { uid: 'ai', name: 'AI Verdict', width: 140 },
                 { uid: 'actions', name: 'Action', align: 'end' as const },
             ];
             
             return (
              <Table 
                aria-label="Alerts table"
                selectionMode="single"
                onSelectionChange={(keys) => {
                    const id = Array.from(keys)[0] as string;
                    if (id) {
                        const alert = alerts.find(a => a.id === id);
                        if (alert) setSelectedAlert(alert);
                    }
                }}
                classNames={{
                  wrapper: "bg-transparent shadow-none border border-white/5 rounded-lg",
                  th: "bg-transparent text-[10px] font-bold text-foreground/60 uppercase tracking-widest border-b border-white/5",
                  tr: "hover:bg-content1 border-b border-white/5 last:border-0 cursor-pointer",
                }}
              >
                <TableHeader columns={columns}>
                  {(column) => (
                    <TableColumn 
                        key={column.uid} 
                        width={column.width} 
                        align={column.align || 'start'}
                    >
                      {column.name}
                    </TableColumn>
                  )}
                </TableHeader>
                <TableBody items={alerts} emptyContent="No records found">
                  {(alert) => (
                    <TableRow key={alert.id}>
                      {(columnKey) => <TableCell>{renderCell(alert, columnKey as string)}</TableCell>}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
             );
          })()}
        </section>
        <AlertDetailDrawer 
            alert={selectedAlert as any} 
            isOpen={!!selectedAlert} 
            onClose={() => setSelectedAlert(null)} 
            onPromote={(alert) => handlePromote(alert as any)}
            onDismiss={(alert) => {
                console.log("Dismiss", alert.id);
                // Todo: Implement API call
            }}
        />
      </div>
    </div>
  );
}
