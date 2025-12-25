// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Progress, Divider, Tooltip } from '@heroui/react';
import { api } from '../shared/api';
import { Icon } from '../shared/ui';

interface TuningRecommendation {
  stats: {
    totalAlerts: number;
    confirmed: number;
    falsePositives: number;
    fpRate: number;
  };
  recommendations: string[];
  topFPPatterns: Array<{
    rule: string;
    source: string;
    severity: string;
    fpCount: number;
    totalCount: number;
    fpRate: number;
  }>;
}

export function FPTuningCard() {
  const [data, setData] = useState<TuningRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const res = await api.get('/alerts/tuning/recommendations');
      setData(res.data.data);
    } catch (e) {
      // Mock data for demo
      setData({
        stats: { totalAlerts: 245, confirmed: 180, falsePositives: 65, fpRate: 0.265 },
        recommendations: [
          'Rule "Brute Force Login" has 72% FP rate from CrowdStrike. Consider tuning threshold.',
          'Alert volume spike detected (+340%). Review correlation rules.',
        ],
        topFPPatterns: [
          { rule: 'Brute Force Login', source: 'CrowdStrike', severity: 'high', fpCount: 18, totalCount: 25, fpRate: 0.72 },
          { rule: 'Suspicious PowerShell', source: 'SentinelOne', severity: 'medium', fpCount: 12, totalCount: 32, fpRate: 0.375 },
          { rule: 'Lateral Movement', source: 'CrowdStrike', severity: 'critical', fpCount: 5, totalCount: 18, fpRate: 0.278 },
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-content1/50 border border-white/5">
        <CardBody className="p-6">
          <div className="animate-pulse">Loading tuning data...</div>
        </CardBody>
      </Card>
    );
  }

  if (!data) return null;

  const { stats, recommendations, topFPPatterns } = data;

  return (
    <Card className="bg-content1/50 border border-white/5">
      <CardHeader className="flex items-center gap-3 px-6 pt-6">
        <div className="p-2 rounded-lg bg-warning/20">
          <Icon.Tune className="w-5 h-5 text-warning" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">False Positive Tuning</h3>
          <p className="text-xs text-default-500">AI-powered detection optimization</p>
        </div>
      </CardHeader>
      
      <CardBody className="px-6 pb-6 space-y-4">
        {/* FP Rate Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-content2/50">
            <div className="text-2xl font-bold">{stats.totalAlerts}</div>
            <div className="text-xs text-default-500">Total Alerts</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-success/10">
            <div className="text-2xl font-bold text-success">{stats.confirmed}</div>
            <div className="text-xs text-default-500">Confirmed</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-danger/10">
            <div className="text-2xl font-bold text-danger">{stats.falsePositives}</div>
            <div className="text-xs text-default-500">False Positives</div>
          </div>
        </div>

        {/* FP Rate Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>False Positive Rate</span>
            <span className={stats.fpRate > 0.3 ? 'text-danger' : stats.fpRate > 0.15 ? 'text-warning' : 'text-success'}>
              {(stats.fpRate * 100).toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={stats.fpRate * 100} 
            color={stats.fpRate > 0.3 ? 'danger' : stats.fpRate > 0.15 ? 'warning' : 'success'}
            size="sm"
          />
        </div>

        <Divider />

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">AI Recommendations</h3>
            {recommendations.map((rec, i) => (
              <div key={i} className="flex gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20">
                <Icon.Lightbulb className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs">{rec}</p>
              </div>
            ))}
          </div>
        )}

        {/* Top FP Patterns */}
        {topFPPatterns.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">High FP Rate Rules</h3>
            {topFPPatterns.slice(0, 3).map((pattern, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-content2/50">
                <div className="flex items-center gap-2">
                  <Chip size="sm" color={
                    pattern.severity === 'critical' ? 'danger' :
                    pattern.severity === 'high' ? 'warning' : 'default'
                  } variant="flat">
                    {pattern.severity}
                  </Chip>
                  <div>
                    <div className="text-sm font-medium">{pattern.rule}</div>
                    <div className="text-xs text-default-500">{pattern.source}</div>
                  </div>
                </div>
                <Tooltip content={`${pattern.fpCount}/${pattern.totalCount} false positives`}>
                  <Chip 
                    size="sm" 
                    color={pattern.fpRate > 0.5 ? 'danger' : 'warning'}
                    variant="flat"
                  >
                    {(pattern.fpRate * 100).toFixed(0)}% FP
                  </Chip>
                </Tooltip>
              </div>
            ))}
          </div>
        )}

        {/* Action Button */}
        <Button 
          color="primary" 
          variant="flat" 
          size="sm" 
          className="w-full"
          startContent={<Icon.Settings className="w-4 h-4" />}
        >
          Open Tuning Panel
        </Button>
      </CardBody>
    </Card>
  );
}
