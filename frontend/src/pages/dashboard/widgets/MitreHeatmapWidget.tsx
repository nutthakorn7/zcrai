import { useMemo } from 'react';
import { Card, CardBody, Tooltip } from "@heroui/react";
import { MitreData } from "../type";

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
    if (count > 50) return 'bg-[#EF4444] text-white hover:bg-[#DC2626]'; // Critical (Red)
    if (count > 20) return 'bg-[#F97316] text-white hover:bg-[#EA580C]'; // High (Orange)
    if (count > 5) return 'bg-[#EAB308] text-black hover:bg-[#CA8A04]'; // Medium (Yellow)
    return 'bg-[#3F3F46] text-white hover:bg-[#52525B]'; // Low (Zinc/Gray)
  };

  return (
    <Card className="bg-content1/50 border border-white/5 w-full overflow-hidden">
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
                                <div className={`w-full py-2 px-1 text-center border-b border-white/5 ${hasCurrentThreats ? 'bg-white/5' : ''}`}>
                                    <h4 className={`text-[9px] font-bold uppercase tracking-tight leading-tight mb-1 break-words h-8 flex items-center justify-center ${hasCurrentThreats ? 'text-foreground' : 'text-default-400'}`}>
                                        {tactic}
                                    </h4>
                                    <div className={`text-[9px] font-mono ${hasCurrentThreats ? 'text-primary' : 'text-default-500'}`}>
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
                                                        <div className="font-bold">{item.mitre_technique}</div>
                                                        <div className="text-xs text-default-400">Attempts: {item.count}</div>
                                                    </div>
                                                }
                                                className="bg-content1 border border-white/10"
                                            >
                                                <div 
                                                    className={`
                                                        w-full p-1.5 rounded text-[9px] leading-tight font-medium transition-all cursor-pointer truncate
                                                        ${getColor(parseInt(item.count))}
                                                        border border-black/10 shadow-sm
                                                    `}
                                                >
                                                    {item.mitre_technique}
                                                </div>
                                            </Tooltip>
                                        ))
                                    ) : (
                                        <div className="h-full flex items-center justify-center opacity-5">
                                            <div className="w-0.5 h-0.5 rounded-full bg-current" />
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
