import { useEffect, useState } from 'react';
import { Card, CardBody } from '@heroui/react';
import { Icon } from '../shared/ui';
import { api } from '../shared/api/api';

interface SystemMetrics {
  uptime: string;
  requests: {
    total: number;
    lastMinute: number;
    avgResponseTime: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  errors: {
    count: number;
    rate: number;
  };
}

export function SystemMetricsCard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const response = await api.get('/admin/metrics');
      setMetrics(response.data || response); // Handle both response formats
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="bg-content1/50 backdrop-blur-md border border-white/5">
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/20">
              <Icon.Signal className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">System Metrics</h3>
          </div>
          <p className="text-foreground/60">Loading...</p>
        </CardBody>
      </Card>
    );
  }

  if (!metrics) return null;

  return (
    <Card className="bg-content1/50 backdrop-blur-md border border-white/5">
      <CardBody className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Icon.Signal className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">System Metrics</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/60">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Live
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Uptime */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Icon.Clock className="w-4 h-4" />
              Uptime
            </div>
            <p className="text-2xl font-bold">{metrics.uptime}</p>
          </div>

          {/* Requests */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Icon.Signal className="w-4 h-4" />
              Requests/min
            </div>
            <p className="text-2xl font-bold">{metrics.requests.lastMinute}</p>
            <p className="text-xs text-foreground/40">
              {metrics.requests.total.toLocaleString()} total
            </p>
          </div>

          {/* Response Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Icon.ArrowUpRight className="w-4 h-4" />
              Avg Response
            </div>
            <p className="text-2xl font-bold">{metrics.requests.avgResponseTime}ms</p>
            <div className={`text-xs ${metrics.requests.avgResponseTime < 100 ? 'text-success' : metrics.requests.avgResponseTime < 300 ? 'text-warning' : 'text-danger'}`}>
              {metrics.requests.avgResponseTime < 100 ? 'Excellent' : metrics.requests.avgResponseTime < 300 ? 'Good' : 'Slow'}
            </div>
          </div>

          {/* Memory */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Icon.Database className="w-4 h-4" />
              Memory
            </div>
            <p className="text-2xl font-bold">{metrics.memory.percentage.toFixed(1)}%</p>
            <p className="text-xs text-foreground/40">
              {metrics.memory.used.toFixed(0)} / {metrics.memory.total.toFixed(0)} MB
            </p>
          </div>
        </div>

        {/* Memory Progress Bar */}
        <div className="mt-4">
          <div className="h-2 bg-content2 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                metrics.memory.percentage < 70 ? 'bg-success' : 
                metrics.memory.percentage < 85 ? 'bg-warning' : 
                'bg-danger'
              }`}
              style={{ width: `${metrics.memory.percentage}%` }}
            />
          </div>
        </div>

        {/* Error Rate */}
        {metrics.errors.count > 0 && (
          <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Icon.Alert className="w-4 h-4 text-danger" />
              <span className="text-danger font-medium">
                {metrics.errors.count} errors ({(metrics.errors.rate * 100).toFixed(2)}% error rate)
              </span>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
