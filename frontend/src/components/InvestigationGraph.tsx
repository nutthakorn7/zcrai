import { useEffect, useState, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Spinner, Card } from "@heroui/react";
import { ObservablesAPI } from '../shared/api/observables';

interface InvestigationGraphProps {
  caseId: string;
  width?: number;
  height?: number;
}

export const InvestigationGraph = ({ caseId, width = 800, height = 600 }: InvestigationGraphProps) => {
  const [data, setData] = useState<any>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const fgRef = useRef<any>();

  // Colors
  const COLORS = {
    case: '#0052CC', // zcrAI Blue
    ip: '#F5A623',
    domain: '#F8E71C',
    email: '#7ED321',
    hash: '#9013FE',
    malicious: '#FF0000',
    safe: '#00FF00',
    unknown: '#9B9B9B'
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Observables
        const observables = await ObservablesAPI.list({ caseId });
        
        // 2. Build Graph Data
        const nodes: any[] = [];
        const links: any[] = [];

        // Central Case Node
        nodes.push({
            id: 'CASE',
            name: 'Create Investigtion', // Placeholder title, ideally passed as prop
            type: 'case',
            val: 20, // Size
            color: COLORS.case
        });

        // Entity Nodes
        observables.forEach(obs => {
            const isMalicious = obs.isMalicious;
            let color = COLORS.unknown;
            
            if (isMalicious === true) color = COLORS.malicious;
            else if (isMalicious === false) color = COLORS.safe;
            else {
                 // Fallback to type color if unknown
                 // @ts-ignore
                 color = COLORS[obs.type] || COLORS.unknown; 
            }

            nodes.push({
                id: obs.id,
                name: obs.value,
                type: obs.type,
                val: 10,
                color: color,
                isMalicious
            });

            // Link Case -> Observable
            links.push({
                source: 'CASE',
                target: obs.id,
                color: '#333' // Link color
            });
        });

        setData({ nodes, links });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (caseId) fetchData();
  }, [caseId]);

  return (
    <Card className="relative overflow-hidden bg-[#0a0a0a] border border-white/10 flex items-center justify-center">
      {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50"><Spinner label="Loading Graph..." /></div>}
      
      {!loading && data.nodes.length === 0 && (
         <div className="text-gray-500">No data to visualize. Add evidence to the case first.</div>
      )}

      {!loading && (
          <ForceGraph2D
            ref={fgRef}
            width={width}
            height={height}
            graphData={data}
            nodeLabel="name"
            nodeRelSize={6}
            linkColor={() => '#ffffff33'} // Semi-transparent white links
            backgroundColor="#00000000" // Transparent
            
            // Custom Node Panting for "Glowing" effect
            nodeCanvasObject={(node: any, ctx, globalScale) => {
                const label = node.name;
                const fontSize = 12/globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                
                // Glow
                if (node.isMalicious) {
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = 'red';
                } else if (node.type === 'case') {
                     ctx.shadowBlur = 15;
                     ctx.shadowColor = 'blue';
                } else {
                    ctx.shadowBlur = 0;
                }

                // Node Circle
                ctx.fillStyle = node.color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
                ctx.fill();

                // Text Label
                ctx.shadowBlur = 0; // Reset shadow for text
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillText(label, node.x, node.y + 8);
            }}
          />
      )}
    </Card>
  );
};
