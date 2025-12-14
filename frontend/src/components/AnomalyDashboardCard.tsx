import { useState, useEffect } from 'react';
import { Card, CardBody, Chip, Progress, Divider, Button } from '@heroui/react';
import { api } from '../shared/api/api';
import { Icon } from '../shared/ui';
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';

interface AnomalyData {
  metric: string;
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  baseline: number;
  currentValue: number;
  zScore: number;
  change: number;
}

interface TimeSeriesPoint {
  time: string;
  value: number;
  isAnomaly: boolean;
  baseline?: number;
}

// Mock anomaly data
const MOCK_ANOMALIES: AnomalyData[] = [
  {
    metric: 'Alert Volume',
    isAnomaly: true,
    severity: 'high',
    confidence: 0.87,
    baseline: 145,
    currentValue: 423,
    zScore: 4.2,
    change: 191.7,
  },
  {
    metric: 'Login Failures',
    isAnomaly: true,
    severity: 'critical',
    confidence: 0.95,
    baseline: 12,
    currentValue: 89,
    zScore: 5.8,
    change: 641.7,
  },
  {
    metric: 'Network Traffic',
    isAnomaly: false,
    severity: 'low',
    confidence: 0.15,
    baseline: 2.4,
    currentValue: 2.6,
    zScore: 0.8,
    change: 8.3,
  },
  {
    metric: 'API Errors',
    isAnomaly: true,
    severity: 'medium',
    confidence: 0.72,
    baseline: 5,
    currentValue: 23,
    zScore: 3.4,
    change: 360.0,
  },
  {
    metric: 'Memory Usage',
    isAnomaly: false,
    severity: 'low',
    confidence: 0.22,
    baseline: 68,
    currentValue: 72,
    zScore: 1.1,
    change: 5.9,
  },
];

// Mock time series for chart
const generateTimeSeries = (): TimeSeriesPoint[] => {
  const now = Date.now();
  const points: TimeSeriesPoint[] = [];
  const baseline = 150;
  
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now - i * 3600000);
    const isSpike = i === 3 || i === 2; // Anomaly at 2-3 hours ago
    const value = isSpike 
      ? baseline + Math.random() * 200 + 150 
      : baseline + (Math.random() - 0.5) * 40;
    
    points.push({
      time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      value: Math.round(value),
      isAnomaly: isSpike,
      baseline,
    });
  }
  
  return points;
};

export function AnomalyDashboardCard() {
  const [anomalies, setAnomalies] = useState<AnomalyData[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const fetchAnomalies = async () => {
    try {
      const response = await api.get('/ml/anomalies');
      setAnomalies(response.data?.anomalies || MOCK_ANOMALIES);
      setTimeSeries(response.data?.timeSeries || generateTimeSeries());
    } catch (error) {
      setAnomalies(MOCK_ANOMALIES);
      setTimeSeries(generateTimeSeries());
    } finally {
      setLoading(false);
    }
  };

  const activeAnomalies = anomalies.filter(a => a.isAnomaly);
  const displayAnomalies = showAll ? anomalies : anomalies.slice(0, 4);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'secondary';
      default: return 'default';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-danger/10 border-danger/30';
      case 'high': return 'bg-warning/10 border-warning/30';
      case 'medium': return 'bg-secondary/10 border-secondary/30';
      default: return 'bg-content2/50 border-white/5';
    }
  };

  if (loading) {
    return (
      <Card className="bg-content1/50 backdrop-blur-md border border-white/5">
        <CardBody className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-secondary/20">
              <Icon.Cpu className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="text-lg font-semibold">ML Anomaly Detection</h3>
          </div>
          <p className="text-foreground/60">Analyzing patterns...</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-content1/50 backdrop-blur-md border border-white/5">
      <CardBody className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/20">
              <Icon.Cpu className="w-5 h-5 text-secondary animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">ML Anomaly Detection</h3>
              <p className="text-xs text-foreground/60">Z-score statistical analysis</p>
            </div>
          </div>
          {activeAnomalies.length > 0 && (
            <Chip color="danger" variant="flat" startContent={<Icon.Alert className="w-4 h-4" />}>
              {activeAnomalies.length} Active {activeAnomalies.length === 1 ? 'Anomaly' : 'Anomalies'}
            </Chip>
          )}
        </div>

        {/* Time Series Chart */}
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeSeries}>
              <defs>
                <linearGradient id="anomalyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10, fill: '#888' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#888' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#fff' }}
              />
              <ReferenceLine 
                y={150} 
                stroke="#666" 
                strokeDasharray="3 3" 
                label={{ value: 'Baseline', fill: '#666', fontSize: 10 }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#7c3aed" 
                fill="url(#anomalyGradient)" 
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#7c3aed" 
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.isAnomaly) {
                    return (
                      <circle 
                        key={`dot-${cx}-${cy}`}
                        cx={cx} 
                        cy={cy} 
                        r={6} 
                        fill="#ef4444" 
                        stroke="#fff" 
                        strokeWidth={2}
                      />
                    );
                  }
                  return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={0} />;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <Divider />

        {/* Anomaly List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-sm">Monitored Metrics</h4>
            {anomalies.length > 4 && (
              <Button 
                size="sm" 
                variant="light" 
                onPress={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show Less' : `Show All (${anomalies.length})`}
              </Button>
            )}
          </div>

          {displayAnomalies.map((anomaly, idx) => (
            <div 
              key={idx} 
              className={`p-3 rounded-lg border ${getSeverityBg(anomaly.isAnomaly ? anomaly.severity : 'low')}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{anomaly.metric}</span>
                  {anomaly.isAnomaly && (
                    <Chip 
                      size="sm" 
                      color={getSeverityColor(anomaly.severity)} 
                      variant="flat"
                      className="uppercase text-[10px]"
                    >
                      {anomaly.severity}
                    </Chip>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${anomaly.isAnomaly ? 'text-danger' : 'text-foreground'}`}>
                    {anomaly.currentValue}
                  </span>
                  <span className="text-xs text-foreground/60 ml-1">
                    / {anomaly.baseline} baseline
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-foreground/60">
                    Z-Score: <span className={anomaly.isAnomaly ? 'text-danger font-medium' : ''}>{anomaly.zScore}</span>
                  </span>
                  <span className="text-foreground/60">
                    Confidence: {(anomaly.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className={`flex items-center gap-1 ${anomaly.change > 50 ? 'text-danger' : anomaly.change > 20 ? 'text-warning' : 'text-success'}`}>
                  <Icon.ArrowUpRight className="w-3 h-3" />
                  <span>{anomaly.change > 0 ? '+' : ''}{anomaly.change.toFixed(1)}%</span>
                </div>
              </div>

              {anomaly.isAnomaly && (
                <Progress 
                  value={anomaly.confidence * 100} 
                  size="sm" 
                  color={getSeverityColor(anomaly.severity)}
                  className="mt-2"
                />
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-xs text-foreground/60 pt-2">
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
          <span>{activeAnomalies.length} of {anomalies.length} metrics anomalous</span>
        </div>
      </CardBody>
    </Card>
  );
}
