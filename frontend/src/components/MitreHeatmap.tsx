// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Chip, Tooltip, Progress } from '@heroui/react';
import { DashboardAPI, MitreData } from '../shared/api/dashboard';
import { Icon } from '../shared/ui';

interface TacticCoverage {
  id: string;
  name: string;
  shortName: string;
  count: number;
  techniques: Array<{ id: string; name: string; count: number }>;
  intensity: number;
}

interface MitreSummary {
  totalDetections: number;
  activeTactics: number;
  totalTactics: number;
  coveragePercent: number;
  topTactics: TacticCoverage[];
}

interface MitreHeatmapProps {
  mode?: 'detection' | 'coverage';
  dateRange?: { startDate: string; endDate: string };
}

// Standard Enterprise Matrix Tactics
const TACTICS_MASTER = [
  { id: 'TA0043', name: 'Reconnaissance', shortName: 'Recon' },
  { id: 'TA0042', name: 'Resource Development', shortName: 'Resource Dev' },
  { id: 'TA0001', name: 'Initial Access', shortName: 'Init Access' },
  { id: 'TA0002', name: 'Execution', shortName: 'Execution' },
  { id: 'TA0003', name: 'Persistence', shortName: 'Persistence' },
  { id: 'TA0004', name: 'Privilege Escalation', shortName: 'Priv Esc' },
  { id: 'TA0005', name: 'Defense Evasion', shortName: 'Def Evasion' },
  { id: 'TA0006', name: 'Credential Access', shortName: 'Cred Access' },
  { id: 'TA0007', name: 'Discovery', shortName: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement', shortName: 'Lat Mvmt' },
  { id: 'TA0009', name: 'Collection', shortName: 'Collection' },
  { id: 'TA0011', name: 'Command and Control', shortName: 'C2' },
  { id: 'TA0010', name: 'Exfiltration', shortName: 'Exfiltration' },
  { id: 'TA0040', name: 'Impact', shortName: 'Impact' },
];

export function MitreHeatmap({ mode = 'detection', dateRange }: MitreHeatmapProps) {
  const [coverage, setCoverage] = useState<TacticCoverage[]>([]);
  const [summary, setSummary] = useState<MitreSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Color logic based on mode
  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return 'bg-content2/50';
    if (mode === 'coverage') {
        // Green/Blue scale for Coverage (Good things)
        if (intensity < 0.25) return 'bg-success/20'; // Low coverage
        if (intensity < 0.5) return 'bg-success/40';
        if (intensity < 0.75) return 'bg-success/60';
        return 'bg-success/80'; // High coverage
    }
    // Red scale for Detections (Bad things)
    if (intensity < 0.25) return 'bg-warning/30';
    if (intensity < 0.5) return 'bg-warning/60';
    if (intensity < 0.75) return 'bg-danger/60';
    return 'bg-danger/80';
  };

  useEffect(() => {
    fetchData();
  }, [mode, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = dateRange?.endDate || new Date().toISOString();

      const response = await DashboardAPI.getMitreHeatmap({
          startDate: start,
          endDate: end,
          mode
      });
      
      processData(response.data);
    } catch (e) {
      console.error("Failed to load MITRE data", e);
      // Fallback empty data if fail
      processData([]);
    } finally {
      setLoading(false);
    }
  };

  const processData = (rawData: MitreData[]) => {
      // 1. Initialize empty map
      const tacticMap = new Map<string, TacticCoverage>();
      TACTICS_MASTER.forEach(t => {
          tacticMap.set(t.name, {
              ...t,
              count: 0,
              techniques: [],
              intensity: 0
          });
      });

      // 2. Fill with data
      let maxCount = 0;
      let totalCount = 0;
      
      rawData.forEach(item => {
          const count = parseInt(item.count, 10);
          totalCount += count;
          
          const tactic = tacticMap.get(item.mitre_tactic);
          if (tactic) {
              tactic.count += count;
              tactic.techniques.push({
                  id: item.mitre_technique || 'Txxxx',
                  name: item.mitre_technique || 'Unknown',
                  count
              });
              if (tactic.count > maxCount) maxCount = tactic.count;
          }
      });

      // 3. Calculate intensity
      const tactics = Array.from(tacticMap.values());
      tactics.forEach(t => {
          t.intensity = maxCount > 0 ? t.count / maxCount : 0;
      });

      // 4. Create summary
      const activeTactics = tactics.filter(t => t.count > 0);
      setCoverage(tactics);
      setSummary({
          totalDetections: totalCount,
          activeTactics: activeTactics.length,
          totalTactics: tactics.length,
          coveragePercent: Math.round((activeTactics.length / tactics.length) * 100),
          topTactics: activeTactics.sort((a, b) => b.count - a.count).slice(0, 5)
      });
  };

  if (loading) {
    return (
      <Card className="bg-content1/50 border border-white/5 h-full">
        <CardBody className="p-6 flex items-center justify-center">
          <div className="animate-pulse">Loading MITRE ATT&CK data...</div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-content1/50 border border-white/5 h-full">
      <CardHeader className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${mode === 'coverage' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
            <Icon.Grid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
                {mode === 'coverage' ? 'Detection Coverage' : 'Threat Activity'}
            </h3>
            <p className="text-xs text-default-500">
                {mode === 'coverage' ? 'Rules mapped to ATT&CK Matrix' : 'Detections in selected period'}
            </p>
          </div>
        </div>
        {summary && (
          <Chip color={mode === 'coverage' ? 'success' : 'danger'} variant="flat">
            {summary.coveragePercent}% {mode === 'coverage' ? 'Coverage' : 'Active'}
          </Chip>
        )}
      </CardHeader>

      <CardBody className="px-6 pb-6 space-y-4">
        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-lg bg-content2/50">
              <div className="text-xl font-bold">{summary.totalDetections}</div>
              <div className="text-xs text-default-500">{mode === 'coverage' ? 'Rules' : 'Events'}</div>
            </div>
            <div className="p-2 rounded-lg bg-content2/50">
              <div className="text-xl font-bold">{summary.activeTactics}/{summary.totalTactics}</div>
              <div className="text-xs text-default-500">Tactics</div>
            </div>
            <div className="p-2 rounded-lg bg-content2/50">
              <div className={`text-xl font-bold ${mode === 'coverage' ? 'text-success' : 'text-danger'}`}>
                {summary.coveragePercent}%
              </div>
              <div className="text-xs text-default-500">Breadth</div>
            </div>
          </div>
        )}

        {/* Heatmap Grid - Responsive Grid (2 cols on small, 4 on medium, 7 on large) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {coverage.map((tactic) => (
            <Tooltip 
              key={tactic.id}
              content={
                <div className="p-2">
                  <div className="font-medium">{tactic.name}</div>
                  <div className="text-xs text-default-400">{tactic.id}</div>
                  <div className="text-sm mt-1">
                      {tactic.count} {mode === 'coverage' ? 'rules' : 'events'}
                  </div>
                  {/* List active techniques if few */}
                  {tactic.techniques.length > 0 && (
                      <div className="mt-2 text-xs text-default-400">
                          {tactic.techniques.slice(0, 3).map((tech, i) => (
                              <div key={i}>{tech.id} ({tech.count})</div>
                          ))}
                          {tactic.techniques.length > 3 && <div>...and {tactic.techniques.length - 3} more</div>}
                      </div>
                  )}
                </div>
              }
            >
              <div 
                className={`p-2 rounded-lg border border-white/5 cursor-default transition-transform hover:scale-105 ${getIntensityColor(tactic.intensity)} h-20 flex flex-col justify-between`}
              >
                <div className="text-[10px] font-medium leading-tight">{tactic.shortName}</div>
                <div className="text-xl font-bold self-end">{tactic.count}</div>
              </div>
            </Tooltip>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-default-500 px-1">
          <span>Low</span>
          <div className="flex gap-1">
            <div className="w-8 h-2 rounded bg-content2/50" />
            <div className={`w-8 h-2 rounded ${mode === 'coverage' ? 'bg-success/20' : 'bg-warning/30'}`} />
            <div className={`w-8 h-2 rounded ${mode === 'coverage' ? 'bg-success/50' : 'bg-warning/60'}`} />
            <div className={`w-8 h-2 rounded ${mode === 'coverage' ? 'bg-success/80' : 'bg-danger/80'}`} />
          </div>
          <span>High</span>
        </div>
      </CardBody>
    </Card>
  );
}

