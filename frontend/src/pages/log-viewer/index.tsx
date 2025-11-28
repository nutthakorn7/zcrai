import { useEffect, useState } from "react";
import { 
  Card, CardBody, Button, Input, Select, SelectItem, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Pagination, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter
} from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/api";

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
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  
  // Filters
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [source, setSource] = useState<string>("");
  
  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    loadLogs();
  }, [pagination.page]);

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

      const res = await api.get(`/logs?${params.toString()}`);
      setLogs(res.data.data);
      setPagination(res.data.pagination);
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

  return (
    <div className="p-8 min-h-screen dark bg-background text-foreground">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Log Viewer</h1>
        <Button variant="flat" onPress={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </Button>
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
              className="w-40"
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
              className="w-40"
            >
              <SelectItem key="sentinelone">SentinelOne</SelectItem>
              <SelectItem key="crowdstrike">CrowdStrike</SelectItem>
            </Select>
            <Button color="primary" onPress={handleSearch}>
              🔍 Search
            </Button>
            <Button variant="flat" onPress={() => { setSearch(""); setSeverity(""); setSource(""); handleSearch(); }}>
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
                <TableColumn>Title</TableColumn>
                <TableColumn>Host</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No logs found">
                {logs.map((log) => (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-default-100">
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" color={severityColors[log.severity] || "default"}>
                        {log.severity}
                      </Chip>
                    </TableCell>
                    <TableCell className="capitalize">{log.source}</TableCell>
                    <TableCell className="max-w-md truncate">{log.title}</TableCell>
                    <TableCell>{log.host_name || '-'}</TableCell>
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
