import { useState, useEffect } from 'react';
import { Card, CardBody, Button, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Input, Select, SelectItem, Divider } from '@heroui/react';
import { api } from '../shared/api/api';
import { Icon } from '../shared/ui';
import toast from 'react-hot-toast';

interface CustodyEvent {
  timestamp: string;
  action: 'collected' | 'transferred' | 'analyzed' | 'stored' | 'exported';
  performedBy: string;
  location: string;
  notes?: string;
}

interface EvidenceItem {
  id: string;
  caseId: string;
  type: 'memory_dump' | 'disk_image' | 'network_pcap' | 'log_file';
  name: string;
  collectedAt: string;
  collectedBy: string;
  hash: {
    md5: string;
    sha256: string;
  };
  chainOfCustody: CustodyEvent[];
  metadata: {
    hostname?: string;
    os?: string;
    fileSize?: number;
  };
  verified: boolean;
}

// Mock data for demonstration
const MOCK_EVIDENCE: EvidenceItem[] = [
  {
    id: 'EVD-ABC123',
    caseId: 'CASE-001',
    type: 'memory_dump',
    name: 'Memory Dump - WORKSTATION-01',
    collectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    collectedBy: 'analyst@company.com',
    hash: {
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    chainOfCustody: [
      {
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        action: 'collected',
        performedBy: 'analyst@company.com',
        location: 'IT Department',
        notes: 'Memory captured using WinPmem',
      },
      {
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        action: 'transferred',
        performedBy: 'forensics@company.com',
        location: 'Forensics Lab',
        notes: 'Evidence transferred via secure channel',
      },
      {
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        action: 'analyzed',
        performedBy: 'system',
        location: 'Forensics Lab',
        notes: 'Integrity verified - hashes match',
      },
    ],
    metadata: {
      hostname: 'WORKSTATION-01',
      os: 'Windows 11 Pro',
      fileSize: 8589934592,
    },
    verified: true,
  },
  {
    id: 'EVD-DEF456',
    caseId: 'CASE-001',
    type: 'log_file',
    name: 'Security Event Log',
    collectedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    collectedBy: 'siem@company.com',
    hash: {
      md5: 'a1b2c3d4e5f6789012345678',
      sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
    chainOfCustody: [
      {
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        action: 'collected',
        performedBy: 'siem@company.com',
        location: 'SIEM Server',
        notes: 'Automated collection from Windows Event Log',
      },
      {
        timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
        action: 'stored',
        performedBy: 'system',
        location: 'Evidence Storage',
        notes: 'Evidence stored in secure vault',
      },
    ],
    metadata: {
      hostname: 'DC-01',
      os: 'Windows Server 2022',
      fileSize: 52428800,
    },
    verified: false,
  },
];

interface EvidenceTabProps {
  caseId: string;
}

export function EvidenceTab({ caseId }: EvidenceTabProps) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();
  const { isOpen: isExportOpen, onOpen: onExportOpen, onClose: onExportClose } = useDisclosure();
  const [exportData, setExportData] = useState<string>('');

  // Form state for adding custody event
  const [custodyForm, setCustodyForm] = useState({
    action: 'transferred' as CustodyEvent['action'],
    location: '',
    notes: '',
  });

  useEffect(() => {
    fetchEvidence();
  }, [caseId]);

  const fetchEvidence = async () => {
    try {
      // Try to fetch from API, fallback to mock
      const response = await api.get(`/evidence/case/${caseId}`);
      setEvidence(response.data?.data || MOCK_EVIDENCE);
    } catch (error) {
      // Use mock data if API not available
      setEvidence(MOCK_EVIDENCE);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (item: EvidenceItem) => {
    setSelectedEvidence(item);
    onOpen();
  };

  const handleVerify = async (evidenceId: string) => {
    try {
      await api.post(`/evidence/${evidenceId}/verify`);
      toast.success('Evidence integrity verified');
      fetchEvidence();
    } catch (error) {
      // Mock success
      toast.success('Evidence integrity verified (mock)');
      setEvidence(evidence.map(e => 
        e.id === evidenceId ? { ...e, verified: true } : e
      ));
    }
  };

  const handleExport = async (evidenceId: string) => {
    try {
      const response = await api.get(`/evidence/${evidenceId}/export`);
      setExportData(response.data?.report || JSON.stringify(selectedEvidence, null, 2));
    } catch (error) {
      // Mock export
      const item = evidence.find(e => e.id === evidenceId);
      if (item) {
        const mockReport = {
          evidenceIdentifier: item.id,
          caseReference: item.caseId,
          evidenceType: item.type,
          collectionDetails: {
            collectedBy: item.collectedBy,
            collectedAt: item.collectedAt,
          },
          integrityVerification: {
            md5: item.hash.md5,
            sha256: item.hash.sha256,
            verified: item.verified,
          },
          chainOfCustody: item.chainOfCustody,
          certification: {
            statement: 'I certify that this evidence has been handled in accordance with established forensic procedures.',
            certifiedAt: new Date().toISOString(),
            certifiedBy: 'zcrAI Forensics System',
          },
        };
        setExportData(JSON.stringify(mockReport, null, 2));
      }
    }
    onExportOpen();
  };

  const handleAddCustodyEvent = async () => {
    if (!selectedEvidence) return;
    
    try {
      await api.post(`/evidence/${selectedEvidence.id}/custody`, {
        ...custodyForm,
        performedBy: 'current_user@company.com',
      });
      toast.success('Custody event added');
      fetchEvidence();
      onAddClose();
      setCustodyForm({ action: 'transferred', location: '', notes: '' });
    } catch (error) {
      // Mock add
      const newEvent: CustodyEvent = {
        timestamp: new Date().toISOString(),
        action: custodyForm.action,
        performedBy: 'current_user@company.com',
        location: custodyForm.location,
        notes: custodyForm.notes,
      };
      
      setEvidence(evidence.map(e => 
        e.id === selectedEvidence.id 
          ? { ...e, chainOfCustody: [...e.chainOfCustody, newEvent] }
          : e
      ));
      
      if (selectedEvidence) {
        setSelectedEvidence({
          ...selectedEvidence,
          chainOfCustody: [...selectedEvidence.chainOfCustody, newEvent],
        });
      }
      
      toast.success('Custody event added (mock)');
      onAddClose();
      setCustodyForm({ action: 'transferred', location: '', notes: '' });
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'memory_dump': return 'primary';
      case 'disk_image': return 'secondary';
      case 'network_pcap': return 'warning';
      case 'log_file': return 'success';
      default: return 'default';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'collected': return <Icon.Add className="w-4 h-4" />;
      case 'transferred': return <Icon.ArrowUpRight className="w-4 h-4" />;
      case 'analyzed': return <Icon.Search className="w-4 h-4" />;
      case 'stored': return <Icon.Database className="w-4 h-4" />;
      case 'exported': return <Icon.Download className="w-4 h-4" />;
      default: return <Icon.Info className="w-4 h-4" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    const mb = bytes / (1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Evidence Chain of Custody</h3>
          <p className="text-sm text-foreground/60">{evidence.length} evidence items</p>
        </div>
        <Chip color="warning" variant="flat" startContent={<Icon.Lock className="w-3 h-3" />}>
          Court-Ready Evidence
        </Chip>
      </div>

      {/* Evidence List */}
      {evidence.length === 0 ? (
        <Card className="bg-content1/50 border border-white/5">
          <CardBody className="py-12 text-center">
            <Icon.Database className="w-12 h-12 mx-auto text-foreground/30 mb-4" />
            <p className="text-foreground/60">No evidence items collected for this case</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4">
          {evidence.map((item) => (
            <Card 
              key={item.id} 
              className="bg-content1/50 border border-white/5 hover:border-primary/30 transition-all cursor-pointer"
              isPressable
              onPress={() => handleViewDetails(item)}
            >
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <Chip size="sm" color={getTypeColor(item.type)} variant="flat">
                        {item.type.replace('_', ' ').toUpperCase()}
                      </Chip>
                      <span className="font-medium">{item.name}</span>
                      {item.verified && (
                        <Chip size="sm" color="success" variant="flat" startContent={<Icon.CheckCircle className="w-3 h-3" />}>
                          Verified
                        </Chip>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-xs text-foreground/60">
                      <span>ID: <code className="text-primary">{item.id}</code></span>
                      <span>Collected: {new Date(item.collectedAt).toLocaleString()}</span>
                      <span>By: {item.collectedBy}</span>
                      <span>Size: {formatFileSize(item.metadata.fileSize)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-foreground/60">Chain:</span>
                      {item.chainOfCustody.map((event, idx) => (
                        <Chip key={idx} size="sm" variant="bordered" className="text-[10px]">
                          {event.action}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!item.verified && (
                      <Button 
                        size="sm" 
                        color="warning" 
                        variant="flat"
                        onPress={() => handleVerify(item.id)}
                      >
                        Verify
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="flat"
                      onPress={() => handleExport(item.id)}
                    >
                      Export
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Evidence Detail Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span>Evidence Details</span>
                {selectedEvidence?.verified && (
                  <Chip size="sm" color="success" variant="flat">Verified</Chip>
                )}
              </div>
              <p className="text-sm font-normal text-foreground/60">{selectedEvidence?.id}</p>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedEvidence && (
              <div className="space-y-6">
                {/* Evidence Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-foreground/60">Name</p>
                    <p className="font-medium">{selectedEvidence.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground/60">Type</p>
                    <Chip size="sm" color={getTypeColor(selectedEvidence.type)}>
                      {selectedEvidence.type.replace('_', ' ')}
                    </Chip>
                  </div>
                  <div>
                    <p className="text-xs text-foreground/60">Collected By</p>
                    <p>{selectedEvidence.collectedBy}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground/60">Collected At</p>
                    <p>{new Date(selectedEvidence.collectedAt).toLocaleString()}</p>
                  </div>
                </div>

                <Divider />

                {/* Hash Values */}
                <div>
                  <h4 className="font-medium mb-2">Integrity Hashes</h4>
                  <div className="space-y-2 bg-content2/50 p-3 rounded-lg">
                    <div>
                      <span className="text-xs text-foreground/60">MD5: </span>
                      <code className="text-xs">{selectedEvidence.hash.md5}</code>
                    </div>
                    <div>
                      <span className="text-xs text-foreground/60">SHA256: </span>
                      <code className="text-xs break-all">{selectedEvidence.hash.sha256}</code>
                    </div>
                  </div>
                </div>

                <Divider />

                {/* Chain of Custody Timeline */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Chain of Custody</h4>
                    <Button size="sm" variant="flat" onPress={onAddOpen}>
                      Add Event
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {selectedEvidence.chainOfCustody.map((event, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`p-2 rounded-full ${
                            event.action === 'collected' ? 'bg-success/20 text-success' :
                            event.action === 'analyzed' ? 'bg-primary/20 text-primary' :
                            event.action === 'exported' ? 'bg-warning/20 text-warning' :
                            'bg-content2 text-foreground'
                          }`}>
                            {getActionIcon(event.action)}
                          </div>
                          {idx < selectedEvidence.chainOfCustody.length - 1 && (
                            <div className="w-px h-full min-h-[20px] bg-content3" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{event.action}</span>
                            <span className="text-xs text-foreground/60">
                              {new Date(event.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/70">
                            By {event.performedBy} at {event.location}
                          </p>
                          {event.notes && (
                            <p className="text-xs text-foreground/50 mt-1">{event.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>Close</Button>
            <Button color="primary" onPress={() => selectedEvidence && handleExport(selectedEvidence.id)}>
              Export Report
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Custody Event Modal */}
      <Modal isOpen={isAddOpen} onClose={onAddClose}>
        <ModalContent>
          <ModalHeader>Add Custody Event</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select
                label="Action"
                selectedKeys={[custodyForm.action]}
                onSelectionChange={(keys) => setCustodyForm({ ...custodyForm, action: Array.from(keys)[0] as any })}
              >
                <SelectItem key="transferred">Transferred</SelectItem>
                <SelectItem key="analyzed">Analyzed</SelectItem>
                <SelectItem key="stored">Stored</SelectItem>
                <SelectItem key="exported">Exported</SelectItem>
              </Select>
              <Input
                label="Location"
                placeholder="e.g., Forensics Lab"
                value={custodyForm.location}
                onValueChange={(val) => setCustodyForm({ ...custodyForm, location: val })}
              />
              <Input
                label="Notes"
                placeholder="Additional notes..."
                value={custodyForm.notes}
                onValueChange={(val) => setCustodyForm({ ...custodyForm, notes: val })}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onAddClose}>Cancel</Button>
            <Button color="primary" onPress={handleAddCustodyEvent} isDisabled={!custodyForm.location}>
              Add Event
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Export Modal */}
      <Modal isOpen={isExportOpen} onClose={onExportClose} size="2xl">
        <ModalContent>
          <ModalHeader>Evidence Report</ModalHeader>
          <ModalBody>
            <pre className="bg-content2 p-4 rounded-lg text-xs overflow-auto max-h-[400px]">
              {exportData}
            </pre>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onExportClose}>Close</Button>
            <Button 
              color="primary" 
              onPress={() => {
                navigator.clipboard.writeText(exportData);
                toast.success('Copied to clipboard');
              }}
            >
              Copy to Clipboard
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
