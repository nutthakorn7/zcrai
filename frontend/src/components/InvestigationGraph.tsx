// Note: Some react-force-graph-2d types use 'any' - consider adding proper types
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardBody, CardHeader, Chip, Button, Spinner, Switch } from '@heroui/react';
import ForceGraph2D from 'react-force-graph-2d';
import { api } from '../shared/api/api';
import { Icon } from '../shared/ui';

interface GraphNode {
  id: string;
  type: 'case' | 'alert' | 'user' | 'ip' | 'host' | 'domain' | 'file' | 'hash' | 'process';
  label: string;
  properties: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  mitreTactic?: string; // [NEW] MITRE Context
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
}

interface InvestigationGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
  };
}

// Color palette for node types
const NODE_COLORS: Record<string, string> = {
  case: '#6366F1',      // Indigo
  alert: '#EF4444',     // Red
  user: '#10B981',      // Green
  ip: '#F59E0B',        // Amber
  host: '#8B5CF6',      // Violet
  domain: '#06B6D4',    // Cyan
  file: '#EC4899',      // Pink
  hash: '#84CC16',      // Lime
  process: '#F43F5E',   // Rose (Process/Action)
};

// MITRE Tactic Colors (Highlights)
const TACTIC_COLORS: Record<string, string> = {
    'Initial Access': '#fbbf24',
    'Execution': '#dc2626',
    'Persistence': '#7c3aed',
    'Privilege Escalation': '#ea580c',
    'Defense Evasion': '#059669',
    'Credential Access': '#db2777',
    'Discovery': '#2563eb',
    'Lateral Movement': '#9333ea',
    'Collection': '#0891b2',
    'Exfiltration': '#be185d',
    'Command and Control': '#b91c1c',
};

// Node size by type
const NODE_SIZES: Record<string, number> = {
  case: 20,
  alert: 16,
  user: 10,
  host: 10,
  process: 8,
  ip: 8,
  domain: 8,
  file: 8,
  hash: 8,
};

interface InvestigationGraphProps {
  caseId?: string;
  alertId?: string;
  className?: string;
}

