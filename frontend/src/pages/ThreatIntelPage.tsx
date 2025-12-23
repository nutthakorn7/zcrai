import { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Select,
  SelectItem,
  Chip,
  Spinner,
  Divider,
  Progress,
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
import { api } from '../shared/api/api';

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
  const [indicator, setIndicator] = useState('');
  const [type, setType] = useState<'ip' | 'domain' | 'url' | 'hash'>('ip');
  const [result, setResult] = useState<ThreatResult | null>(null);

  // Fetch summary
  const { data: summary } = useQuery<ThreatSummary>({
    queryKey: ['threat-intel-summary'],
    queryFn: async () => {
      const res = await api.get('/threat-intel/summary');
      return res.data;
    },
    refetchInterval: 30000,
  });

  // Fetch provider status
  const { data: providers } = useQuery<ProviderStatus[]>({
    queryKey: ['threat-intel-providers'],
    queryFn: async () => {
      const res = await api.get('/threat-intel/providers');
      return res.data;
    },
  });

  // Lookup mutation
  const lookupMutation = useMutation({
    mutationFn: async ({ indicator, type }: { indicator: string; type: string }) => {
      const res = await api.post('/threat-intel/lookup', { indicator, type });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleLookup = () => {
    if (!indicator.trim()) return;
    lookupMutation.mutate({ indicator: indicator.trim(), type });
  };

  const VerdictIcon = result ? verdictIcons[result.verdict] : null;

  return (
    <div className="p-6 min-h-screen bg-background space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheckIcon className="w-8 h-8 text-primary" />
            Threat Intelligence
          </h1>
          <p className="text-default-500">Query indicators against multiple threat intel sources</p>
        </div>
      </div>

      {/* Provider Status */}
      <Card className="bg-content1">
        <CardHeader className="pb-0">
          <h3 className="font-semibold">Provider Status</h3>
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
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Search */}
      <Card className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20">
        <CardBody className="p-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <label className="text-sm font-medium mb-2 block">Indicator</label>
              <Input
                placeholder="Enter IP, domain, URL, or hash..."
                value={indicator}
                onChange={(e) => setIndicator(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                startContent={<MagnifyingGlassIcon className="w-5 h-5 text-default-400" />}
                size="lg"
                classNames={{
                  input: 'font-mono',
                }}
              />
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select
                selectedKeys={[type]}
                onChange={(e) => setType(e.target.value as any)}
                size="lg"
              >
                {indicatorTypes.map((t) => (
                  <SelectItem key={t.key} startContent={<t.icon className="w-4 h-4" />}>
                    {t.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <Button
              color="primary"
              size="lg"
              onPress={handleLookup}
              isLoading={lookupMutation.isPending}
              startContent={!lookupMutation.isPending && <MagnifyingGlassIcon className="w-5 h-5" />}
            >
              Lookup
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Result */}
      {lookupMutation.isPending && (
        <Card>
          <CardBody className="py-12 text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-default-500">Querying threat intel sources...</p>
          </CardBody>
        </Card>
      )}

      {result && !lookupMutation.isPending && (
        <Card className="overflow-visible">
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
                  <p className="text-sm text-default-500">Type: {result.type.toUpperCase()}</p>
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
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{source.name}</span>
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
                      <div className="text-xs text-default-500 space-y-1">
                        {source.details.abuseConfidenceScore !== undefined && (
                          <p>Abuse Score: {source.details.abuseConfidenceScore}%</p>
                        )}
                        {source.details.detectionRatio && (
                          <p>Detection: {source.details.detectionRatio}</p>
                        )}
                        {source.details.pulseCount !== undefined && (
                          <p>Pulses: {source.details.pulseCount}</p>
                        )}
                        {source.details.totalReports !== undefined && (
                          <p>Reports: {source.details.totalReports}</p>
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

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-content2">
            <CardBody className="text-center p-4">
              <p className="text-3xl font-bold">{summary.totalIndicators}</p>
              <p className="text-sm text-default-500">Total Queries</p>
            </CardBody>
          </Card>
          <Card className="bg-danger-50 dark:bg-danger-900/20">
            <CardBody className="text-center p-4">
              <p className="text-3xl font-bold text-danger">{summary.maliciousCount}</p>
              <p className="text-sm text-danger-600">Malicious</p>
            </CardBody>
          </Card>
          <Card className="bg-warning-50 dark:bg-warning-900/20">
            <CardBody className="text-center p-4">
              <p className="text-3xl font-bold text-warning">{summary.suspiciousCount}</p>
              <p className="text-sm text-warning-600">Suspicious</p>
            </CardBody>
          </Card>
          <Card className="bg-success-50 dark:bg-success-900/20">
            <CardBody className="text-center p-4">
              <p className="text-3xl font-bold text-success">{summary.cleanCount}</p>
              <p className="text-sm text-success-600">Clean</p>
            </CardBody>
          </Card>
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
                      <p className="text-xs text-default-500">{new Date(query.queriedAt).toLocaleString()}</p>
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
