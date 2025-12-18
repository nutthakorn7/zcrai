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
      
      // Backend returns {success, data: []} format, not just []
      const mitreData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      processData(mitreData);
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
      <Card className="border border-white/5">
        <CardBody className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-default-500">Loading MITRE {mode === 'coverage' ? 'Coverage' : 'Detection'} Data...</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Guard: If no data after loading, show empty state
  if (!coverage || coverage.length === 0) {
    return (
      <Card className="border border-white/5">
        <CardBody className="flex items-center justify-center h-96">
          <div className="text-center space-y-2">
            <Icon.Layers className="w-16 h-16 mx-auto text-default-300" />
            <p className="text-default-500">No {mode === 'coverage' ? 'coverage' : 'detection'} data available</p>
            <p className="text-xs text-default-400">
              {mode === 'coverage' 
                ? 'Create detection rules to see MITRE ATT&CK coverage'
                : 'No recent detections found for the selected time range'
              }
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border border-white/5">
      <CardHeader className="flex justify-between items-center pb-3">
        <div>
          <h3 className="text-lg font-semibold">
            {mode === 'coverage' ? 'Detection Coverage Matrix' : 'MITRE ATT&CK Detection Heatmap'}
          </h3>
          <p className="text-xs text-default-500">
            {mode === 'coverage' 
              ? 'Rule mapping across Enterprise Matrix tactics'
              : 'Real-time threat detection distribution'
            }
          </p>
        </div>
        {summary && (
          <Chip color={mode === 'coverage' ? 'success' : 'danger'} variant="flat">
            {summary.coveragePercent}% {mode === 'coverage' ? 'Coverage' : 'Active'}
          </Chip>
        )}
      </CardHeader>

      <CardBody className="px-6 pb-6 space-y-4">
        {/* Summary Stats - Only render if summary exists */}
        {summary && summary.totalDetections !== undefined && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-lg bg-content2/50">
              <div className="text-xl font-bold">{summary.totalDetections || 0}</div>
              <div className="text-xs text-default-500">{mode === 'coverage' ? 'Rules' : 'Events'}</div>
            </div>
            <div className="p-2 rounded-lg bg-content2/50">
              <div className="text-xl font-bold">{summary.activeTactics || 0}/{summary.totalTactics || 14}</div>
              <div className="text-xs text-default-500">Tactics</div>
            </div>
            <div className="p-2 rounded-lg bg-content2/50">
              <div className={`text-xl font-bold ${mode === 'coverage' ? 'text-success' : 'text-danger'}`}>
                {summary.coveragePercent || 0}%
              </div>
              <div className="text-xs text-default-500">Breadth</div>
            </div>
          </div>
        )}

        {/* Heatmap Grid - Only render if coverage array exists and has items */}
        {coverage && coverage.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {coverage.map((tactic) => tactic && tactic.id ? (
              <Tooltip 
                key={tactic.id}
                content={
                  <div className="p-2">
                    <div className="font-medium">{tactic.name || 'Unknown'}</div>
                    <div className="text-xs text-default-400">{tactic.id}</div>
                    <div className="text-sm mt-1">
                        {tactic.count || 0} {mode === 'coverage' ? 'rules' : 'events'}
                    </div>
                    {/* List active techniques if any exist */}
                    {tactic.techniques && tactic.techniques.length > 0 && (
                        <div className="mt-2 text-xs text-default-400">
                            {tactic.techniques.slice(0, 3).map((tech, i) => tech && tech.id ? (
                                <div key={`${tactic.id}-tech-${i}`}>{tech.id} ({tech.count || 0})</div>
                            ) : null)}
                            {tactic.techniques.length > 3 && <div>...and {tactic.techniques.length - 3} more</div>}
                        </div>
                    )}
                  </div>
                }
              >
                <div 
                  className={`p-2 rounded-lg border border-white/5 cursor-default transition-transform hover:scale-105 ${getIntensityColor(tactic.intensity || 0)} h-20 flex flex-col justify-between`}
                >
                  <div className="text-[10px] font-medium leading-tight">{tactic.shortName || tactic.name || 'N/A'}</div>
                  <div className="text-xl font-bold self-end">{tactic.count || 0}</div>
                </div>
              </Tooltip>
            ) : null)}
          </div>
        )}

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
