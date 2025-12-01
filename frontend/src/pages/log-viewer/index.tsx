import { useEffect, useState } from "react";
import { 
  Card, CardBody, Button, Input, Select, SelectItem, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Pagination, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter
} from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";
import { Icon } from '../../shared/ui';

// Import vendor logos
import sentineloneLogo from '../../assets/logo/sentinelone.png';
import crowdstrikeLogo from '../../assets/logo/crowdstrike.png';

// Vendor Logo Component
const VendorLogo = ({ source }: { source: string }) => {
  const sourceLower = source?.toLowerCase() || '';
  
  if (sourceLower === 'sentinelone') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20">
        <img src={sentineloneLogo} alt="S1" className="w-3.5 h-3.5 object-contain" />
        <span className="text-xs font-medium text-purple-400">SentinelOne</span>
      </div>
    );
  }
  
  if (sourceLower === 'crowdstrike') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20">
        <img src={crowdstrikeLogo} alt="CS" className="w-3.5 h-3.5 object-contain" />
        <span className="text-xs font-medium text-red-400">CrowdStrike</span>
      </div>
    );
  }
  
  // Fallback
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-foreground/5 border border-foreground/10">
      <Icon.Database className="w-3.5 h-3.5 text-foreground/40" />
      <span className="text-xs font-medium text-foreground/60 capitalize">{source || '-'}</span>
    </div>
  );
};

interface LogEntry {
  id: string;
  source: string;
  timestamp: string;
  severity: string;
  event_type: string;
  title: string;
  description: string;
  host_name: string;
  host_ip: string;
  user_name: string;
  mitre_tactic: string;
  mitre_technique: string;
  process_name: string;
  file_name: string;
  // Integration info
  integration_id: string;
  integration_name: string;
  // S1 Tenant info
  host_account_id: string;
  host_account_name: string;
  host_site_id: string;
  host_site_name: string;
  host_group_name: string;
}

interface FilterOptions {
  integrations: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  sites: { id: string; name: string }[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Severity colors matching dashboard
const severityColors = {
  critical: '#FF0202',
  high: '#FFA735',
  medium: '#FFEE00',
  low: '#BBF0FF',
};

export default function LogViewerPage() {
  const navigate = useNavigate();
  const { setPageContext } = usePageContext();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ integrations: [], accounts: [], sites: [] });
  
