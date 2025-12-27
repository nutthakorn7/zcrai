import { useEffect, useState } from 'react';
import { Card, CardBody, Skeleton, Tooltip } from "@heroui/react";
import { Icon } from '../../../shared/ui';
import { DashboardAPI } from '../../../shared/api/dashboard';

interface PerformanceMetrics {
  mtti: number;
  mttr: number;
  escalationRate: number;
  totalCases: number;
  verdictAccuracy: number;
  fpr: number;
  aiHoursSaved?: number;
  autoClosedCount?: number;
}

export function PerformanceMetricsWidget() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
        setError(false);
        const [perfRes, aiRes] = await Promise.all([
            DashboardAPI.getPerformanceMetrics(),
            DashboardAPI.getAIMetrics()
        ]);
        
        const aiData = aiRes.data || {};
        const fpr = aiData.total_processed > 0 
            ? Math.round((aiData.false_positives / aiData.total_processed) * 100) 
            : 0;

        setMetrics({
            ...perfRes.data,
            verdictAccuracy: aiData.accuracy || 0,
            fpr
        });
    } catch (e) {
        console.error('Failed to load performance metrics', e);
        setError(true);
    } finally {
        setLoading(false);
    }
  };

  const getMetricColor = (val: number, target: number, inverse = false) => {
      const isGood = inverse ? val > target : val <= target;
      if (isGood) return 'text-success';
      if (inverse ? val > target * 0.8 : val <= target * 1.5) return 'text-warning';
      return 'text-danger';
  };

  if (loading) {
      return (
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
      );
  }

  if (error || !metrics) {
    return (
        <Card className="bg-content1/50 border border-white/5 border-dashed">
            <CardBody className="p-8 flex flex-col items-center justify-center text-center">
                <Icon.Alert className="w-8 h-8 text-warning mb-2" />
                <p className="text-sm font-medium text-foreground">Failed to load performance metrics</p>
                <p className="text-xs text-foreground/50 mt-1">Please check your connection or wait a few minutes</p>
                <button 
                    onClick={loadMetrics}
                    className="mt-4 text-xs font-semibold text-primary hover:underline"
                >
                    Retry Loading
                </button>
            </CardBody>
        </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* MTTI */}
        <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-foreground/60 font-semibold uppercase tracking-wider">Investigate (MTTI)</span>
                    <Tooltip content="Target: <5 mins">
                        <Icon.Info className="w-3 h-3 text-foreground/40 cursor-help" />
                    </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(metrics?.mtti ?? 0, 5)}`}>
                    {metrics?.mtti ?? 0} <span className="text-sm font-normal text-foreground/50">min</span>
                </div>
                <div className="text-[10px] text-foreground/50 mt-1">
                    Industry Avg: 30 min
                </div>
            </CardBody>
        </Card>

        {/* MTTR */}
        <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-foreground/60 font-semibold uppercase tracking-wider">Respond (MTTR)</span>
                     <Tooltip content="Target: <30 mins">
                        <Icon.Info className="w-3 h-3 text-foreground/40 cursor-help" />
                    </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(metrics?.mttr ?? 0, 30)}`}>
                    {metrics?.mttr ?? 0} <span className="text-sm font-normal text-foreground/50">min</span>
                </div>
                <div className="text-[10px] text-foreground/50 mt-1">
                    Industry Avg: 4 hours
                </div>
            </CardBody>
        </Card>

        {/* AI ROI - Hours Saved */}
        <Card className="bg-primary/10 border border-primary/20 backdrop-blur-md">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-primary font-bold uppercase tracking-wider">AI TIME SAVED</span>
                     <Tooltip content="Estimated manual labor saved by AI Auto-Triage">
                        <Icon.Cpu className="w-3 h-3 text-primary/60" />
                    </Tooltip>
                </div>
                <div className="text-2xl font-bold text-primary">
                    {metrics?.aiHoursSaved ?? 0} <span className="text-sm font-normal opacity-70">hrs</span>
                </div>
                <div className="text-[10px] text-primary/60 mt-1">
                    {metrics?.autoClosedCount ?? 0} alerts auto-triaged
                </div>
            </CardBody>
        </Card>

        {/* Escalation Rate */}
        <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-foreground/60 font-semibold uppercase tracking-wider">Escalation Rate</span>
                     <Tooltip content="Percentage of alerts that become cases">
                        <Icon.Info className="w-3 h-3 text-foreground/40 cursor-help" />
                    </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(metrics?.escalationRate ?? 0, 10)}`}>
                    {metrics?.escalationRate ?? 0}%
                </div>
                <div className="text-[10px] text-foreground/50 mt-1">
                    Target: &lt;10%
                </div>
            </CardBody>
        </Card>

        {/* Total Cases */}
        <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-foreground/60 font-semibold uppercase tracking-wider">Active Cases</span>
                    <Icon.Folder className="w-3 h-3 text-foreground/40" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                    {metrics?.totalCases ?? 0}
                </div>
                <div className="text-[10px] text-foreground/50 mt-1">
                    Last 30 Days
                </div>
            </CardBody>
        </Card>
    </div>
  );
}
