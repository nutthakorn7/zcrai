import { useMemo, useCallback } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  MarkerType,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { StepNode } from './StepNode';
import { PlaybookStep } from '../../../shared/api/playbooks';

const nodeTypes = {
  step: StepNode,
};

interface WorkflowCanvasProps {
  steps: PlaybookStep[];
  onStepsChange?: (steps: PlaybookStep[]) => void;
  onDeleteStep?: (id: string) => void;
  onSelectStep?: (step: PlaybookStep) => void;
  onNodePositionChange?: (id: string, x: number, y: number) => void;
  onDropStep?: (type: string, position: { x: number, y: number }) => void;
}

export function WorkflowCanvas({ 
  steps, 
  onDeleteStep, 
  onSelectStep, 
  onNodePositionChange,
  onDropStep
}: WorkflowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  // Convert PlaybookSteps to ReactFlow Nodes and Edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Trigger Node (Start)
    nodes.push({
      id: 'start',
      type: 'input',
      data: { label: '▶ START' },
      position: { x: 250, y: 0 },
      className: 'bg-success/20 border-2 border-success text-success font-bold rounded-full w-32 h-10 flex items-center justify-center shadow-[0_0_20px_rgba(23,201,100,0.2)]',
    });

    steps.forEach((step, index) => {
      const nodeId = step.id || `step-${step.order}`;
      
      // Node Position: Use saved position OR fallback to vertical stack
      const position = (step.positionX !== undefined && step.positionY !== undefined && step.positionX !== null && step.positionY !== null)
        ? { x: step.positionX, y: step.positionY }
        : { x: 180, y: 100 + step.order! * 180 };

      nodes.push({
        id: nodeId,
        type: 'step',
        data: { 
            step,
            onDelete: onDeleteStep 
        },
        position,
      });

      // Simple sequential edge from previous OR start
      if (index === 0) {
        edges.push({
          id: `start-${nodeId}`,
          source: 'start',
          target: nodeId,
          animated: true,
          style: { stroke: '#17c964', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#17c964' },
        });
      }

      // Logic-based Edges (Conditionals)
      if (step.type === 'condition') {
        const trueStepOrder = step.config?.true_step;
        const falseStepOrder = step.config?.false_step;

        if (trueStepOrder) {
          const target = steps.find(s => String(s.order) === String(trueStepOrder));
          if (target) {
            edges.push({
              id: `${nodeId}-true-${target.id || `step-${target.order}`}`,
              source: nodeId,
              target: target.id || `step-${target.order}`,
              sourceHandle: 'true',
              label: 'TRUE',
              labelStyle: { fill: '#17c964', fontWeight: 700, fontSize: 10 },
              style: { stroke: '#17c964', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#17c964' },
            });
          }
        }

        if (falseStepOrder) {
          const target = steps.find(s => String(s.order) === String(falseStepOrder));
          if (target) {
            edges.push({
              id: `${nodeId}-false-${target.id || `step-${target.order}`}`,
              source: nodeId,
              target: target.id || `step-${target.order}`,
              sourceHandle: 'false',
              label: 'FALSE',
              labelStyle: { fill: '#f31260', fontWeight: 700, fontSize: 10 },
              style: { stroke: '#f31260', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#f31260' },
            });
          }
        }
      } else {
        // Normal sequential edge (if not the last one)
        const nextStep = steps.find(s => s.order === step.order! + 1);
        if (nextStep) {
          edges.push({
            id: `${nodeId}-${nextStep.id || `step-${nextStep.order}`}`,
            source: nodeId,
            target: nextStep.id || `step-${nextStep.order}`,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#006fee' },
            style: { stroke: '#006fee', strokeWidth: 2 },
          });
        }
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [steps]);

  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds: Edge[]) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');

      // check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (onDropStep) {
        onDropStep(type, position);
      }
    },
    [screenToFlowPosition, onDropStep],
  );

  return (
    <div style={{ height: '700px', width: '100%' }} className="bg-content1/20 rounded-xl border border-white/5 shadow-inner relative">
      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10 text-[10px] text-foreground/50">
        INTERACTIVE CANVAS (DRAGGABLE)
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_: any, node: Node) => {
            if (node.type === 'step' && onSelectStep) {
                onSelectStep(node.data.step as PlaybookStep);
            }
        }}
        onNodeDragStop={(_: any, node: Node) => {
            if (node.type === 'step' && onNodePositionChange) {
                onNodePositionChange(node.id, node.position.x, node.position.y);
            }
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
        snapToGrid={true}
        snapGrid={[10, 10]}
      >
        <Background gap={20} size={1} color="#ffffff10" />
        <Controls />
        <MiniMap 
            nodeColor={(n: any) => {
                if (n.type === 'input') return '#17c96433';
                return '#006fee33';
            }}
            maskColor="rgba(0,0,0,0.5)"
            className="rounded-lg border border-white/10"
            style={{ backgroundColor: '#111' }}
        />
      </ReactFlow>
    </div>
  );
}