export function InvestigationGraph({ caseId, alertId, className }: InvestigationGraphProps) {
  const [graphData, setGraphData] = useState<InvestigationGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showMitre, setShowMitre] = useState(false);
  const graphRef = useRef<any>(null);

  console.log('InvestigationGraph Rendered caseId:', caseId);

  // Wrap fetchGraphData in useCallback to satisfy exhaustive-deps
  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      if (caseId) {
        response = await api.get(`/graph/case/${caseId}`);
      } else if (alertId) {
        response = await api.get(`/graph/alert/${alertId}`);
      } else {
        // Mock data for demo
        setGraphData(mockGraphData);
        setLoading(false);
        return;
      }
      setGraphData(response.data.data);
    } catch (e) {
      // Use mock data on error
      setGraphData(mockGraphData);
    } finally {
      setLoading(false);
    }
  }, [caseId, alertId]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    // Center on clicked node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 500);
      graphRef.current.zoom(2, 500);
    }
  }, []);

  const handleReset = () => {
    setSelectedNode(null);
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  };

  if (loading) {
    return (
      <Card className={`bg-content1/50 border border-white/5 ${className}`}>
        <CardBody className="flex items-center justify-center h-[400px]">
          <Spinner size="lg" />
          <span className="ml-3">Building investigation graph...</span>
        </CardBody>
      </Card>
    );
  }

  if (!graphData) {
    return null;
  }

  // Transform data for react-force-graph
  const forceGraphData = {
    nodes: graphData.nodes.map(n => {
        let color = NODE_COLORS[n.type] || '#888';
        let val = NODE_SIZES[n.type] || 8;

        // MITRE Overlay Logic
        if (showMitre && n.mitreTactic) {
            color = TACTIC_COLORS[n.mitreTactic] || color;
            val = val * 1.5; // Emphasize
        }

        return {
          ...n,
          val,
          color,
          borderColor: showMitre && n.mitreTactic ? '#fff' : undefined,
        }
    }),
    links: graphData.edges.map(e => ({
      source: e.source,
      target: e.target,
      label: e.label,
    })),
  };

  // Responsive sizing logic
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        setDimensions(prev => {
           if (prev.width === offsetWidth && prev.height === offsetHeight) {
             return prev;
           }
           return { width: offsetWidth, height: offsetHeight };
        });
      }
    };

    // Initial measure
    updateDimensions();

    // Observer
    const observer = new ResizeObserver(() => {
       requestAnimationFrame(() => {
           updateDimensions();
           // Force graph re-center/fit after resize
           if (graphRef.current) {
             graphRef.current.zoomToFit(200);
           }
       });
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <Card className={`bg-content1/50 border border-white/5 flex flex-col h-full ${className}`}>
      <CardHeader className="flex items-center justify-between px-6 pt-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary/20">
            <Icon.Global className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Investigation Graph</h3>
            <p className="text-xs text-default-500">
              {graphData.summary.totalNodes} nodes, {graphData.summary.totalEdges} edges
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {/* MITRE Toggle */}
           <div className="flex items-center gap-2">
                <span className={`text-xs ${showMitre ? 'text-white font-bold' : 'text-gray-500'}`}>MITRE View</span>
                <Switch size="sm" isSelected={showMitre} onValueChange={setShowMitre} color="danger" />
            </div>

          <Button size="sm" variant="flat" onPress={handleReset}>
            <Icon.ArrowUpRight className="w-4 h-4 mr-1" /> Reset View
          </Button>
        </div>
      </CardHeader>

      <CardBody className="p-0 flex-1 min-h-[400px]">
        <div ref={containerRef} className="relative w-full h-full bg-content2/30 rounded-b-lg overflow-hidden">
          {dimensions.width > 0 && dimensions.height > 0 && (
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={forceGraphData}
            nodeLabel={(node: any) => {
                let label = `${node.type}: ${node.label}`;
                if (showMitre && node.mitreTactic) {
                    label += ` [${node.mitreTactic}]`;
                }
                return label;
            }}
            nodeColor={(node: any) => node.color}
            nodeVal={(node: any) => node.val}
            linkColor={() => 'rgba(255,255,255,0.2)'}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            onNodeClick={handleNodeClick}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.label;
              const fontSize = 10 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              
              // Halo for MITRE nodes
              if (showMitre && node.mitreTactic) {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.val + 2, 0, 2 * Math.PI, false);
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                  ctx.fill();
              }

              // Draw node
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color;
              ctx.fill();
              
              // Draw label below node
              if (globalScale > 0.8 || (showMitre && node.mitreTactic)) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillText(label.substring(0, 15), node.x, node.y + node.val + 2);
                
                // Draw Tactic Label
                if (showMitre && node.mitreTactic) {
                     ctx.font = `bold ${fontSize*0.8}px Sans-Serif`;
                     ctx.fillStyle = '#fbbf24';
                     ctx.fillText(node.mitreTactic.toUpperCase(), node.x, node.y - node.val - (fontSize*1.2));
                }
              }
            }}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            cooldownTicks={100}
            onEngineStop={() => graphRef.current?.zoomToFit(400)}
          />
          )}

          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-content1/80 backdrop-blur-sm rounded-lg p-3 text-xs">
            <div className="font-medium mb-2">Node Types</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Node Panel */}
          {selectedNode && (
            <div className="absolute top-3 right-3 bg-content1/90 backdrop-blur-sm rounded-lg p-4 w-64">
              <div className="flex items-center justify-between mb-2">
                <Chip size="sm" style={{ backgroundColor: selectedNode.mitreTactic && showMitre ? TACTIC_COLORS[selectedNode.mitreTactic] : NODE_COLORS[selectedNode.type] }}>
                  {selectedNode.type}
                </Chip>
                <Button isIconOnly size="sm" variant="light" onPress={() => setSelectedNode(null)}>
                  <Icon.Close className="w-4 h-4" />
                </Button>
              </div>
              <h3 className="font-medium mb-2">{selectedNode.label}</h3>
              {showMitre && selectedNode.mitreTactic && (
                  <div className="mb-2">
                      <Chip size="sm" color="danger" variant="flat" className="text-[10px] w-full">{selectedNode.mitreTactic}</Chip>
                  </div>
              )}
              <div className="space-y-1 text-xs text-default-500">
                {Object.entries(selectedNode.properties).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span className="font-mono">{String(value).substring(0, 20)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// Mock data for demo (Updated with MITRE Tactics)
const mockGraphData: InvestigationGraphData = {
  nodes: [
    { id: 'case-1', type: 'case', label: 'Ransomware Incident', properties: { status: 'open', severity: 'critical' }, severity: 'critical' },
    { id: 'alert-1', type: 'alert', label: 'Suspicious PowerShell', properties: { source: 'EDR' }, severity: 'high', mitreTactic: 'Execution' },
    { id: 'user-1', type: 'user', label: 'john.doe', properties: { role: 'Admin', dept: 'IT' } },
    { id: 'host-1', type: 'host', label: 'WORKSTATION-01', properties: { os: 'Windows 11', ip: '192.168.1.105' } },
    { id: 'proc-1', type: 'process', label: 'powershell.exe', properties: { pid: 4566, cmd: '-enc AAB...' }, mitreTactic: 'Execution' },
    { id: 'ip-1', type: 'ip', label: '185.220.101.1', properties: { country: 'RU', asn: 'AS1234' }, mitreTactic: 'Command and Control' },
    { id: 'file-1', type: 'file', label: 'payload.exe', properties: { size: '45KB' }, mitreTactic: 'Persistence' },
    { id: 'hash-1', type: 'hash', label: 'a1b2c...99', properties: { type: 'SHA256' } }
  ],
  edges: [
    { id: 'e1', source: 'case-1', target: 'alert-1', type: 'contains', label: 'contains' },
    { id: 'e2', source: 'alert-1', target: 'host-1', type: 'detected_on', label: 'on' },
    { id: 'e3', source: 'host-1', target: 'user-1', type: 'logged_in', label: 'user' },
    { id: 'e4', source: 'user-1', target: 'proc-1', type: 'spawned', label: 'ran' },
    { id: 'e5', source: 'proc-1', target: 'ip-1', type: 'network_con', label: 'connects to' },
    { id: 'e6', source: 'proc-1', target: 'file-1', type: 'wrote', label: 'dropped' },
    { id: 'e7', source: 'file-1', target: 'hash-1', type: 'has_hash', label: 'hash' },
  ],
  summary: {
    totalNodes: 8,
    totalEdges: 7,
    nodesByType: { case: 1, alert: 1, user: 1, host: 1, process: 1, ip: 1, file: 1, hash: 1 },
  }
};
