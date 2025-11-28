import { useEffect, useState } from "react";
import { 
  Card, CardBody, Button, Input, Select, SelectItem, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Pagination, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter
} from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";

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

const severityColors: Record<string, "danger" | "warning" | "secondary" | "primary" | "default"> = {
  critical: "danger",
  high: "warning",
  medium: "secondary",
  low: "primary",
  info: "default",
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
    <div className="p-8 min-h-screen dark bg-background text-foreground">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Log Viewer</h1>
        <div className="flex gap-2">
          <Button variant="flat" color="success" onPress={handleExportCSV} isDisabled={logs.length === 0}>
            📥 Export CSV
          </Button>
          <Button variant="flat" onPress={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-content1">
        <CardBody>
          <div className="flex flex-wrap gap-4 items-end">
            <Input
              label="Search"
              placeholder="Search title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Select
              label="Severity"
              placeholder="All"
              selectedKeys={severity ? [severity] : []}
              onSelectionChange={(keys) => setSeverity(Array.from(keys)[0] as string || "")}
              className="w-36"
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
            >
              <SelectItem key="sentinelone">SentinelOne</SelectItem>
              <SelectItem key="crowdstrike">CrowdStrike</SelectItem>
            </Select>
            <Select
              label="Integration"
              placeholder="All"
              selectedKeys={integrationId ? [integrationId] : []}
              onSelectionChange={(keys) => setIntegrationId(Array.from(keys)[0] as string || "")}
              className="w-44"
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
                  className="w-44"
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
                  className="w-44"
                >
                  {filterOptions.sites.map((s) => (
                    <SelectItem key={s.name}>{s.name}</SelectItem>
                  ))}
                </Select>
              </>
            )}
            <Button color="primary" onPress={handleSearch}>
              🔍 Search
            </Button>
            <Button variant="flat" onPress={handleClear}>
              Clear
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Results Info */}
      <div className="mb-4 text-sm text-default-500">
        Showing {logs.length} of {pagination.total} logs (Page {pagination.page} of {pagination.totalPages})
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card className="bg-content1">
          <CardBody>
            <Table aria-label="Logs table" removeWrapper>
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
                      <Chip size="sm" color={severityColors[log.severity] || "default"}>
                        {log.severity}
                      </Chip>
                    </TableCell>
                    <TableCell className="capitalize text-xs">{log.source}</TableCell>
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
              <Chip size="sm" color={severityColors[selectedLog?.severity || "info"]}>
                {selectedLog?.severity}
              </Chip>
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
