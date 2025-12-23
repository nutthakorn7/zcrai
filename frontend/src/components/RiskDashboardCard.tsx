// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Chip, Progress, Divider, Tooltip } from '@heroui/react';
import { api } from '../shared/api/api';
import { Icon } from '../shared/ui';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, 
  ResponsiveContainer, ReferenceLine 
} from 'recharts';

interface RiskData {
  riskScore: {
    overall: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    components: {
      alertVelocity: number;
      severityScore: number;
      fpRate: number;
      trendScore: number;
    };
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  prediction: {
    historical: Array<{ date: string; count: number }>;
    predicted: Array<{ date: string; count: number; confidence: number }>;
    averageDaily: number;
    predictedChange: number;
  };
  alerts: string[];
}

export function RiskDashboardCard() {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiskData();
  }, []);

  const fetchRiskData = async () => {
    try {
      const res = await api.get('/risk/analysis');
      setData(res.data.data);
    } catch (e) {
      // Mock data
      setData({
        riskScore: {
          overall: 62,
          level: 'high',
          components: { alertVelocity: 68, severityScore: 45, fpRate: 28, trendScore: 80 },
          trend: 'increasing'
        },
        prediction: {
          historical: [
            { date: '12-08', count: 45 }, { date: '12-09', count: 52 },
            { date: '12-10', count: 48 }, { date: '12-11', count: 61 },
            { date: '12-12', count: 58 }, { date: '12-13', count: 72 },
            { date: '12-14', count: 85 }
          ],
          predicted: [
            { date: '12-15', count: 92, confidence: 0.93 },
            { date: '12-16', count: 98, confidence: 0.86 },
            { date: '12-17', count: 105, confidence: 0.79 }
          ],
          averageDaily: 60,
          predictedChange: 28
        },
        alerts: [
          '📈 Alert volume increasing. 18% rise detected.',
          '🔮 Predicted 28% increase in alerts next week.'
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
          <div className="animate-pulse">Analyzing risk...</div>
        </CardBody>
      </Card>
    );
  }

  if (!data) return null;

  const { riskScore, prediction, alerts } = data;

  // Combine historical + predicted for chart
  const chartData = [
    ...prediction.historical.map(h => ({ ...h, type: 'actual' })),
    ...prediction.predicted.map(p => ({ ...p, type: 'predicted' }))
  ];

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'secondary';
      default: return 'success';
    }
  };

  const getTrendIcon = () => {
    switch (riskScore.trend) {
      case 'increasing': return <Icon.ArrowUpRight className="w-4 h-4 text-danger" />;
      case 'decreasing': return <Icon.ArrowDownRight className="w-4 h-4 text-success" />;
      default: return <Icon.Minus className="w-4 h-4 text-default-500" />;
    }
  };

  return (
    <Card className="bg-content1/50 border border-white/5">
      <CardHeader className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${getLevelColor(riskScore.level)}/20`}>
            <Icon.Activity className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Risk Analysis</h3>
            <p className="text-xs text-default-500">Predictive threat assessment</p>
          </div>
        </div>
        <Chip 
          color={getLevelColor(riskScore.level)} 
          variant="flat"
          startContent={getTrendIcon()}
        >
          {riskScore.level.toUpperCase()}
        </Chip>
      </CardHeader>

      <CardBody className="px-6 pb-6 space-y-4">
        {/* Risk Score Gauge */}
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48" cy="48" r="38"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-content2"
              />
              <circle
                cx="48" cy="48" r="38"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={`${riskScore.overall * 2.39} 239`}
                strokeLinecap="round"
                className={`text-${getLevelColor(riskScore.level)}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{riskScore.overall}</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-xs">
              <span>Alert Velocity</span>
              <span>{riskScore.components.alertVelocity}%</span>
            </div>
            <Progress value={riskScore.components.alertVelocity} size="sm" color="warning" />
            <div className="flex justify-between text-xs">
              <span>Severity</span>
              <span>{riskScore.components.severityScore}%</span>
            </div>
            <Progress value={riskScore.components.severityScore} size="sm" color="danger" />
          </div>
        </div>

        <Divider />

        {/* Trend Prediction Chart */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">7-Day Prediction</h3>
            <Chip size="sm" color={prediction.predictedChange > 0 ? 'danger' : 'success'} variant="flat">
              {prediction.predictedChange > 0 ? '+' : ''}{prediction.predictedChange}%
            </Chip>
          </div>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                <ChartTooltip 
                  contentStyle={{ background: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                />
                <ReferenceLine y={prediction.averageDaily} stroke="#666" strokeDasharray="3 3" />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#6366F1" 
                  fill="url(#actualGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.slice(0, 2).map((alert, i) => (
              <div key={i} className="flex gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20 text-xs">
                {alert}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
