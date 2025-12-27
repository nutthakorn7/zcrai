import { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Card, CardBody, Button, Spinner } from "@heroui/react";
import { Icon } from '../../../shared/ui';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';

interface InvestigationGraphWidgetProps {
  alertId?: string;
  className?: string;
}

export function InvestigationGraphWidget({ alertId, className }: InvestigationGraphWidgetProps) {
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ w: 800, h: 400 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Responsive Resize
    const updateSize = () => {
        if (containerRef.current) {
            setDimensions({
                w: containerRef.current.offsetWidth,
                h: 400
            });
        }
    };

    window.addEventListener('resize', updateSize);
    updateSize(); // Initial

    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Fetch Real Graph Data if alertId is present, otherwise try to auto-fetch latest
  const [_isRealData, setIsRealData] = useState(false);

  useEffect(() => {
    if (alertId) {
        loadGraphData();
    } else {
        // Try to auto-load latest correlated alert
        loadLatestCorrelated();
    }
  }, [alertId]);

  const loadLatestCorrelated = async () => {
    try {
        setLoading(true);
        const { api } = await import('../../../shared/api');
        const res = await api.get('/graph/latest-correlated');
        
        if (res.data.success && res.data.data) {
            const { graph } = res.data.data;
            const formattedData = {
                nodes: graph.nodes.map((n: any) => ({
                    ...n,
                    color: getEntityColor(n.type),
                    icon: getEntityIcon(n.type)
                })),
                links: graph.edges.map((e: any) => ({
                    source: e.source,
                    target: e.target,
                    label: e.label,
                    value: 2
                }))
            };
            setGraphData(formattedData);
            setIsRealData(true);
        } else {
            // Fallback to demo data
            loadDemoData();
        }
    } catch (error) {
        console.error('Failed to load latest correlated:', error);
        loadDemoData();
    } finally {
        setLoading(false);
    }
  };

  const loadDemoData = () => {
    // Demo data showing a simulated lateral movement attack
    const demoNodes = [
      { id: 'alert-1', label: 'Ransomware Detected', type: 'alert', val: 25 },
      { id: 'ip-1', label: '178.12.44.9', type: 'ip', properties: { value: '178.12.44.9' }, val: 15 },
      { id: 'host-1', label: 'HR-PC', type: 'host', properties: { value: 'HR-PC' }, val: 18 },
      { id: 'host-2', label: 'FileServer01', type: 'host', properties: { value: 'FileServer01' }, val: 18 },
      { id: 'user-1', label: 'jsmith', type: 'user', properties: { value: 'jsmith' }, val: 12 },
      { id: 'file-1', label: 'dllhostex.exe', type: 'file', properties: { value: 'dllhostex.exe' }, val: 10 },
    ];

    const demoLinks = [
      { source: 'ip-1', target: 'host-1', label: 'connected' },
      { source: 'host-1', target: 'alert-1', label: 'triggered' },
      { source: 'user-1', target: 'host-1', label: 'logged_in' },
      { source: 'file-1', target: 'host-1', label: 'executed' },
      { source: 'host-1', target: 'host-2', label: 'lateral_move' },
    ];

    setGraphData({
      nodes: demoNodes.map(n => ({
        ...n,
        color: getEntityColor(n.type),
        icon: getEntityIcon(n.type)
      })),
      links: demoLinks.map(e => ({
        ...e,
        value: 2
      }))
    });
    setIsRealData(false);
  };

  const loadGraphData = async () => {
    if (!alertId) return;
    try {
        setLoading(true);
        // Dynamic import to avoid circular dep issues if any, or just standard import
        const { api } = await import('../../../shared/api');
        const res = await api.get(`/graph/alert/${alertId}`);
        if(res.data.success) {
            const { nodes, edges } = res.data.data || { nodes: [], edges: [] };
            const formattedData = {
                nodes: (nodes || []).map((n: any) => ({
                    ...n,
                    val: n.val || (n.type === 'alert' ? 20 : 10),
                    color: getEntityColor(n.type || 'unknown'),
                    icon: getEntityIcon(n.type || 'unknown')
                })),
                links: (edges || []).map((e: any) => ({
                    source: e.source,
                    target: e.target,
                    label: e.label,
                    value: 2
                }))
            };
            setGraphData(formattedData);
        }
    } catch (error) {
        console.error('Failed to load graph:', error);
    } finally {
        setLoading(false);
    }
  };
  
  const getEntityColor = (type: string) => {
      switch(type) {
          case 'alert': return '#ef4444'; // Red
          case 'ip': return '#f97316'; // Orange
          case 'host': return '#3b82f6'; // Blue
          case 'user': return '#22c55e'; // Green
          case 'file': return '#a855f7'; // Purple
          case 'hash': return '#a855f7';
          default: return '#71717a'; // Gray
      }
  };

  const getEntityIcon = (type: string) => {
      switch(type) {
          case 'alert': return 'AlertTriangle';
          case 'ip': return 'Globe';
          case 'host': return 'Monitor';
          case 'user': return 'User';
          case 'file': return 'File';
          case 'hash': return 'FileCode';
          default: return 'Circle';
      }
  };

  /* AI Analysis State */
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    // Mock AI Delay
    setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisResult(`
### 🕵️‍♂️ AI Investigation Report
**Severity:** 🚨 Critical
**Incident:** Lateral Movement via SMB

**Analysis:**
1. **Initial Access:** The attack originated from **178.12.44.9** (Known C2).
2. **Compromise:** **Patient Zero (HR-PC)** executed **dllhostex.exe**.
3. **Impact:** Successful lateral movement to **File Server 01**.

**Recommendation:**
- Isolate **HR-PC** immediately.
- Block IP **178.12.44.9**.
        `);
    }, 2500);
  };

  const handleNodeClick = (node: any) => {
      if (node.id.startsWith('alert-')) {
          // Maybe show alert details or do nothing for now
          return; 
      }
      
      const value = node.properties?.value || node.label;
      if (value && value !== 'unknown') {
          // Open Hunting page with query
          const query = `*${value}*`;
          // window.open(`/hunting?query=${encodeURIComponent(query)}`, '_blank');
          navigate(`/hunting?query=${encodeURIComponent(query)}`);
      }
  };

  return (
    <Card className={`bg-content1/50 border border-white/5 w-full h-[450px] ${className || ''}`}>
        <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button 
                size="sm" 
                variant="shadow" 
                color="secondary" 
                isLoading={isAnalyzing}
                startContent={!isAnalyzing && <Icon.Cpu className="w-3 h-3" />} 
                onPress={handleAnalyze}
            >
                {isAnalyzing ? 'Analyzing Graph...' : 'Ask AI Analyst'}
            </Button>

            <Button size="sm" variant="flat" color="primary" isIconOnly onPress={() => {
                fgRef.current?.d3ReheatSimulation();
                fgRef.current?.zoomToFit(400);
            }}>
                <Icon.Refresh className="w-4 h-4" />
            </Button>
        </div>

        {/* Loading State */}
        {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <Spinner color="primary" label="Building Investigation Graph..." />
            </div>
        )}

        {/* Empty State */}
        {!loading && (!graphData.nodes || graphData.nodes.length === 0) && (
             <div className="absolute inset-0 flex items-center justify-center text-foreground/40">
                 <div className="text-center">
                     <Icon.Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
                     <p>No investigation data available</p>
                     <p className="text-xs">Select an alert to view relationships</p>
                 </div>
             </div>
        )}

        {/* AI Result Overlay */}
        {analysisResult && (
            <div className="absolute bottom-4 right-4 max-w-sm z-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="bg-black/80 backdrop-blur-md border border-purple-500/30">
                    <CardBody className="p-4">
                        <div className="prose prose-invert prose-xs">
                            <ReactMarkdown>{analysisResult}</ReactMarkdown>
                        </div>
                        <Button size="sm" variant="light" color="danger" className="mt-2 w-full" onPress={() => setAnalysisResult(null)}>
                            Close Analysis
                        </Button>
                    </CardBody>
                </Card>
            </div>
        )}

        <CardBody className="p-0 overflow-hidden relative">
            <div ref={containerRef} className="w-full h-full">
             <ForceGraph2D
                ref={fgRef}
                width={dimensions.w}
                height={dimensions.h}
                graphData={graphData}
                backgroundColor="rgba(0,0,0,0)" // Transparent
                nodeLabel="label"
                nodeColor={node => (node as any).color}
                nodeRelSize={6}
                linkColor={() => 'rgba(255,255,255,0.2)'}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={d => (d as any).value * 0.001}
                d3VelocityDecay={0.3}
                cooldownTicks={100}
                onEngineStop={() => fgRef.current?.zoomToFit(400)}
                onNodeClick={handleNodeClick}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    // Custom Node Rendering
                    const label = node.label;
                    const fontSize = 12/globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

                    // Draw Node Circle
                    ctx.fillStyle = node.color;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
                    ctx.fill();

                    // Draw Label Background
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2 - 10, bckgDimensions[0], bckgDimensions[1]);

                    // Draw Text
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = node.color;
                    ctx.fillText(label, node.x, node.y - 10);
                }}
             />
            </div>
        </CardBody>
    </Card>
  );
}
