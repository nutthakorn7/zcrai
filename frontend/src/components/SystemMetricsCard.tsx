import { useEffect, useState } from 'react';
import { Card, CardBody } from '@heroui/react';
import { Icon } from '../shared/ui';
import { api } from '../shared/api/api';

interface SystemMetrics {
  uptime: {
    seconds: number;
    formatted: string;
  } | string;
  requests: {
    total: number;
    perSecond?: string;
    lastMinute?: number;
    avgResponseTime?: number; // legacy
  };
  responseTimes?: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  memory: {
    used?: number;
    total?: number;
    rss?: number;
    heapUsed?: number;
    heapTotal?: number;
    external?: number;
    percentage?: number;
  };
  errors?: {
    count: number;
    rate: number;
  };
  process?: {
    pid: number;
    platform: string;
    nodeVersion: string;
    cpuUsage: {
      user: number;
      system: number;
    };
  };
  timestamp?: string;
}

export function SystemMetricsCard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const response = await api.get('/admin/metrics');
      // API might return { success: true, data: { ... } } or just the data
      setMetrics(response.data?.data || response.data || response); 
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

  // Safe accessors
  const uptimeDisplay = (metrics?.uptime && typeof metrics.uptime === 'object' && 'formatted' in metrics.uptime) 
    ? metrics.uptime.formatted 
    : (metrics?.uptime as string) || 'N/A';
  
  // Calculate or fallback values
  const requestsPerMin = metrics?.requests?.lastMinute ?? 
    (metrics?.requests?.perSecond ? Math.round(parseFloat(metrics.requests.perSecond) * 60) : 0);
  
  const avgResponseTime = metrics?.responseTimes?.avg ?? metrics?.requests?.avgResponseTime ?? 0;
  
  // Memory calculation
  let memoryPercentage = 0;
  let memoryUsed = 0;
  let memoryTotal = 0;

  if (metrics?.memory?.percentage !== undefined) {
    memoryPercentage = metrics.memory.percentage;
    memoryUsed = metrics.memory.used || 0;
    memoryTotal = metrics.memory.total || 0;
  } else if (metrics?.memory?.rss && metrics?.memory?.heapTotal) {
    // Fallback if percentage isn't pre-calculated
    memoryUsed = metrics.memory.rss;
    memoryTotal = 0; // Unknown limit
    memoryPercentage = 0;
  }

  const errorCount = metrics?.errors?.count || 0;
  const errorRate = metrics?.errors?.rate || 0;

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
            <p className="text-2xl font-bold">{uptimeDisplay}</p>
          </div>

          {/* Requests */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Icon.Signal className="w-4 h-4" />
              Requests/min
            </div>
            <p className="text-2xl font-bold">{requestsPerMin}</p>
            <p className="text-xs text-foreground/40">
              {metrics?.requests?.total?.toLocaleString() ?? 0} total
            </p>
          </div>

          {/* Response Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Icon.ArrowUpRight className="w-4 h-4" />
              Avg Response
            </div>
            <p className="text-2xl font-bold">{avgResponseTime.toFixed(0)}ms</p>
            <div className={`text-xs ${avgResponseTime < 100 ? 'text-success' : avgResponseTime < 300 ? 'text-warning' : 'text-danger'}`}>
              {avgResponseTime < 100 ? 'Excellent' : avgResponseTime < 300 ? 'Good' : 'Slow'}
            </div>
          </div>

          {/* Memory */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Icon.Database className="w-4 h-4" />
              Memory
            </div>
            {memoryTotal > 0 ? (
                <>
                    <p className="text-2xl font-bold">{memoryPercentage.toFixed(1)}%</p>
                    <p className="text-xs text-foreground/40">
                        {memoryUsed.toFixed(0)} / {memoryTotal.toFixed(0)} MB
                    </p>
                </>
            ) : (
                <>
                     <p className="text-2xl font-bold">{memoryUsed.toFixed(0)} MB</p>
                     <p className="text-xs text-foreground/40">RSS Usage</p>
                </>
            )}
            
          </div>
        </div>

        {/* Memory Progress Bar - only show if we have percentage */}
        {memoryTotal > 0 && (
            <div className="mt-4">
            <div className="h-2 bg-content2 rounded-full overflow-hidden">
                <div 
                className={`h-full transition-all duration-300 ${
                    memoryPercentage < 70 ? 'bg-success' : 
                    memoryPercentage < 85 ? 'bg-warning' : 
                    'bg-danger'
                }`}
                style={{ width: `${Math.min(memoryPercentage, 100)}%` }}
                />
            </div>
            </div>
        )}

        {/* Error Rate */}
        {errorCount > 0 && (
          <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Icon.Alert className="w-4 h-4 text-danger" />
              <span className="text-danger font-medium">
                {errorCount} errors ({(errorRate * 100).toFixed(2)}% error rate)
              </span>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
