import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts';

// Color mapping for different node types
const getNodeColor = (nodeName: string): string => {
  // Sources (Ingestion stage)
  if (nodeName.includes('Sentinel')) return '#818cf8'; // indigo
  if (nodeName.includes('Defender')) return '#f59e0b'; // amber
  
  // Categories
  if (nodeName === 'Identity') return '#8b5cf6'; // purple
  if (nodeName === 'Email') return '#ec4899'; // pink
  if (nodeName === 'Cloud') return '#06b6d4'; // cyan
  if (nodeName === 'EDR') return '#f97316'; // orange
  
  // Enrichment (MITRE ATT&CK Tactics)
  if (nodeName === 'Initial Access') return '#ef4444'; // red
  if (nodeName === 'Execution') return '#f97316'; // orange
  if (nodeName === 'Persistence') return '#eab308'; // yellow
  if (nodeName === 'Privilege Escalation') return '#84cc16'; // lime
  if (nodeName === 'Defense Evasion') return '#22c55e'; // green
  if (nodeName === 'Credential Access') return '#14b8a6'; // teal
  if (nodeName === 'Discovery') return '#06b6d4'; // cyan
  if (nodeName === 'Lateral Movement') return '#3b82f6'; // blue
  if (nodeName === 'Collection') return '#8b5cf6'; // violet
  if (nodeName === 'Command And Control') return '#a855f7'; // purple
  if (nodeName === 'Exfiltration') return '#d946ef'; // fuchsia
  if (nodeName === 'Impact') return '#ec4899'; // pink
  if (nodeName === 'Other') return '#6b7280'; // gray
  
  // Triage
  if (nodeName === 'Escalated') return '#ef4444'; // red
  if (nodeName === 'Not Escalated') return '#52525b'; // zinc-600
  
  // Determinations
  if (nodeName === 'Malicious') return '#dc2626'; // red-600
  if (nodeName === 'Suspicious') return '#f97316'; // orange
  if (nodeName === 'Review Recommended') return '#eab308'; // yellow
  if (nodeName === 'Acceptable Risk') return '#a78bfa'; // purple-400
  if (nodeName === 'Mitigated') return '#22c55e'; // green
  if (nodeName === 'Benign') return '#6b7280'; // gray
  
  // Status
  if (nodeName === 'Open') return '#f59e0b'; // amber
  if (nodeName === 'In Progress') return '#3b82f6'; // blue
  if (nodeName === 'Closed') return '#22c55e'; // green
  
  // Default
  return '#3f3f46'; // zinc-700
};

// Custom Node Component
const SankeyNode = (props: any) => {
  const { x, y, width, height, index, payload } = props;
  const fill = getNodeColor(payload.name);
  
  return (
    <Layer key={`CustomNode${index}`}>
      <Rectangle
        x={x} y={y} width={width} height={height}
        fill={fill}
        fillOpacity="0.9"
        rx={4}
      />
      
      {/* Label */}
      <text
        x={x + width + 8}
        y={y + height / 2}
        dy="0.35em"
        textAnchor="start"
        fill="#e4e4e7" // zinc-200
        fontSize={11}
        fontWeight="600"
      >
        {payload.name}
      </text>
      
      {/* Value */}
      <text
        x={x + width / 2}
        y={y + height / 2}
        dy="0.35em"
        textAnchor="middle"
        fill="#ffffff"
        fontSize={10}
        fontWeight="bold"
      >
        {payload.value}
      </text>
    </Layer>
  );
};

export function SankeyDiagram({ data }: { data: any }) {
    if (!data || !data.nodes || data.nodes.length === 0) {
        return <div className="h-full flex items-center justify-center text-white/30">No data available for this range</div>;
    }
    
    return (
        <ResponsiveContainer width="100%" height="100%">
            <Sankey
                data={data}
                node={<SankeyNode />}
                nodePadding={40}
                margin={{
                    left: 20,
                    right: 200, // Space for labels
                    top: 20,
                    bottom: 20,
                }}
                link={{ stroke: '#52525b', strokeOpacity: 0.2 }}
            >
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: '#18181b', 
                        borderColor: '#27272a', 
                        borderRadius: '8px',
                        fontSize: '12px'
                    }}
                    itemStyle={{ color: '#e4e4e7' }}
                />
            </Sankey>
        </ResponsiveContainer>
    );
}
