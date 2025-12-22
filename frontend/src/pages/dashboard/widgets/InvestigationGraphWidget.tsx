import { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Card, CardBody, Button } from "@heroui/react";
import { Icon } from '../../../shared/ui';
import ReactMarkdown from 'react-markdown';

// Mock Data: "The Patient Zero Scenario"
const MOCK_DATA = {
  nodes: [
    { id: 'Attacker', group: 'threat', val: 20, color: '#ef4444', label: 'C2: 178.12.44.9', icon: 'Globe' },
    { id: 'Firewall', group: 'infra', val: 10, color: '#f97316', label: 'Firewall', icon: 'Shield' },
    { id: 'PatientZero', group: 'user', val: 30, color: '#eab308', label: 'Patient Zero (HR-PC)', icon: 'Monitor' },
    { id: 'Malware', group: 'file', val: 15, color: '#a855f7', label: 'dllhostex.exe', icon: 'FileCode' },
    { id: 'FileServer', group: 'server', val: 20, color: '#3b82f6', label: 'File Server 01', icon: 'Server' },
    { id: 'AdminPC', group: 'user', val: 10, color: '#22c55e', label: 'Admin PC', icon: 'User' },
    { id: 'Switch', group: 'infra', val: 5, color: '#71717a', label: 'Core Switch', icon: 'Cpu' },
  ],
  links: [
    { source: 'Attacker', target: 'Firewall', value: 5, label: 'Inbound Scan' },
    { source: 'Firewall', target: 'PatientZero', value: 5, label: 'Phishing Email Allowed' },
    { source: 'PatientZero', target: 'Malware', value: 10, label: 'Executed' },
    { source: 'Malware', target: 'Attacker', value: 8, label: 'C2 Callback' },
    { source: 'Malware', target: 'Switch', value: 3, label: 'Scanning' },
    { source: 'Switch', target: 'FileServer', value: 3, label: 'SMB Access' },
    { source: 'Switch', target: 'AdminPC', value: 1, label: 'Blocked' },
  ]
};

export function InvestigationGraphWidget() {
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ w: 800, h: 400 });
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <Card className="bg-content1/50 border border-white/5 w-full h-[450px]">
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
                graphData={MOCK_DATA}
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
