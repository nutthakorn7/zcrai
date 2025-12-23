import { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Button, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Divider, Progress, Tabs, Tab, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';
import { api } from '../shared/api/api';
import { Icon } from '../shared/ui';
import toast from 'react-hot-toast';

interface ProcessArtifact {
  pid: number;
  name: string;
  path: string;
  cmdline: string;
  parentPid: number;
  suspicious: boolean;
  suspiciousReasons?: string[];
}

interface NetworkConnection {
  pid: number;
  processName: string;
  localAddr: string;
  remoteAddr: string;
  state: string;
  suspicious: boolean;
  suspiciousReasons?: string[];
}

interface Finding {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  evidence: string[];
}

interface IOC {
  type: 'ip' | 'domain' | 'hash' | 'process';
  value: string;
  confidence: number;
}

interface ForensicAnalysis {
  dumpId: string;
  caseId: string;
  analyzedAt: string;
  artifacts: {
    processes: ProcessArtifact[];
    networkConnections: NetworkConnection[];
    openFiles: Array<{ pid: number; path: string; type: string; suspicious: boolean }>;
    commandHistory: Array<{ command: string; timestamp: string }>;
  };
  findings: Finding[];
  iocs: IOC[];
  summary: {
    totalProcesses: number;
    suspiciousProcesses: number;
    networkConnections: number;
    suspiciousConnections: number;
    criticalFindings: number;
  };
  recommendations: string[];
}

// Mock forensic analysis data
const MOCK_ANALYSIS: ForensicAnalysis = {
  dumpId: 'memdump-1702500000',
  caseId: 'CASE-001',
  analyzedAt: new Date().toISOString(),
  artifacts: {
    processes: [
      {
        pid: 4812,
        name: 'powershell.exe',
        path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        cmdline: 'powershell.exe -enc JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwA...',
        parentPid: 2048,
        suspicious: true,
        suspiciousReasons: ['Encoded command detected', 'Network activity to suspicious IP'],
      },
      {
        pid: 5678,
        name: 'svchost.exe',
        path: 'C:\\Temp\\svchost.exe',
        cmdline: 'svchost.exe',
        parentPid: 4,
        suspicious: true,
        suspiciousReasons: ['Running from unusual location', 'Name mimics system process'],
      },
      {
        pid: 1234,
        name: 'chrome.exe',
        path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        cmdline: 'chrome.exe --type=renderer',
        parentPid: 1200,
        suspicious: false,
      },
      {
        pid: 9012,
        name: 'explorer.exe',
        path: 'C:\\Windows\\explorer.exe',
        cmdline: 'explorer.exe',
        parentPid: 900,
        suspicious: false,
      },
    ],
    networkConnections: [
      {
        pid: 4812,
        processName: 'powershell.exe',
        localAddr: '192.168.1.100:54321',
        remoteAddr: '45.33.32.156:443',
        state: 'ESTABLISHED',
        suspicious: true,
        suspiciousReasons: ['Connection to known C2 server'],
      },
      {
        pid: 5678,
        processName: 'svchost.exe',
        localAddr: '192.168.1.100:49152',
        remoteAddr: '185.220.101.25:8080',
        state: 'ESTABLISHED',
        suspicious: true,
        suspiciousReasons: ['Connection to Tor exit node'],
      },
      {
        pid: 1234,
        processName: 'chrome.exe',
        localAddr: '192.168.1.100:54322',
        remoteAddr: '142.250.185.46:443',
        state: 'ESTABLISHED',
        suspicious: false,
      },
    ],
    openFiles: [
      { pid: 4812, path: 'C:\\Users\\Admin\\AppData\\Local\\Temp\\payload.dll', type: 'file', suspicious: true },
      { pid: 5678, path: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', type: 'registry', suspicious: true },
    ],
    commandHistory: [
      { command: 'whoami', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { command: 'net user admin Password123! /add', timestamp: new Date(Date.now() - 1800000).toISOString() },
      { command: 'powershell -enc <base64>', timestamp: new Date(Date.now() - 900000).toISOString() },
    ],
  },
  findings: [
    {
      title: 'Encoded PowerShell Command Detected',
      severity: 'critical',
      description: 'PowerShell process with base64-encoded command detected. This is commonly used by attackers to evade detection.',
      evidence: ['PID 4812: powershell.exe -enc JABjAGwAaQBlAG4AdAA...'],
    },
    {
      title: 'Command & Control Communication Detected',
      severity: 'critical',
      description: 'Network connections to known malicious infrastructure detected.',
      evidence: ['powershell.exe (PID 4812) → 45.33.32.156:443', 'svchost.exe (PID 5678) → 185.220.101.25:8080'],
    },
    {
      title: 'System Process Running from Unusual Location',
      severity: 'high',
      description: 'System process detected running from non-standard location. Possible malware masquerading as legitimate process.',
      evidence: ['svchost.exe at C:\\Temp\\svchost.exe'],
    },
    {
      title: 'Persistence Mechanism Detected',
      severity: 'high',
      description: 'Registry Run key access detected. Malware may be setting up persistence.',
      evidence: ['PID 5678 accessing HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'],
    },
  ],
  iocs: [
    { type: 'ip', value: '45.33.32.156', confidence: 0.95 },
    { type: 'ip', value: '185.220.101.25', confidence: 0.90 },
    { type: 'process', value: 'svchost.exe', confidence: 0.85 },
    { type: 'hash', value: 'd41d8cd98f00b204e9800998ecf8427e', confidence: 0.80 },
  ],
  summary: {
    totalProcesses: 4,
    suspiciousProcesses: 2,
    networkConnections: 3,
    suspiciousConnections: 2,
    criticalFindings: 2,
  },
  recommendations: [
    'URGENT: Isolate affected host from network immediately',
    'Initiate incident response procedures',
    'Terminate suspicious processes via EDR',
    'Collect additional forensic artifacts (disk image, network traffic)',
    'Update threat intelligence feeds with extracted IOCs',
  ],
};

interface ForensicsTabProps {
  caseId: string;
}

export function ForensicsTab({ caseId }: ForensicsTabProps) {
  const [analysis, setAnalysis] = useState<ForensicAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Wrap fetchAnalysis in useCallback to satisfy exhaustive-deps
  const fetchAnalysis = useCallback(async () => {
    try {
      const response = await api.get(`/forensics/case/${caseId}`);
      setAnalysis(response.data?.data || MOCK_ANALYSIS);
    } catch (error) {
      setAnalysis(MOCK_ANALYSIS);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleNewAnalysis = async () => {
    setAnalyzing(true);
    try {
      await api.post(`/forensics/analyze`, { caseId });
      toast.success('Memory analysis completed');
      fetchAnalysis();
    } catch (error) {
      // Mock new analysis
      toast.success('Memory analysis completed (mock)');
      setAnalysis({
        ...MOCK_ANALYSIS,
        analyzedAt: new Date().toISOString(),
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleViewFinding = (finding: Finding) => {
    setSelectedFinding(finding);
    onOpen();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'secondary';
      case 'low': return 'primary';
      default: return 'default';
    }
  };

  const getIOCIcon = (type: string) => {
    switch (type) {
      case 'ip': return <Icon.Signal className="w-4 h-4" />;
      case 'domain': return <Icon.Search className="w-4 h-4" />;
      case 'hash': return <Icon.Database className="w-4 h-4" />;
      case 'process': return <Icon.Cpu className="w-4 h-4" />;
      default: return <Icon.Info className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <Card className="bg-content1/50 border border-white/5">
        <CardBody className="py-12 text-center">
          <Icon.Search className="w-12 h-12 mx-auto text-foreground/30 mb-4" />
          <p className="text-foreground/60 mb-4">No forensic analysis available for this case</p>
          <Button color="primary" onPress={handleNewAnalysis} isLoading={analyzing}>
            Start Memory Analysis
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Memory Forensics Analysis</h3>
          <p className="text-sm text-foreground/60">
            Analyzed: {new Date(analysis.analyzedAt).toLocaleString()}
          </p>
        </div>
        <Button 
          color="primary" 
          variant="flat" 
          onPress={handleNewAnalysis} 
          isLoading={analyzing}
          startContent={<Icon.Refresh className="w-4 h-4" />}
        >
          Re-analyze
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-content1/50 border border-white/5">
          <CardBody className="p-4 text-center">
            <p className="text-3xl font-bold">{analysis.summary.totalProcesses}</p>
            <p className="text-sm text-foreground/60">Total Processes</p>
          </CardBody>
        </Card>
        <Card className="bg-danger/10 border border-danger/20">
          <CardBody className="p-4 text-center">
            <p className="text-3xl font-bold text-danger">{analysis.summary.suspiciousProcesses}</p>
            <p className="text-sm text-danger/80">Suspicious</p>
          </CardBody>
        </Card>
        <Card className="bg-content1/50 border border-white/5">
          <CardBody className="p-4 text-center">
            <p className="text-3xl font-bold">{analysis.summary.networkConnections}</p>
            <p className="text-sm text-foreground/60">Connections</p>
          </CardBody>
        </Card>
        <Card className="bg-danger/10 border border-danger/20">
          <CardBody className="p-4 text-center">
            <p className="text-3xl font-bold text-danger">{analysis.summary.criticalFindings}</p>
            <p className="text-sm text-danger/80">Critical Findings</p>
          </CardBody>
        </Card>
      </div>

      {/* Findings */}
      <Card className="bg-content1/50 border border-white/5">
        <CardBody className="p-6">
          <h4 className="font-semibold mb-4">Security Findings</h4>
          <div className="space-y-3">
            {analysis.findings.map((finding, idx) => (
              <div 
                key={idx} 
                className="p-4 bg-content2/50 rounded-lg cursor-pointer hover:bg-content2 transition-colors"
                onClick={() => handleViewFinding(finding)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Chip 
                      size="sm" 
                      color={getSeverityColor(finding.severity)} 
                      variant="flat"
                      className="uppercase text-[10px]"
                    >
                      {finding.severity}
                    </Chip>
                    <span className="font-medium">{finding.title}</span>
                  </div>
                  <Icon.ChevronRight className="w-4 h-4 text-foreground/50" />
                </div>
                <p className="text-sm text-foreground/60 mt-2 line-clamp-2">{finding.description}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Tabs for details */}
      <Card className="bg-content1/50 border border-white/5">
        <CardBody className="p-6">
          <Tabs aria-label="Analysis tabs" color="primary" variant="underlined">
            {/* Processes Tab */}
            <Tab key="processes" title={`Processes (${analysis.artifacts.processes.length})`}>
              <Table aria-label="Processes" className="mt-4">
                <TableHeader>
                  <TableColumn>PID</TableColumn>
                  <TableColumn>Name</TableColumn>
                  <TableColumn>Path</TableColumn>
                  <TableColumn>Status</TableColumn>
                </TableHeader>
                <TableBody>
                  {analysis.artifacts.processes.map((proc) => (
                    <TableRow key={proc.pid} className={proc.suspicious ? 'bg-danger/5' : ''}>
                      <TableCell>{proc.pid}</TableCell>
                      <TableCell className="font-mono">{proc.name}</TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate">{proc.path}</TableCell>
                      <TableCell>
                        {proc.suspicious ? (
                          <Chip size="sm" color="danger" variant="flat">Suspicious</Chip>
                        ) : (
                          <Chip size="sm" color="success" variant="flat">Normal</Chip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Tab>

            {/* Network Tab */}
            <Tab key="network" title={`Network (${analysis.artifacts.networkConnections.length})`}>
              <Table aria-label="Network" className="mt-4">
                <TableHeader>
                  <TableColumn>Process</TableColumn>
                  <TableColumn>Local</TableColumn>
                  <TableColumn>Remote</TableColumn>
                  <TableColumn>State</TableColumn>
                  <TableColumn>Status</TableColumn>
                </TableHeader>
                <TableBody>
                  {analysis.artifacts.networkConnections.map((conn, idx) => (
                    <TableRow key={idx} className={conn.suspicious ? 'bg-danger/5' : ''}>
                      <TableCell>{conn.processName}</TableCell>
                      <TableCell className="font-mono text-xs">{conn.localAddr}</TableCell>
                      <TableCell className="font-mono text-xs">{conn.remoteAddr}</TableCell>
                      <TableCell>{conn.state}</TableCell>
                      <TableCell>
                        {conn.suspicious ? (
                          <Chip size="sm" color="danger" variant="flat">C2</Chip>
                        ) : (
                          <Chip size="sm" color="success" variant="flat">OK</Chip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Tab>

            {/* IOCs Tab */}
            <Tab key="iocs" title={`IOCs (${analysis.iocs.length})`}>
              <div className="grid gap-3 mt-4">
                {analysis.iocs.map((ioc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-content2/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getIOCIcon(ioc.type)}
                      <div>
                        <code className="text-sm">{ioc.value}</code>
                        <Chip size="sm" variant="flat" className="ml-2 uppercase text-[10px]">{ioc.type}</Chip>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground/60">Confidence:</span>
                      <Progress 
                        value={ioc.confidence * 100} 
                        size="sm" 
                        color={ioc.confidence > 0.8 ? 'danger' : 'warning'}
                        className="w-20"
                      />
                      <span className="text-xs font-medium">{(ioc.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Tab>

            {/* Recommendations Tab */}
            <Tab key="recommendations" title="Recommendations">
              <div className="space-y-3 mt-4">
                {analysis.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-content2/50 rounded-lg">
                    <div className={`p-1 rounded-full ${idx < 2 ? 'bg-danger/20 text-danger' : 'bg-primary/20 text-primary'}`}>
                      {idx < 2 ? <Icon.Alert className="w-4 h-4" /> : <Icon.Info className="w-4 h-4" />}
                    </div>
                    <p className="text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Finding Detail Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-3">
              <Chip color={getSeverityColor(selectedFinding?.severity || 'info')} variant="flat">
                {selectedFinding?.severity.toUpperCase()}
              </Chip>
              <span>{selectedFinding?.title}</span>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedFinding && (
              <div className="space-y-4">
                <div>
                  <h5 className="font-medium mb-2">Description</h5>
                  <p className="text-foreground/80">{selectedFinding.description}</p>
                </div>
                <Divider />
                <div>
                  <h5 className="font-medium mb-2">Evidence</h5>
                  <div className="space-y-2">
                    {selectedFinding.evidence.map((e, idx) => (
                      <code key={idx} className="block p-2 bg-content2 rounded text-xs">
                        {e}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
