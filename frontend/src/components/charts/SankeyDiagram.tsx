import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts';

// Custom Node Component
const SankeyNode = (props: any) => {
  const { x, y, width, height, index, payload } = props;
  
  // Choose color based on node name/category logic (can be passed from backend)
  let fill = '#3f3f46'; // default zing-700
  if (payload.name === 'Escalated' || payload.name === 'Malicious') fill = '#f87171'; // red-400
  if (payload.name === 'Not Escalated') fill = '#52525b'; // zinc-600
  if (payload.name === 'Identity') fill = '#818cf8'; // indigo-400
  if (payload.name === 'Email') fill = '#fbbf24'; // amber-400
  
  return (
    <Layer key={`CustomNode${index}`}>
      <Rectangle
        x={x} y={y} width={width} height={height}
        fill={fill}
        fillOpacity="0.8"
      />
      
      {/* Label */}
      <text
        x={x + width + 5}
        y={y + height / 2}
        dy="0.35em"
        textAnchor="start"
        fill="#a1a1aa" // zinc-400
        fontSize={12}
        fontWeight="bold"
      >
        {payload.name} ({payload.value})
      </text>
    </Layer>
  );
};

export function SankeyDiagram({ data }: { data: any }) {
    if (!data || !data.nodes || data.nodes.length === 0) {
        return <div className="h-full flex items-center justify-center text-white/30">No data available for this range</div>;
    }

    // Colors for links (gradients not fully supported in standard Recharts Sankey simple link, utilizing generic stroke)
    // We will use a standard sleek look.
    
    return (
        <ResponsiveContainer width="100%" height="100%">
            <Sankey
                data={data}
                node={<SankeyNode />}
                nodePadding={50}
                margin={{
                    left: 20,
                    right: 150, // Space for labels
                    top: 20,
                    bottom: 20,
                }}
                link={{ stroke: '#52525b', strokeOpacity: 0.3 }} // Subtle links
            >
                <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                />
            </Sankey>
        </ResponsiveContainer>
    );
}