interface MitreSummary {
  totalDetections: number;
  activeTactics: number;
  totalTactics: number;
  coveragePercent: number;
  topTactics: TacticCoverage[];
}

// Color gradient for heatmap
const getIntensityColor = (intensity: number) => {
  if (intensity === 0) return 'bg-content2/50';
  if (intensity < 0.25) return 'bg-success/30';
  if (intensity < 0.5) return 'bg-warning/40';
  if (intensity < 0.75) return 'bg-warning/70';
  return 'bg-danger/80';
};

export function MitreHeatmap() {
  const [coverage, setCoverage] = useState<TacticCoverage[]>([]);
  const [summary, setSummary] = useState<MitreSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [coverageRes, summaryRes] = await Promise.all([
        api.get('/mitre/coverage'),
        api.get('/mitre/summary')
      ]);
      setCoverage(coverageRes.data.data || []);
      setSummary(summaryRes.data.data);
    } catch (e) {
      // Mock data
      const mockCoverage: TacticCoverage[] = [
        { id: 'TA0001', name: 'Initial Access', shortName: 'Initial Access', count: 12, intensity: 0.4, techniques: [] },
        { id: 'TA0002', name: 'Execution', shortName: 'Execution', count: 28, intensity: 0.9, techniques: [] },
        { id: 'TA0003', name: 'Persistence', shortName: 'Persistence', count: 8, intensity: 0.3, techniques: [] },
        { id: 'TA0004', name: 'Privilege Escalation', shortName: 'Priv Esc', count: 15, intensity: 0.5, techniques: [] },
        { id: 'TA0005', name: 'Defense Evasion', shortName: 'Defense Evasion', count: 22, intensity: 0.7, techniques: [] },
        { id: 'TA0006', name: 'Credential Access', shortName: 'Cred Access', count: 31, intensity: 1.0, techniques: [] },
        { id: 'TA0007', name: 'Discovery', shortName: 'Discovery', count: 18, intensity: 0.6, techniques: [] },
        { id: 'TA0008', name: 'Lateral Movement', shortName: 'Lateral Mvmt', count: 5, intensity: 0.15, techniques: [] },
        { id: 'TA0009', name: 'Collection', shortName: 'Collection', count: 7, intensity: 0.23, techniques: [] },
        { id: 'TA0010', name: 'Exfiltration', shortName: 'Exfiltration', count: 3, intensity: 0.1, techniques: [] },
        { id: 'TA0011', name: 'Command and Control', shortName: 'C2', count: 9, intensity: 0.3, techniques: [] },
        { id: 'TA0040', name: 'Impact', shortName: 'Impact', count: 2, intensity: 0.07, techniques: [] },
      ];
      setCoverage(mockCoverage);
      setSummary({
        totalDetections: 160,
        activeTactics: 10,
        totalTactics: 12,
        coveragePercent: 83,
        topTactics: mockCoverage.slice(0, 5)
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-content1/50 border border-white/5">
        <CardBody className="p-6">
          <div className="animate-pulse">Loading MITRE ATT&CK data...</div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-content1/50 border border-white/5">
      <CardHeader className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Icon.Grid className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">MITRE ATT&CK Coverage</h3>
            <p className="text-xs text-default-500">Enterprise Matrix - Last 30 Days</p>
          </div>
        </div>
        {summary && (
          <Chip color="primary" variant="flat">
            {summary.coveragePercent}% Coverage
          </Chip>
        )}
      </CardHeader>

      <CardBody className="px-6 pb-6 space-y-4">
        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-lg bg-content2/50">
              <div className="text-xl font-bold">{summary.totalDetections}</div>
              <div className="text-xs text-default-500">Detections</div>
            </div>
            <div className="p-2 rounded-lg bg-content2/50">
              <div className="text-xl font-bold">{summary.activeTactics}/{summary.totalTactics}</div>
              <div className="text-xs text-default-500">Active Tactics</div>
            </div>
            <div className="p-2 rounded-lg bg-content2/50">
              <div className="text-xl font-bold text-primary">{summary.coveragePercent}%</div>
              <div className="text-xs text-default-500">Coverage</div>
            </div>
          </div>
        )}

        {/* Heatmap Grid */}
        <div className="grid grid-cols-4 gap-2">
          {coverage.map((tactic) => (
            <Tooltip 
              key={tactic.id}
              content={
                <div className="p-2">
                  <div className="font-medium">{tactic.name}</div>
                  <div className="text-xs text-default-400">{tactic.id}</div>
                  <div className="text-sm mt-1">{tactic.count} detections</div>
                </div>
              }
            >
              <div 
                className={`p-3 rounded-lg border border-white/5 cursor-pointer transition-transform hover:scale-105 ${getIntensityColor(tactic.intensity)}`}
              >
                <div className="text-xs font-medium truncate">{tactic.shortName}</div>
                <div className="text-lg font-bold">{tactic.count}</div>
              </div>
            </Tooltip>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-default-500">
          <span>Low Activity</span>
          <div className="flex gap-1">
            <div className="w-6 h-2 rounded bg-content2/50" />
            <div className="w-6 h-2 rounded bg-success/30" />
            <div className="w-6 h-2 rounded bg-warning/40" />
            <div className="w-6 h-2 rounded bg-warning/70" />
            <div className="w-6 h-2 rounded bg-danger/80" />
          </div>
          <span>High Activity</span>
        </div>

        {/* Top Tactics */}
        {summary && summary.topTactics.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Top Tactics</h4>
            {summary.topTactics.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{t.shortName}</span>
                    <span>{t.count}</span>
                  </div>
                  <Progress 
                    value={t.intensity * 100} 
                    size="sm"
                    color={t.intensity > 0.7 ? 'danger' : t.intensity > 0.4 ? 'warning' : 'success'}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
