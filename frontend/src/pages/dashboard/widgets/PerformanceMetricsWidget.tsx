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
}

export function PerformanceMetricsWidget() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
      );
  }

  if (!metrics) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MTTI */}
        <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Mean Time to Investigate</span>
                    <Tooltip content="Target: <5 mins">
                        <Icon.Info className="w-3 h-3 text-gray-600 cursor-help" />
                    </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(metrics.mtti, 5)}`}>
                    {metrics.mtti} <span className="text-sm font-normal text-gray-500">min</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                    Industry Avg: 30 min
                </div>
            </CardBody>
        </Card>

        {/* MTTR */}
        <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Mean Time to Respond</span>
                     <Tooltip content="Target: <30 mins">
                        <Icon.Info className="w-3 h-3 text-gray-600 cursor-help" />
                    </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(metrics.mttr, 30)}`}>
                    {metrics.mttr} <span className="text-sm font-normal text-gray-500">min</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                    Industry Avg: 4 hours
                </div>
            </CardBody>
        </Card>

        {/* Escalation Rate */}
        <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Escalation Rate</span>
                     <Tooltip content="Percentage of alerts that become cases">
                        <Icon.Info className="w-3 h-3 text-gray-600 cursor-help" />
                    </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(metrics.escalationRate, 10)}`}>
                    {metrics.escalationRate}%
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                    Target: &lt;10%
                </div>
            </CardBody>
        </Card>

        {/* Total Cases */}
        <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Active Cases</span>
                    <Icon.Folder className="w-3 h-3 text-gray-600" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                    {metrics.totalCases}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                    Last 30 Days
                </div>
            </CardBody>
        </Card>

        {/* Verdict Accuracy */}
        <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Verdict Accuracy</span>
                     <Tooltip content="Target: >95%">
                        <Icon.Info className="w-3 h-3 text-gray-600 cursor-help" />
                    </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(metrics.verdictAccuracy, 95, true)}`}>
                    {metrics.verdictAccuracy}%
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                    AI Confidence
                </div>
            </CardBody>
        </Card>

        {/* False Positive Rate */}
        <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">False Positive Rate</span>
                     <Tooltip content="Target: <15%">
                        <Icon.Info className="w-3 h-3 text-gray-600 cursor-help" />
                    </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${getMetricColor(metrics.fpr, 15)}`}>
                    {metrics.fpr}%
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                    Target: 70-85% reduction
                </div>
            </CardBody>
        </Card>
    </div>
  );
}
