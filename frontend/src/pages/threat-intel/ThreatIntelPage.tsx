import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Chip,
  Spinner,
  Divider,
  Progress,
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Select,
  SelectItem,
} from '@heroui/react';
import {
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  GlobeAltIcon,
  ServerIcon,
  DocumentIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, ThreatIntelAPI } from '../../shared/api';
import { StatCard } from '../../shared/ui/StatCard';
import { PageHeader } from '../../shared/ui';

interface Source {
  name: string;
  found: boolean;
  risk: string;
  details: Record<string, any>;
}

interface ThreatResult {
  indicator: string;
  type: 'ip' | 'domain' | 'url' | 'hash';
  verdict: 'clean' | 'suspicious' | 'malicious';
  confidenceScore: number;
  sources: Source[];
  tags: string[];
  malwareFamilies: string[];
  queriedAt: string;
}

interface ThreatSummary {
  totalIndicators: number;
  maliciousCount: number;
  suspiciousCount: number;
  cleanCount: number;
  topTags: { tag: string; count: number }[];
  recentQueries: ThreatResult[];
}
 
interface RetroScanResult {
  found: boolean;
  count: number;
  matches: {
      timestamp: string;
      host_name: string;
      host_ip: string;
      source: string;
      file_hash?: string;
      process_sha256?: string;
      host_domain?: string;
      user_domain?: string;
      network_src_ip?: string;
      network_dst_ip?: string;
  }[];
}

interface ProviderStatus {
  name: string;
  configured: boolean;
}

const indicatorTypes = [
  { key: 'ip', label: 'IP Address', icon: ServerIcon },
  { key: 'domain', label: 'Domain', icon: GlobeAltIcon },
  { key: 'url', label: 'URL', icon: LinkIcon },
  { key: 'hash', label: 'File Hash', icon: DocumentIcon },
];

const verdictColors = {
  clean: 'success',
  suspicious: 'warning',
  malicious: 'danger',
} as const;

const verdictIcons = {
  clean: CheckCircleIcon,
  suspicious: ExclamationTriangleIcon,
  malicious: XCircleIcon,
};

