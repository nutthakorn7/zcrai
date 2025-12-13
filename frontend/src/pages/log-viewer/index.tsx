import { useEffect, useState } from "react";
import { 
  Button, Input, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Pagination, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip
} from "@heroui/react";

import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";
import { Icon } from '../../shared/ui';

// Import vendor logos
import sentineloneLogo from '../../assets/logo/sentinelone.png';
import crowdstrikeLogo from '../../assets/logo/crowdstrike.png';

import { 
  LogEntry, FilterOptions, PaginationInfo
} from './type.ts';
import { CasesAPI } from "../../shared/api/cases";

// Vendor Logo Component
const VendorLogo = ({ source }: { source: string }) => {
  const sourceLower = source?.toLowerCase() || '';
  
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
  
  // Fallback
  const letter = source?.[0]?.toUpperCase() || 'X';
  return (
    <div className="w-8 h-8 rounded flex items-center justify-center bg-foreground/5 border border-white/5">
      <span className="text-[10px] font-bold text-foreground/40">{letter}</span>
    </div>
  );
};

// Severity colors matching dashboard
const severityColors = {
  critical: '#FF0202',
  high: '#FFA735',
  medium: '#FFEE00',
  low: '#BBF0FF',
};

export default function LogViewerPage() {

  const { setPageContext } = usePageContext();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [_, setFilterOptions] = useState<FilterOptions>({ integrations: [], accounts: [], sites: [] });
  
  // Filters
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [source] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [integrationId] = useState<string>("");
  const [accountName] = useState<string>("");
  const [siteName] = useState<string>("");
  
  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [pagination.page, selectedProvider]);

  const loadFilterOptions = async () => {
    try {
      const res = await api.get('/logs/filters');
      setFilterOptions(res.data);
    } catch (e) {
      console.error('Failed to load filter options:', e);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      // Fetch active integrations to determine available providers
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
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.append('search', search);
      if (severity) params.append('severity', severity);
      if (source) params.append('source', source);
      
      // Add sources parameter based on provider selection
      if (targetSources.length > 0) {
        params.append('sources', targetSources.join(','));
      } else if (selectedProvider === 'all') {
        params.append('sources', 'none');
      } else {
        params.append('sources', selectedProvider);
      }
      
      if (integrationId) params.append('integration_id', integrationId);
      if (accountName) params.append('account_name', accountName);
      if (siteName) params.append('site_name', siteName);

      const res = await api.get(`/logs?${params.toString()}`);
      setLogs(res.data.data);
      setPagination(res.data.pagination);
      
      // Update Page Context for AI Assistant
      const activeFilters = [];
      if (search) activeFilters.push(`search: ${search}`);
      if (severity) activeFilters.push(`severity: ${severity}`);
      if (source) activeFilters.push(`source: ${source}`);
      if (integrationId) activeFilters.push(`integration: ${integrationId}`);
      if (accountName) activeFilters.push(`account: ${accountName}`);
      if (siteName) activeFilters.push(`site: ${siteName}`);
      
      // Calculate severity breakdown from visible logs
      const logsData = res.data.data || [];
      const severityBreakdown = logsData.reduce((acc: Record<string, number>, log: LogEntry) => {
        acc[log.severity] = (acc[log.severity] || 0) + 1;
        return acc;
      }, {});
      
      // Get unique sources, hosts, users from visible logs
      const uniqueSources = [...new Set(logsData.map((l: LogEntry) => l.source))];
      const uniqueHosts = [...new Set(logsData.map((l: LogEntry) => l.host_name).filter(Boolean))];
      const uniqueUsers = [...new Set(logsData.map((l: LogEntry) => l.user_name).filter(Boolean))];
      
      setPageContext({
        pageName: 'Log Viewer',
        pageDescription: 'Security event logs viewer with filtering and search capabilities',
        data: {
          totalLogs: res.data.pagination?.total || 0,
          currentPage: res.data.pagination?.page || 1,
          totalPages: res.data.pagination?.totalPages || 1,
          logsPerPage: res.data.pagination?.limit || 20,
          currentFilter: activeFilters.length > 0 ? activeFilters.join(', ') : 'None',
          severityBreakdown: severityBreakdown,
          uniqueSources: uniqueSources.slice(0, 10),
          uniqueHosts: uniqueHosts.slice(0, 10),
          uniqueUsers: uniqueUsers.slice(0, 10),
          logs: logsData.slice(0, 20).map((log: LogEntry) => ({
            severity: log.severity,
            type: log.event_type,
            title: log.title?.slice(0, 100),
            description: log.description?.slice(0, 150),
            source: log.source,
            host: log.host_name,
            ip: log.host_ip,
            user: log.user_name,
            timestamp: log.timestamp,
            mitre_tactic: log.mitre_tactic,
            mitre_technique: log.mitre_technique,
            integration: log.integration_name,
            site: log.host_site_name,
          })),
        }
      });
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadLogs();
  };



  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const renderCell = (log: LogEntry, columnKey: string) => {
    switch (columnKey) {
      case "time":
        const dateObj = new Date(log.timestamp);
        const time = dateObj.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
        const date = dateObj.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        });
        return (
          <div className="flex flex-col">
            <span className="text-xs text-foreground/90">{time}</span>
            <span className="text-[10px] text-foreground/40">{date}</span>
          </div>
        );
      
      case "severity":
        const sev = log.severity.toLowerCase() as keyof typeof severityColors;
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
            className="border font-medium uppercase tracking-wide text-[10px]"
            startContent={
              <span 
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: hexColor }}
              />
            }
          >
            {log.severity}
          </Chip>
        );
      
      case "source":
        return <VendorLogo source={log.source} />;
      
      case "details":
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground/90 truncate group-hover:text-primary transition-colors cursor-pointer">
              {log.title}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-foreground/40 ">
              {log.mitre_tactic && log.mitre_tactic !== '-' && (
                <span className="bg-white/5 px-1 rounded">#{log.mitre_tactic}</span>
              )}
              <span>via {log.integration_name || '-'}</span>
            </div>
          </div>
        );
      
      case "context":
        return (
          <div className="flex flex-col gap-1 text-xs text-foreground/60">
            {log.host_name && (
              <div className="flex items-center gap-1.5">
                <Icon.Server className="w-3 h-3" />
                <span className="truncate">{log.host_name}</span>
              </div>
            )}
            {log.user_name && (
              <div className="flex items-center gap-1.5">
                <Icon.User className="w-3 h-3" />
                <span className="truncate">{log.user_name}</span>
              </div>
            )}
          </div>
        );
      
      case "site":
        return (
          <span className="text-xs text-foreground/50 truncate">
            {log.host_site_name || '-'}
          </span>
        );
      
      case "actions":
        return (
          <Button 
            size="sm" 
            variant="light" 
            onPress={() => setSelectedLog(log)}
            className="opacity-20 group-hover:opacity-100 transition-opacity"
          >
            <Icon.Eye className="w-4 h-4" />
          </Button>
        );
      
      default:
        return null;
    }
  };

  // Export to CSV function - fetches ALL filtered logs, not just current page
  const handleExportCSV = async () => {
    try {
      setLoading(true);
      
      // Fetch active integrations to determine target sources
      const activeIntRes = await api.get('/integrations');
      const activeIntegrations = activeIntRes.data || [];
      
      const activeProviders = activeIntegrations
        .map((i: any) => i.provider.toLowerCase())
        .filter((p: string) => ['sentinelone', 'crowdstrike'].includes(p));
        
      const uniqueActiveProviders = Array.from(new Set(activeProviders)) as string[];
      
      // Determine target sources based on selected provider
      let targetSources = uniqueActiveProviders;
      if (selectedProvider !== 'all') {
        targetSources = [selectedProvider];
      }
      
      // Build params with current filters but no pagination limit
      const params = new URLSearchParams({
        page: '1',
        limit: '10000', // Get all filtered logs
      });
      if (search) params.append('search', search);
      if (severity) params.append('severity', severity);
      if (source) params.append('source', source);
      
      // Add sources parameter based on provider selection
      if (targetSources.length > 0) {
        params.append('sources', targetSources.join(','));
      } else if (selectedProvider === 'all') {
        params.append('sources', 'none');
      } else {
        params.append('sources', selectedProvider);
      }
      
      if (integrationId) params.append('integration_id', integrationId);
      if (accountName) params.append('account_name', accountName);
      if (siteName) params.append('site_name', siteName);

      // Fetch all filtered logs
      const res = await api.get(`/logs?${params.toString()}`);
      const allLogs = res.data.data || [];
      
      if (allLogs.length === 0) {
        console.warn('No logs to export');
        return;
      }
      
      // Generate CSV content
      const headers = ['ID', 'Timestamp', 'Severity', 'Source', 'Integration', 'Title', 'Description', 'Host', 'Site', 'User', 'MITRE Tactic', 'MITRE Technique'];
      const csvContent = [
        headers.join(','),
        ...allLogs.map((log: LogEntry) => [
          log.id,
          log.timestamp,
          log.severity,
          log.source,
          log.integration_name || '',
          `"${(log.title || '').replace(/"/g, '""')}"`,
          `"${(log.description || '').replace(/"/g, '""')}"`,
          log.host_name || '',
          log.host_site_name || '',
          log.user_name || '',
          log.mitre_tactic || '',
          log.mitre_technique || '',
        ].join(','))
      ].join('\n');
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      
      // Create descriptive filename with active filters
      const filterParts = [];
      if (selectedProvider !== 'all') filterParts.push(selectedProvider);
      if (severity) filterParts.push(severity);
      if (search) filterParts.push('searched');
      
      const filterSuffix = filterParts.length > 0 ? `_${filterParts.join('_')}` : '';
      link.download = `logs_export${filterSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      
      console.log(`Exported ${allLogs.length} logs to CSV`);
    } catch (e) {
      console.error('Failed to export logs:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Glass Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/60 border-b border-white/5 h-16 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
         <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Log Viewer</h1>
          <span className="text-sm text-foreground/50 border-l border-white/10 pl-3">Real-time log feed</span>
        </div>
        </div>
        {/* Actions / Filters */}
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

          <div className="h-4 w-px bg-white/10 mx-2"></div>
          
          {/* Search Input */}
          <Input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            size="sm"
            radius="md"
            variant="bordered"
            classNames={{
              input: "text-sm text-foreground placeholder:text-foreground/50",
              inputWrapper: "bg-content1 border-foreground/20 hover:border-primary/50 data-[hover=true]:border-primary/50 h-9",
            }}
            startContent={
              <Icon.Search className="w-4 h-4 text-foreground/50" />
            }
            className="w-64"
          />

          <div className="h-4 w-px bg-white/10 mx-2"></div>

          {/* Severity Filter */}
          <Dropdown>
            <DropdownTrigger>
              <Button
                variant="bordered"
                size="sm"
                className="bg-transparent border-white/10 hover:border-primary/50 h-9 min-w-32 justify-between text-xs capitalize"
                endContent={
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                }
              >
                {severity ? (
                  <span className="capitalize">{severity}</span>
                ) : (
                  <span className="text-foreground/50">All Severity</span>
                )}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Severity filter"
              selectionMode="single"
              selectedKeys={severity ? [severity] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                setSeverity(selected === severity ? "" : selected);
              }}
              classNames={{
                base: "bg-content1 border border-white/10",
                list: "gap-0"
              }}
            >
              <DropdownItem key="critical" className="text-xs">Critical</DropdownItem>
              <DropdownItem key="high" className="text-xs">High</DropdownItem>
              <DropdownItem key="medium" className="text-xs">Medium</DropdownItem>
              <DropdownItem key="low" className="text-xs">Low</DropdownItem>
              <DropdownItem key="info" className="text-xs">Info</DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Button
            size="sm"
            isIconOnly
            className="bg-transparent hover:bg-white/5 text-foreground/60 hover:text-foreground border-0 min-w-8 w-8 h-8"
            onPress={loadLogs}
          >
            <Icon.Refresh className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-white/10 mx-2"></div>

          <Tooltip content="Export filtered logs to CSV">
            <Button
              size="sm"
              variant="bordered"
              className="bg-transparent border-white/10 hover:border-primary/50 h-9 text-xs"
              startContent={<Icon.FileText className="w-3.5 h-3.5" />}
              onPress={handleExportCSV}
            >
              Export CSV
            </Button>
          </Tooltip>
        </div>
      </header>

      {/* Content Canvas */}
      <div className="p-8 max-w-[1600px] mx-auto w-full animate-fade-in">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" color="primary" />
          </div>
        ) : (
          <>
            {/* Table */}
            <Table
              aria-label="Logs table"
              classNames={{
                wrapper: "bg-transparent shadow-none border border-white/5 rounded-lg",
                th: "bg-transparent text-[10px] font-bold text-foreground/40 uppercase tracking-wider border-b border-white/10",
                td: "py-3 text-foreground/90",
                tr: "hover:bg-content1 border-b border-white/5 last:border-0 cursor-default transition-all group",
              }}
            >
              <TableHeader>
                <TableColumn key="time" className="w-32">Time</TableColumn>
                <TableColumn key="severity" className="w-28">Severity</TableColumn>
                <TableColumn key="source" className="w-20">Source</TableColumn>
                <TableColumn key="details">Event Details</TableColumn>
                <TableColumn key="context" className="w-48">Context</TableColumn>
                <TableColumn key="site" className="w-24">Site</TableColumn>
                <TableColumn key="actions" className="w-20">Actions</TableColumn>
              </TableHeader>
              <TableBody
                items={logs}
                emptyContent={
                  <div className="text-center py-20 text-foreground/30 text-sm">
                    No logs found matching your filters.
                  </div>
                }
              >
                {(log) => (
                  <TableRow key={log.id}>
                    {(columnKey) => (
                      <TableCell>{renderCell(log, columnKey as string)}</TableCell>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center mt-8 border-t border-white/5 pt-6">
                <Pagination
                  total={pagination.totalPages}
                  page={pagination.page}
                  onChange={handlePageChange}
                  classNames={{
                    cursor: "bg-primary text-background",
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} size="3xl">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              {selectedLog && (
                <Chip
                  size="sm"
                  variant="flat"
                  style={{
                    backgroundColor: `${severityColors[selectedLog.severity.toLowerCase() as keyof typeof severityColors] || severityColors.low}1A`,
                    color: severityColors[selectedLog.severity.toLowerCase() as keyof typeof severityColors] || severityColors.low,
                  }}
                  className="border font-medium uppercase text-[10px]"
                >
                  {selectedLog.severity}
                </Chip>
              )}
              <span>{selectedLog?.title}</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>ID:</strong> {selectedLog?.id}</div>
              <div><strong>Source:</strong> {selectedLog?.source}</div>
              <div><strong>Time:</strong> {selectedLog?.timestamp}</div>
              <div><strong>Type:</strong> {selectedLog?.event_type}</div>
              <div><strong>Integration:</strong> {selectedLog?.integration_name || '-'}</div>
              <div><strong>Account:</strong> {selectedLog?.host_account_name || '-'}</div>
              <div><strong>Site:</strong> {selectedLog?.host_site_name || '-'}</div>
              <div><strong>Group:</strong> {selectedLog?.host_group_name || '-'}</div>
              <div><strong>Host:</strong> {selectedLog?.host_name || '-'}</div>
              <div><strong>IP:</strong> {selectedLog?.host_ip || '-'}</div>
              <div><strong>User:</strong> {selectedLog?.user_name || '-'}</div>
              <div><strong>Process:</strong> {selectedLog?.process_name || '-'}</div>
              <div><strong>File:</strong> {selectedLog?.file_name || '-'}</div>
              <div><strong>MITRE:</strong> {selectedLog?.mitre_tactic} / {selectedLog?.mitre_technique}</div>
            </div>
            <div className="mt-4">
              <strong>Description:</strong>
              <p className="mt-1 text-default-600 whitespace-pre-wrap">{selectedLog?.description}</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setSelectedLog(null)}>Close</Button>
            <Button color="primary" onPress={() => {
              if (selectedLog) {
                 CasesAPI.create({
                    title: selectedLog.title || 'Security Event',
                    description: `Source: ${selectedLog.source}\nHost: ${selectedLog.host_name}\n\n${selectedLog.description || ''}`,
                    severity: ['critical', 'high', 'medium', 'low'].includes(selectedLog.severity.toLowerCase()) ? selectedLog.severity.toLowerCase() : 'medium',
                    tags: ['log-generated', selectedLog.source]
                 }).then(() => {
                    setSelectedLog(null);
                    // navigate('/cases'); // Optional: Redirect or just notify
                    alert('Case Created Successfully!');
                 });
              }
            }}>
              Create Case
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
