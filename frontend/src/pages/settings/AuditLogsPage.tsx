import { useState, useEffect, useCallback } from "react";
import { Card, CardBody, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Input, Pagination, Spinner, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";
import { api } from "@/shared/api";


interface AuditLog {
  id: string;
  action: string;
  resource: string;
  details: any;
  ipAddress: string;
  user?: {
    email: string;
    name: string;
  };
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  
  // Detail Modal
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const limit = 20;
      const offset = (page - 1) * limit;
      
      const response = await api.get('/audit-logs', {
        params: {
          limit,
          offset,
          action: actionFilter || undefined
        }
      });
      
      if (response.data && response.data.data) {
        setLogs(response.data.data.logs || []);
        setTotalPages(Math.ceil((response.data.data.total || 0) / limit));
      }
    } catch (error) {
      console.error("Failed to fetch audit logs", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]); // Reload on page change

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };
  
  const openDetail = (log: AuditLog) => {
    setSelectedLog(log);
    onOpen();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Audit Logs</h1>
          <p className="text-sm mt-1 text-foreground/60">Track all user activities and system changes.</p>
        </div>
        <Button color="primary" variant="flat" onPress={fetchLogs}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardBody className="gap-4">
          <div className="flex gap-4">
            <Input 
              placeholder="Filter by Action (e.g. user.login)" 
              value={actionFilter}
              onValueChange={setActionFilter}
              className="max-w-xs"
            />
            <Button onPress={handleSearch}>Search</Button>
          </div>

          <Table 
            aria-label="Audit Logs Table"
            bottomContent={
              totalPages > 1 ? (
                <div className="flex w-full justify-center">
                  <Pagination
                    isCompact
                    showControls
                    showShadow
                    color="primary"
                    page={page}
                    total={totalPages}
                    onChange={(page) => setPage(page)}
                  />
                </div>
              ) : null
            }
          >
            <TableHeader>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">TIMESTAMP</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">USER</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">ACTION</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">RESOURCE</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">IP ADDRESS</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">DETAILS</TableColumn>
            </TableHeader>
            <TableBody 
              items={logs} 
              isLoading={isLoading}
              loadingContent={<Spinner label="Loading..." />}
              emptyContent="No audit logs found."
            >
              {(item) => (
                <TableRow key={item.id}>
                  <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-small font-bold">{item.user?.name || 'System'}</span>
                      <span className="text-tiny text-default-400">{item.user?.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color="primary">{item.action}</Chip>
                  </TableCell>
                  <TableCell>{item.resource || '-'}</TableCell>
                  <TableCell>{item.ipAddress || '-'}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="light" onPress={() => openDetail(item)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Detail Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Log Details</ModalHeader>
              <ModalBody>
                {selectedLog && (
                   <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-tiny text-default-500 block">Action</span>
                            <span>{selectedLog.action}</span>
                          </div>
                          <div>
                            <span className="text-tiny text-default-500 block">Timestamp</span>
                            <span>{new Date(selectedLog.createdAt).toLocaleString()}</span>
                          </div>
                      </div>
                      <div>
                        <span className="text-tiny text-default-500 block">JSON Details</span>
                        <pre className="bg-default-100 p-4 rounded-lg overflow-auto text-xs font-mono max-h-60">
                          {JSON.stringify(selectedLog.details, null, 2)}
                        </pre>
                      </div>
                   </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