export default function ThreatIntelPage() {
  const [activeTab, setActiveTab] = useState<'reputation' | 'retro'>('reputation');
  const [indicator, setIndicator] = useState('');
  const [type, setType] = useState<'ip' | 'domain' | 'url' | 'hash'>('ip');
  const [result, setResult] = useState<ThreatResult | null>(null);
 
  // Retro Scan State
  const [days, setDays] = useState('90');
  const [retroResult, setRetroResult] = useState<RetroScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Auto-detect type
  useEffect(() => {
    const trimmed = indicator.trim();
    if (!trimmed) return;

    // URL
    if (/^https?:\/\//i.test(trimmed)) {
      setType('url');
      return;
    }

    // IP
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
      setType('ip');
      return;
    }

    // Hash (MD5=32, SHA1=40, SHA256=64)
    if (/^[a-fA-F0-9]{32}$/.test(trimmed) || /^[a-fA-F0-9]{40}$/.test(trimmed) || /^[a-fA-F0-9]{64}$/.test(trimmed)) {
      setType('hash');
      return;
    }

    // Domain (basic check: contains dot, no spaces)
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(trimmed)) {
      setType('domain');
      return;
    }
  }, [indicator]);

  // Fetch summary
  const { data: summary } = useQuery<ThreatSummary>({
    queryKey: ['threat-intel-summary'],
    queryFn: async () => {
      const res = await api.get('/threat-intel/summary');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  // Fetch provider status
  const { data: providers } = useQuery<ProviderStatus[]>({
    queryKey: ['threat-intel-providers'],
    queryFn: async () => {
      const res = await api.get('/threat-intel/providers');
      return res.data.data;
    },
  });

  // Lookup mutation
  const lookupMutation = useMutation({
    mutationFn: async ({ indicator, type }: { indicator: string; type: string }) => {
      const res = await api.post('/threat-intel/lookup', { value: indicator, type });
      return res.data;
    },
    onSuccess: (response) => {
      // Backend returns { success: true, data: result }
      if (response?.success && response?.data) {
        setResult(response.data);
      }
    },
  });

  const handleLookup = () => {
    if (!indicator.trim()) return;
    lookupMutation.mutate({ indicator: indicator.trim(), type });
  };
 
  const handleRetroScan = async () => {
    if (!indicator.trim()) return;
    setIsScanning(true);
    try {
      // Map 'hash' specifically if needed, but the original used 'ip' | 'hash' | 'domain'
      const scanType = type === 'url' ? 'domain' : type; // URL check usually falls back to domain for log search
      const data = await ThreatIntelAPI.retroScan(scanType as any, indicator.trim(), parseInt(days));
      setRetroResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };
 
  const VerdictIcon = result ? verdictIcons[result.verdict] : null;

  return (
    <div className="p-6 min-h-screen bg-background space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheckIcon className="w-8 h-8 text-primary" />
        <PageHeader title="Threat Intelligence" description="Query indicators against multiple threat intel sources" />
      </div>
 
      <Tabs 
        variant="underlined" 
        color="primary" 
        selectedKey={activeTab} 
        onSelectionChange={(k) => setActiveTab(k as any)}
      >
        <Tab key="reputation" title="IOC Reputation" />
        <Tab key="retro" title="Internal Retro-Scan" />
      </Tabs>

      {/* Provider Status */}
      <Card className="bg-content1">
        <CardHeader className="pb-0 pt-4 px-5">
          <h3 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">Provider Status</h3>
        </CardHeader>
        <CardBody>
          <div className="flex gap-4 flex-wrap">
            {providers?.map((provider) => (
              <Chip
                key={provider.name}
                startContent={provider.configured ? 
                  <CheckCircleIcon className="w-4 h-4" /> : 
                  <XCircleIcon className="w-4 h-4" />
                }
                color={provider.configured ? 'success' : 'default'}
                variant="flat"
              >
                {provider.name}
              </Chip>
            )) || (
              <>
                <Chip startContent={<CheckCircleIcon className="w-4 h-4" />} color="success" variant="flat">VirusTotal</Chip>
                <Chip startContent={<CheckCircleIcon className="w-4 h-4" />} color="success" variant="flat">AbuseIPDB</Chip>
                <Chip startContent={<CheckCircleIcon className="w-4 h-4" />} color="success" variant="flat">AlienVault OTX</Chip>
                <Chip startContent={<CheckCircleIcon className="w-4 h-4" />} color="success" variant="flat">URLScan.io</Chip>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Search */}
      <Card className="bg-content1 border border-white/5">
        <CardBody className="p-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <label className="text-sm font-medium mb-2 block">Indicator Value</label>
              <Input
                placeholder="Enter IP, domain, URL, or hash..."
                value={indicator}
                onValueChange={setIndicator}
                onKeyDown={(e) => e.key === 'Enter' && (activeTab === 'reputation' ? handleLookup() : handleRetroScan())}
                startContent={<MagnifyingGlassIcon className="w-5 h-5 text-default-400" />}
                endContent={
                  indicator && (
                    <Chip size="sm" variant="flat" color="primary" className="min-w-[80px]">
                      {indicatorTypes.find(t => t.key === type)?.label}
                    </Chip>
                  )
                }
                size="lg"
                classNames={{
                  input: 'font-mono',
                }}
              />
            </div>
            {activeTab === 'retro' && (
               <div className="w-40">
                  <label className="text-sm font-medium mb-2 block">Time Range</label>
                  <Select 
                    size="lg"
                    selectedKeys={[days]} 
                    onChange={(e) => setDays(e.target.value)}
                  >
                        <SelectItem key="7" textValue="7 Days">Last 7 Days</SelectItem>
                        <SelectItem key="30" textValue="30 Days">Last 30 Days</SelectItem>
                        <SelectItem key="90" textValue="90 Days">Last 90 Days</SelectItem>
                        <SelectItem key="365" textValue="1 Year">Last 1 Year</SelectItem>
                  </Select>
               </div>
            )}
            <Button
              color="primary"
              size="lg"
              onPress={activeTab === 'reputation' ? handleLookup : handleRetroScan}
              isLoading={lookupMutation.isPending || isScanning}
              startContent={!(lookupMutation.isPending || isScanning) && <MagnifyingGlassIcon className="w-5 h-5" />}
            >
              {activeTab === 'reputation' ? 'Lookup IOC' : 'Scan Logs'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* IOC Reputation Result */}
      {activeTab === 'reputation' && (
        <>
          {lookupMutation.isPending && (
            <Card>
              <CardBody className="py-12 text-center">
                <Spinner size="lg" />
                <p className="mt-4 text-foreground/50">Querying threat intel sources...</p>
              </CardBody>
            </Card>
          )}
 
          {result && !lookupMutation.isPending && (
            <Card className="overflow-visible animate-in fade-in slide-in-from-bottom-2">
          <CardHeader className="flex-col items-start gap-2 bg-content2 rounded-t-lg">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                {VerdictIcon && (
                  <VerdictIcon className={`w-10 h-10 ${
                    result.verdict === 'clean' ? 'text-success' :
                    result.verdict === 'suspicious' ? 'text-warning' : 'text-danger'
                  }`} />
                )}
                <div>
                  <h3 className="font-mono text-lg">{result.indicator}</h3>
                  <p className="text-sm text-foreground/50">Type: {result.type.toUpperCase()}</p>
                </div>
              </div>
              <Chip
                size="lg"
                color={verdictColors[result.verdict]}
                variant="shadow"
                className="font-semibold"
              >
                {result.verdict.toUpperCase()}
              </Chip>
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            {/* Confidence Score */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Confidence Score</span>
                <span className="text-sm font-mono">{result.confidenceScore}%</span>
              </div>
              <Progress
                value={result.confidenceScore}
                color={result.verdict === 'clean' ? 'success' : result.verdict === 'suspicious' ? 'warning' : 'danger'}
                className="max-w-full"
              />
            </div>

            <Divider />

            {/* Sources */}
            <div>
              <h3 className="font-semibold mb-3">Source Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.sources.map((source) => (
                  <Card key={source.name} className="bg-content2">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-sm">{source.name}</span>
                        <Chip
                          size="sm"
                          color={
                            source.risk === 'malicious' || source.risk === 'critical' || source.risk === 'high' ? 'danger' :
                            source.risk === 'suspicious' || source.risk === 'medium' ? 'warning' :
                            source.risk === 'error' ? 'default' : 'success'
                          }
                          variant="flat"
                        >
                          {source.risk}
                        </Chip>
                      </div>
                      <div className="text-xs space-y-1.5">
                        {/* VirusTotal specific */}
                        {source.details.detectionRatio && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Detection</span>
                            <span className="font-mono">{source.details.detectionRatio}</span>
                          </div>
                        )}
                        {source.details.reputation !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Reputation</span>
                            <span className={source.details.reputation < 0 ? 'text-danger' : 'text-success'}>
                              {source.details.reputation}
                            </span>
                          </div>
                        )}
                        {source.details.country && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Country</span>
                            <span>{source.details.country}</span>
                          </div>
                        )}
                        {source.details.asn && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">ASN</span>
                            <span className="font-mono text-[10px]">AS{source.details.asn}</span>
                          </div>
                        )}
                        {source.details.lastAnalysisDate && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Last Scan</span>
                            <span className="text-[10px]">{new Date(source.details.lastAnalysisDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        
                        {/* AbuseIPDB specific */}
                        {source.details.abuseConfidenceScore !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Abuse Score</span>
                            <span className={source.details.abuseConfidenceScore > 50 ? 'text-danger font-bold' : ''}>
                              {source.details.abuseConfidenceScore}%
                            </span>
                          </div>
                        )}
                        {source.details.totalReports !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Total Reports</span>
                            <span>{source.details.totalReports}</span>
                          </div>
                        )}
                        {source.details.countryCode && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Country</span>
                            <span>{source.details.countryCode}</span>
                          </div>
                        )}
                        {source.details.isWhitelisted !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Whitelisted</span>
                            <span className={source.details.isWhitelisted ? 'text-success' : 'text-default-400'}>
                              {source.details.isWhitelisted ? 'Yes' : 'No'}
                            </span>
                          </div>
                        )}
                        {source.details.lastReportedAt && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Last Reported</span>
                            <span className="text-[10px]">{new Date(source.details.lastReportedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        {source.details.note && (
                          <div className="mt-2 p-2 bg-default-100 rounded text-[10px] text-foreground/50 font-mono break-all">
                            ℹ️ {source.details.note}
                          </div>
                        )}
                        
                        {/* AlienVault OTX specific */}
                        {source.details.pulseCount !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Pulses</span>
                            <span className={source.details.pulseCount > 0 ? 'text-warning font-bold' : ''}>
                              {source.details.pulseCount}
                            </span>
                          </div>
                        )}
                        {source.details.risk && source.name.includes('AlienVault') && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Risk Level</span>
                            <span className={
                              source.details.risk === 'critical' || source.details.risk === 'high' ? 'text-danger' :
                              source.details.risk === 'medium' ? 'text-warning' : 'text-success'
                            }>
                              {source.details.risk.toUpperCase()}
                            </span>
                          </div>
                        )}
                        {source.details.tags && source.details.tags.length > 0 && (
                          <div className="mt-2">
                            <span className="text-foreground/50 block mb-1">Tags</span>
                            <div className="flex flex-wrap gap-1">
                              {source.details.tags.slice(0, 5).map((tag: string) => (
                                <Chip key={tag} size="sm" variant="flat" className="text-[10px] h-5">
                                  {tag}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}
                        {source.details.malwareFamilies && source.details.malwareFamilies.length > 0 && (
                          <div className="mt-2">
                            <span className="text-foreground/50 block mb-1">Malware</span>
                            <div className="flex flex-wrap gap-1">
                              {source.details.malwareFamilies.slice(0, 3).map((m: string) => (
                                <Chip key={m} size="sm" color="danger" variant="flat" className="text-[10px] h-5">
                                  {m}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Error case */}
                        {source.details.error && (
                          <div className="text-danger text-[10px] mt-1">
                            ⚠️ {source.details.error}
                          </div>
                        )}
                        
                        {/* URLScan.io specific */}
                        {source.details.score !== undefined && source.name === 'URLScan.io' && (
                          <div className="flex justify-between">
                            <span className="text-foreground/50">Score</span>
                            <span className={source.details.score > 50 ? 'text-danger font-bold' : ''}>
                              {source.details.score}
                            </span>
                          </div>
                        )}
                        {source.details.urlscanUrl && (
                          <a 
                            href={source.details.urlscanUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-primary text-[10px] hover:underline flex items-center gap-1 mt-1"
                          >
                            View Full Report ↗
                          </a>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>

            {/* Tags & Malware Families */}
            {(result.tags.length > 0 || result.malwareFamilies.length > 0) && (
              <>
                <Divider />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {result.tags.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.tags.map((tag) => (
                          <Chip key={tag} size="sm" variant="flat">{tag}</Chip>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.malwareFamilies.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Malware Families</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.malwareFamilies.map((family) => (
                          <Chip key={family} size="sm" color="danger" variant="flat">{family}</Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}
      </>
      )}

      {/* Internal Retro-Scan Result */}
      {activeTab === 'retro' && (
        <>
            {isScanning && (
                <Card>
                    <CardBody className="py-12 text-center">
                        <Spinner size="lg" />
                        <p className="mt-4 text-foreground/50">Searching through historical data in ClickHouse...</p>
                    </CardBody>
                </Card>
            )}
 
            {retroResult && !isScanning && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className={`border-l-4 ${retroResult.found ? 'border-l-danger bg-danger/5' : 'border-l-success bg-success/5'}`}>
                            <CardBody className="py-4">
                                <p className="text-xs text-foreground/50 uppercase tracking-wider font-semibold">Security Status</p>
                                <p className={`text-2xl font-bold ${retroResult.found ? 'text-danger' : 'text-success'}`}>
                                    {retroResult.found ? 'THREAT IDENTIFIED' : 'NO MATCHES FOUND'}
                                </p>
                            </CardBody>
                        </Card>
                        <Card className="bg-content1">
                            <CardBody className="py-4">
                                <p className="text-xs text-foreground/50 uppercase tracking-wider font-semibold">Total Occurrences</p>
                                <p className="text-2xl font-bold">{retroResult.count}</p>
                            </CardBody>
                        </Card>
                    </div>
 
                    {retroResult.found && (
                        <Card className="bg-content1">
                            <CardHeader className="flex justify-between items-center px-6 pt-6">
                                <h3 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">Log Matches</h3>
                                <Chip color="danger" variant="flat" size="sm" className="font-display font-bold">{retroResult.count} Events</Chip>
                            </CardHeader>
                            <CardBody className="p-0">
                                <Table removeWrapper aria-label="Matches table" className="bg-transparent">
                                    <TableHeader>
                                        <TableColumn>TIMESTAMP</TableColumn>
                                        <TableColumn>HOST</TableColumn>
                                        <TableColumn>VENDOR</TableColumn>
                                        <TableColumn>DETAIL</TableColumn>
                                    </TableHeader>
                                    <TableBody>
                                        {retroResult.matches.map((match, i) => (
                                            <TableRow key={i} className="hover:bg-default-50 transition-colors">
                                                <TableCell className="text-xs font-mono">
                                                    {new Date(match.timestamp).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">{match.host_name}</span>
                                                        <span className="text-xs text-default-400">{match.host_ip}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="sm" variant="flat" className="bg-default-100">{match.source}</Chip>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-xs font-mono max-w-md truncate text-foreground/50" title={
                                                        type === 'hash' ? (match.file_hash || match.process_sha256) : 
                                                        type === 'domain' ? (match.host_domain || match.user_domain) :
                                                        (match.network_src_ip || match.network_dst_ip)
                                                    }>
                                                        {type === 'hash' ? (match.file_hash || match.process_sha256) : 
                                                         type === 'domain' ? (match.host_domain || match.user_domain) :
                                                         (match.network_src_ip || match.network_dst_ip)}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardBody>
                        </Card>
                    )}
                </div>
            )}
        </>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Total Indicators" 
            value={summary.totalIndicators} 
          />
          <StatCard 
            label="Malicious" 
            value={summary.maliciousCount} 
            className="border-l-4 border-l-danger"
          />
          <StatCard 
            label="Suspicious" 
            value={summary.suspiciousCount} 
            className="border-l-4 border-l-warning"
          />
          <StatCard 
            label="Clean" 
            value={summary.cleanCount} 
            className="border-l-4 border-l-success"
          />
        </div>
      )}

      {/* Recent Queries */}
      {summary && summary.recentQueries.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Recent Queries</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {summary.recentQueries.map((query, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-content2 rounded-lg hover:bg-content3 cursor-pointer transition-colors"
                  onClick={() => setResult(query)}
                >
                  <div className="flex items-center gap-3">
                    {indicatorTypes.find(t => t.key === query.type)?.icon && (
                      <div className="p-2 bg-content3 rounded-lg">
                        {(() => {
                          const Icon = indicatorTypes.find(t => t.key === query.type)!.icon;
                          return <Icon className="w-4 h-4" />;
                        })()}
                      </div>
                    )}
                    <div>
                      <p className="font-mono text-sm">{query.indicator}</p>
                      <p className="text-xs text-foreground/50">{new Date(query.queriedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <Chip size="sm" color={verdictColors[query.verdict]} variant="flat">
                    {query.verdict}
                  </Chip>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
