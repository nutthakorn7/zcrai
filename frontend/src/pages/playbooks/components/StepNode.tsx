import { Handle, Position } from '@xyflow/react';
import { Card, CardBody } from "@heroui/react";
import { Icon } from '../../../shared/ui';
import { PlaybookStep } from '../../../shared/api/playbooks';

interface StepNodeProps {
  data: {
    step: PlaybookStep;
    onDelete?: (id: string) => void;
  };
}

export function StepNode({ data }: StepNodeProps) {
  const { step } = data;
  const isCondition = step.type === 'condition';

  return (
    <div className="group relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-primary border-2 border-background" />
      
      <Card className="w-64 border border-white/10 bg-content1/90 backdrop-blur hover:border-primary/50 transition-all shadow-xl">
        <CardBody className="p-3">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded ${
                step.type === 'automation' ? 'bg-secondary/10 text-secondary' : 
                step.type === 'condition' ? 'bg-primary/10 text-primary' : 
                'bg-warning/10 text-warning'
              }`}>
                {step.type === 'automation' ? <Icon.Cpu className="w-4 h-4"/> : 
                 step.type === 'condition' ? <Icon.Settings className="w-4 h-4"/> : 
                 <Icon.User className="w-4 h-4"/>}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm truncate w-40">{step.name}</span>
                <span className="text-[10px] text-foreground/50 uppercase">{step.type}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
                {/* Drag Handle */}
                <div className="p-1 text-foreground/20 group-hover:text-foreground/40 cursor-grab active:cursor-grabbing transition-colors">
                    <Icon.Menu className="w-3.5 h-3.5" />
                </div>
                <div className="text-[10px] font-mono bg-white/5 px-1.5 rounded text-foreground/40">#{step.order}</div>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        data.onDelete?.(step.id || `idx-${step.order}`);
                    }}
                    className="p-1 hover:bg-danger/20 hover:text-danger rounded transition-colors text-foreground/30 opacity-0 group-hover:opacity-100"
                >
                    <Icon.Delete className="w-3.5 h-3.5" />
                </button>
            </div>
          </div>
          
          <div className="text-[11px] text-foreground/60 bg-black/20 p-2 rounded line-clamp-2 min-h-10">
            {step.description || "No description provided."}
          </div>

          {isCondition && (
            <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                <div className="text-[9px] text-foreground/40 font-bold uppercase">Condition</div>
                <div className="text-[10px] font-mono text-primary truncate bg-primary/5 px-1 rounded">
                    {step.config?.condition || "N/A"}
                </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Logic for Multiple Outgoing Handles for Conditions */}
      {isCondition ? (
        <>
            <div className="absolute -bottom-6 left-1/4 flex flex-col items-center">
                <div className="text-[9px] font-bold text-success mb-1">TRUE</div>
                <Handle type="source" position={Position.Bottom} id="true" className="w-3 h-3 bg-success border-2 border-background" style={{ left: '0%' }} />
            </div>
            <div className="absolute -bottom-6 right-1/4 flex flex-col items-center">
                <div className="text-[9px] font-bold text-danger mb-1">FALSE</div>
                <Handle type="source" position={Position.Bottom} id="false" className="w-3 h-3 bg-danger border-2 border-background" style={{ left: '100%' }} />
            </div>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary border-2 border-background" />
      )}
    </div>
  );
}