  // Filters
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [integrationId, setIntegrationId] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [siteName, setSiteName] = useState<string>("");
  
  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [pagination.page]);

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
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.append('search', search);
      if (severity) params.append('severity', severity);
      if (source) params.append('source', source);
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

  const handleClear = () => {
    setSearch("");
    setSeverity("");
    setSource("");
    setIntegrationId("");
    setAccountName("");
    setSiteName("");
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(() => loadLogs(), 0);
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  // Export to CSV function
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    
    const headers = ['ID', 'Timestamp', 'Severity', 'Source', 'Integration', 'Title', 'Host', 'Site', 'User', 'MITRE Tactic', 'MITRE Technique'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        log.id,
        log.timestamp,
        log.severity,
        log.source,
        log.integration_name || '',
        `"${(log.title || '').replace(/"/g, '""')}"`,
        log.host_name || '',
        log.host_site_name || '',
        log.user_name || '',
        log.mitre_tactic || '',
        log.mitre_technique || '',
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `logs_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon.Document className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Log Viewer</h1>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm"
            variant="flat" 
            className="bg-content1 border border-white/5 hover:border-white/10"
            onPress={handleExportCSV} 
            isDisabled={logs.length === 0}
          >
            <Icon.Document className="w-4 h-4" />
            Export CSV
          </Button>
          <Button 
            size="sm"
            className="bg-primary hover:bg-primary/90 text-background"
            onPress={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-content1 border border-white/5 shadow-none">
        <CardBody className="p-5">
          <div className="flex flex-wrap gap-3 items-end">
            <Input
              label="Search"
              placeholder="Search title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
              classNames={{
                input: "bg-content2",
                inputWrapper: "bg-content2 border-white/5"
              }}
              startContent={<Icon.Search className="w-4 h-4 text-foreground/40" />}
            />
            <Select
              label="Severity"
              placeholder="All"
              selectedKeys={severity ? [severity] : []}
              onSelectionChange={(keys) => setSeverity(Array.from(keys)[0] as string || "")}
              className="w-32"
              classNames={{
                trigger: "bg-content2 border-white/5"
              }}
            >
              <SelectItem key="critical">Critical</SelectItem>
              <SelectItem key="high">High</SelectItem>
              <SelectItem key="medium">Medium</SelectItem>
              <SelectItem key="low">Low</SelectItem>
              <SelectItem key="info">Info</SelectItem>
            </Select>
            <Select
              label="Source"
              placeholder="All"
              selectedKeys={source ? [source] : []}
              onSelectionChange={(keys) => setSource(Array.from(keys)[0] as string || "")}
              className="w-36"
              classNames={{
                trigger: "bg-content2 border-white/5"
              }}
            >
              <SelectItem key="sentinelone">SentinelOne</SelectItem>
              <SelectItem key="crowdstrike">CrowdStrike</SelectItem>
            </Select>
            <Select
              label="Integration"
              placeholder="All"
              selectedKeys={integrationId ? [integrationId] : []}
              onSelectionChange={(keys) => setIntegrationId(Array.from(keys)[0] as string || "")}
              className="w-40"
              classNames={{
                trigger: "bg-content2 border-white/5"
              }}
            >
              {filterOptions.integrations.map((i) => (
                <SelectItem key={i.id}>{i.name || i.id.slice(0, 8)}</SelectItem>
              ))}
            </Select>
            {source === 'sentinelone' && (
              <>
                <Select
                  label="S1 Account"
                  placeholder="All"
                  selectedKeys={accountName ? [accountName] : []}
                  onSelectionChange={(keys) => setAccountName(Array.from(keys)[0] as string || "")}
                  className="w-40"
                  classNames={{
                    trigger: "bg-content2 border-white/5"
                  }}
                >
                  {filterOptions.accounts.map((a) => (
                    <SelectItem key={a.name}>{a.name}</SelectItem>
                  ))}
                </Select>
                <Select
                  label="S1 Site"
                  placeholder="All"
                  selectedKeys={siteName ? [siteName] : []}
                  onSelectionChange={(keys) => setSiteName(Array.from(keys)[0] as string || "")}
                  className="w-40"
                  classNames={{
                    trigger: "bg-content2 border-white/5"
                  }}
                >
                  {filterOptions.sites.map((s) => (
                    <SelectItem key={s.name}>{s.name}</SelectItem>
                  ))}
                </Select>
              </>
            )}
            <Button 
              size="sm"
              className="bg-primary hover:bg-primary/90 text-background"
              onPress={handleSearch}
              startContent={<Icon.Search className="w-4 h-4" />}
            >
              Search
            </Button>
            <Button 
              size="sm"
              variant="flat" 
              className="bg-content2 border border-white/5"
              onPress={handleClear}
            >
              Clear
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Results Info */}
      <div className="mb-4 text-sm text-foreground/50">
        Showing {logs.length} of {pagination.total} logs · Page {pagination.page} of {pagination.totalPages}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" color="primary" />
        </div>
      ) : (
        <Card className="bg-content1 border border-white/5 shadow-none">
          <CardBody className="p-0">
            <Table 
              aria-label="Logs table" 
              removeWrapper
              classNames={{
                th: "bg-content2 text-foreground/70 font-medium text-xs",
                td: "text-foreground/90"
              }}
            >
              <TableHeader>
                <TableColumn>Time</TableColumn>
                <TableColumn>Severity</TableColumn>
                <TableColumn>Source</TableColumn>
                <TableColumn>Integration</TableColumn>
                <TableColumn>Title</TableColumn>
                <TableColumn>Host</TableColumn>
                <TableColumn>Site</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No logs found">
                {logs.map((log) => (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-default-100">
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-US')}
                    </TableCell>
                    <TableCell>
                      <div 
                        className="inline-block px-2 py-1 rounded-md text-xs font-semibold"
                        style={{ 
                          backgroundColor: severityColors[log.severity as keyof typeof severityColors] || '#6C6F75',
                          color: log.severity === 'medium' || log.severity === 'low' ? '#111315' : '#FFFFFF'
                        }}
                      >
                        {log.severity}
                      </div>
                    </TableCell>
                    <TableCell><VendorLogo source={log.source} /></TableCell>
                    <TableCell className="text-xs">{log.integration_name || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{log.title}</TableCell>
                    <TableCell className="text-xs">{log.host_name || '-'}</TableCell>
                    <TableCell className="text-xs">{log.host_site_name || '-'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="light" onPress={() => setSelectedLog(log)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <Pagination
            total={pagination.totalPages}
            page={pagination.page}
            onChange={handlePageChange}
          />
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} size="3xl">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <div 
                className="inline-block px-2 py-1 rounded-md text-xs font-semibold"
                style={{ 
                  backgroundColor: severityColors[selectedLog?.severity as keyof typeof severityColors] || '#6C6F75',
                  color: selectedLog?.severity === 'medium' || selectedLog?.severity === 'low' ? '#111315' : '#FFFFFF'
                }}
              >
                {selectedLog?.severity}
              </div>
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
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
