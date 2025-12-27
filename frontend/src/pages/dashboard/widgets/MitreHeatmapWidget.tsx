import { useMemo } from 'react';
import { Card, CardBody, Tooltip } from "@heroui/react";
import { MitreData } from "../type";
import { useNavigate } from 'react-router-dom';

interface MitreHeatmapProps {
  data: MitreData[];
}

const TACTIC_ORDER = [
  "Reconnaissance",
  "Resource Development",
  "Initial Access", 
  "Execution", 
  "Persistence", 
  "Privilege Escalation",
  "Defense Evasion", 
  "Credential Access", 
  "Discovery", 
  "Lateral Movement",
  "Collection", 
  "Command and Control", 
  "Exfiltration", 
  "Impact"
];

// Mapping for normalization (optional, if DB returns snake_case)
const NORMALIZE_TACTIC: Record<string, string> = {
  'initial_access': 'Initial Access',
  'execution': 'Execution',
  'persistence': 'Persistence',
  'privilege_escalation': 'Privilege Escalation',
  'defense_evasion': 'Defense Evasion',
  'credential_access': 'Credential Access',
  'discovery': 'Discovery',
  'lateral_movement': 'Lateral Movement',
  'collection': 'Collection',
  'command_and_control': 'Command and Control',
  'exfiltration': 'Exfiltration',
  'impact': 'Impact',
  'command_control': 'Command and Control', // Common variation
  'c2': 'Command and Control'
};

export function MitreHeatmapWidget({ data }: MitreHeatmapProps) {
  const navigate = useNavigate();
  
  // 1. Group data by Tactic
  const groupedData = useMemo(() => {
    const map = new Map<string, MitreData[]>();
    
    // Initialize empty arrays for ordered tactics to ensure column existence
    TACTIC_ORDER.forEach(t => map.set(t, []));

    data.forEach(item => {
        if (!item.mitre_tactic) return;

        // Normalize Name
        let tacticName = item.mitre_tactic;
        if (NORMALIZE_TACTIC[tacticName.toLowerCase()]) {
            tacticName = NORMALIZE_TACTIC[tacticName.toLowerCase()];
        } else {
            // Try to match case-insensitive with TACTIC_ORDER
            const match = TACTIC_ORDER.find(t => t.toLowerCase() === tacticName.toLowerCase());
            if (match) tacticName = match;
            // Else keep as is (Custom Tactic)
        }

        const list = map.get(tacticName) || [];
        list.push(item);
        // Sort techniques by count desc
        list.sort((a, b) => parseInt(b.count) - parseInt(a.count));
        map.set(tacticName, list);
    });

    return map;
  }, [data]);

  // 2. Heatmap Color Logic
  const getColor = (count: number) => {
    if (count > 50) return 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'; // Critical
    if (count > 20) return 'bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-500/10'; // High
    if (count > 5) return 'bg-yellow-500 text-black hover:bg-yellow-600 shadow-sm shadow-yellow-500/5'; // Medium
    return 'bg-zinc-700/50 text-foreground/70 hover:bg-zinc-600 hover:text-foreground'; // Low
  };

  return (
    <Card className="bg-content1/30 border border-white/5 w-full overflow-hidden backdrop-blur-sm">
        <CardBody className="p-0">
            <div className="w-full">
                <div className="grid divide-x divide-white/5" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                    {TACTIC_ORDER.map((tactic) => {
                        const strategies = groupedData.get(tactic) || [];
                        const totalCount = strategies.reduce((acc, curr) => acc + parseInt(curr.count), 0);
                        const hasCurrentThreats = totalCount > 0;

                        return (
                            <div key={tactic} className="w-full flex flex-col items-center min-h-[350px]">
                                {/* Header */}
                                <div className={`w-full py-2 px-1 text-center border-b border-white/5 ${hasCurrentThreats ? 'bg-primary/5' : ''}`}>
                                    <h3 className={`text-[9px] font-bold uppercase tracking-tight leading-tight mb-1 break-words h-8 flex items-center justify-center ${hasCurrentThreats ? 'text-primary' : 'text-foreground/40'}`}>
                                        {tactic}
                                    </h3>
                                    <div className={`text-[9px] font-mono ${hasCurrentThreats ? 'text-primary' : 'text-foreground/30'}`}>
                                        {totalCount}
                                    </div>
                                </div>

                                {/* Cells */}
                                <div className="p-1.5 w-full flex flex-col gap-1.5 h-full overflow-y-auto scrollbar-hide">
                                    {strategies.length > 0 ? (
                                        strategies.map((item, idx) => (
                                            <Tooltip 
                                                key={idx} 
                                                content={
                                                    <div className="px-1 py-1">
                                                        <div className="font-bold text-sm text-foreground">{item.mitre_technique || 'Unknown Technique'}</div>
                                                        <div className="text-xs text-foreground/50">Attempts: {item.count || 0}</div>
                                                        <div className="text-[10px] text-primary mt-1">Click to view alerts</div>
                                                    </div>
                                                }
                                                className="bg-content2 border border-white/10"
                                            >
                                                <div 
                                                    onClick={() => navigate(`/alerts?technique=${encodeURIComponent(item.mitre_technique || '')}`)}
                                                    className={`
                                                        w-full p-1.5 rounded text-[9px] leading-tight font-bold transition-all cursor-pointer truncate
                                                        ${getColor(parseInt(item.count || '0') || 0)}
                                                        border border-white/5
                                                    `}
                                                >
                                                    {item.mitre_technique || 'Unknown'}
                                                </div>
                                            </Tooltip>
                                        ))
                                    ) : (
                                        <div className="h-full flex items-center justify-center opacity-10">
                                            <div className="w-0.5 h-0.5 rounded-full bg-foreground" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </CardBody>
    </Card>
  );
}
