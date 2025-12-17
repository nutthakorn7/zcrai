// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardBody, CardHeader, Chip, Button, Spinner } from '@heroui/react';
import ForceGraph2D from 'react-force-graph-2d';
import { api } from '../shared/api/api';
import { Icon } from '../shared/ui';

interface GraphNode {
  id: string;
  type: 'case' | 'alert' | 'user' | 'ip' | 'host' | 'domain' | 'file' | 'hash' | 'process';
  label: string;
  properties: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
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
  const graphRef = useRef<any>();

  useEffect(() => {
    fetchGraphData();
  }, [caseId, alertId]);

  const fetchGraphData = async () => {
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
  };

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
    nodes: graphData.nodes.map(n => ({
      ...n,
      val: NODE_SIZES[n.type] || 8,
      color: NODE_COLORS[n.type] || '#888',
    })),
    links: graphData.edges.map(e => ({
      source: e.source,
      target: e.target,
      label: e.label,
    })),
  };

  return (
    <Card className={`bg-content1/50 border border-white/5 ${className}`}>
      <CardHeader className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary/20">
            <Icon.Network className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Investigation Graph</h3>
            <p className="text-xs text-default-500">
              {graphData.summary.totalNodes} nodes, {graphData.summary.totalEdges} edges
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="flat" onPress={handleReset}>
            <Icon.Maximize className="w-4 h-4 mr-1" /> Reset View
          </Button>
        </div>
      </CardHeader>

      <CardBody className="p-0">
        <div className="relative h-[400px] bg-content2/30 rounded-b-lg overflow-hidden">
          <ForceGraph2D
            ref={graphRef}
            graphData={forceGraphData}
            nodeLabel={(node: any) => `${node.type}: ${node.label}`}
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
              
              // Draw node
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color;
              ctx.fill();
              
              // Draw label below node
              if (globalScale > 0.8) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillText(label.substring(0, 15), node.x, node.y + node.val + 2);
              }
            }}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            cooldownTicks={100}
            onEngineStop={() => graphRef.current?.zoomToFit(400)}
          />

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
                <Chip size="sm" style={{ backgroundColor: NODE_COLORS[selectedNode.type] }}>
                  {selectedNode.type}
                </Chip>
                <Button isIconOnly size="sm" variant="light" onPress={() => setSelectedNode(null)}>
                  <Icon.X className="w-4 h-4" />
                </Button>
              </div>
              <h4 className="font-medium mb-2">{selectedNode.label}</h4>
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

// Mock data for demo
const mockGraphData: InvestigationGraphData = {
  nodes: [
    // Case Root
    { id: 'case-1', type: 'case', label: 'Ransomware Incident', properties: { status: 'open', severity: 'critical' }, severity: 'critical' },
    
    // Alerts
    { id: 'alert-1', type: 'alert', label: 'Suspicious PowerShell', properties: { source: 'EDR' }, severity: 'high' },
    
    // Entities involved in the chain
    { id: 'user-1', type: 'user', label: 'john.doe', properties: { role: 'Admin', dept: 'IT' } },
    { id: 'host-1', type: 'host', label: 'WORKSTATION-01', properties: { os: 'Windows 11', ip: '192.168.1.105' } },
    { id: 'proc-1', type: 'process', label: 'powershell.exe', properties: { pid: 4566, cmd: '-enc AAB...' } },
    { id: 'ip-1', type: 'ip', label: '185.220.101.1', properties: { country: 'RU', asn: 'AS1234' } },
    
    // Side Artifacts
    { id: 'file-1', type: 'file', label: 'payload.exe', properties: { size: '45KB' } },
    { id: 'hash-1', type: 'hash', label: 'a1b2c...99', properties: { type: 'SHA256' } }
  ],
  edges: [
    // Hierarchy
    { id: 'e1', source: 'case-1', target: 'alert-1', type: 'contains', label: 'contains' },
    
    // The Attack Chain (Story)
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
