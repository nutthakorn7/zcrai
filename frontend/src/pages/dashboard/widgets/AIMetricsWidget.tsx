import { useEffect, useState } from 'react';
import { Card, CardBody, Chip, Skeleton } from '@heroui/react';
import { api } from '../../../shared/api';
import { Icon } from '../../../shared/ui';

interface AIMetrics {
  autoCloseRate: number;
  autoBlockCount: number;
  avgConfidence: number;
  truePositiveRate: number;
  totalAnalyzed: number;
}

export function AIMetricsWidget() {
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/ai-metrics');
      setMetrics(res.data);
      setError(null);
    } catch (e: any) {
      console.error('Failed to load AI metrics:', e);
      setError('Failed to load AI metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-content1/50 border border-white/5">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="w-32 h-5 rounded" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card className="bg-content1/50 border border-white/5">
        <CardBody className="p-4 text-center text-default-500">
          <Icon.Alert className="w-6 h-6 mx-auto mb-2 text-warning" />
          <p className="text-sm">{error || 'No AI metrics available'}</p>
        </CardBody>
      </Card>
    );
  }

  const metricCards = [
    {
      label: 'Auto-Close Rate',
      value: `${metrics.autoCloseRate}%`,
      icon: <Icon.Check className="w-5 h-5" />,
      color: 'from-emerald-500/20 to-emerald-500/5',
      textColor: 'text-emerald-500',
      description: 'False positives auto-closed',
    },
    {
      label: 'Auto-Blocked',
      value: metrics.autoBlockCount.toString(),
      icon: <Icon.Shield className="w-5 h-5" />,
      color: 'from-red-500/20 to-red-500/5',
      textColor: 'text-red-500',
      description: 'Threats blocked today',
    },
    {
      label: 'Avg Confidence',
      value: `${metrics.avgConfidence}%`,
      icon: <Icon.Chart className="w-5 h-5" />,
      color: 'from-blue-500/20 to-blue-500/5',
      textColor: 'text-blue-500',
      description: 'AI analysis accuracy',
    },
    {
      label: 'True Positive Rate',
      value: `${metrics.truePositiveRate}%`,
      icon: <Icon.Alert className="w-5 h-5" />,
      color: 'from-orange-500/20 to-orange-500/5',
      textColor: 'text-orange-500',
      description: 'Detected real threats',
    },
  ];

  return (
    <Card className="bg-content1/50 border border-white/5 backdrop-blur-sm">
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon.Cpu className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI SOC Performance</h3>
              <p className="text-xs text-default-500">
                {metrics.totalAnalyzed} alerts analyzed
              </p>
            </div>
          </div>
          <Chip size="sm" variant="flat" color="success" className="text-xs">
            Active
          </Chip>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricCards.map((metric, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl bg-gradient-to-br ${metric.color} border border-white/5 hover:border-white/10 transition-all cursor-default`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`${metric.textColor}`}>{metric.icon}</div>
                <span className="text-xs text-default-500 font-medium">{metric.label}</span>
              </div>
              <p className={`text-2xl font-bold ${metric.textColor}`}>{metric.value}</p>
              <p className="text-[10px] text-default-400 mt-1">{metric.description}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
