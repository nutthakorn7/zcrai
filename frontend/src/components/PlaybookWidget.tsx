import { useEffect, useState, useCallback } from 'react';
import { Card, CardBody, CardHeader, Button, Checkbox, Select, SelectItem, Progress, Chip } from "@heroui/react";
import { PlaybooksAPI, Playbook, PlaybookExecution } from '../shared/api/playbooks';
import { Icon } from '../shared/ui';

export function PlaybookWidget({ caseId }: { caseId: string }) {
  const [availablePlaybooks, setAvailablePlaybooks] = useState<Playbook[]>([]);
  const [activeExecutions, setActiveExecutions] = useState<PlaybookExecution[]>([]);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [playbooks, executions] = await Promise.all([
        PlaybooksAPI.list(),
        PlaybooksAPI.listExecutions(caseId)
      ]);
      setAvailablePlaybooks(playbooks.filter(p => p.isActive));
      setActiveExecutions(executions);
    } catch (e) {
      console.error(e);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRun = async () => {
    if (!selectedPlaybookId) return;
    setLoading(true);
    try {
      await PlaybooksAPI.run(caseId, selectedPlaybookId);
      loadData();
      setSelectedPlaybookId('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStepToggle = async (executionId: string, stepId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    // Optimistic update
    const updatedExecutions = activeExecutions.map(ex => {
        if (ex.id === executionId) {
            return {
                ...ex,
                steps: ex.steps.map(s => s.id === stepId ? { ...s, status: newStatus as any } : s)
            };
        }
        return ex;
    });
    setActiveExecutions(updatedExecutions);

    try {
      await PlaybooksAPI.updateStepStatus(executionId, stepId, newStatus);
    } catch (e) {
      console.error("Failed to update step", e);
      loadData(); // Revert
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Launcher */}
      <Card className="bg-content1 border border-white/10">
        <CardBody className="p-3">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Icon.Terminal className="w-4 h-4"/> 
            Run Playbook
          </h3>
          <div className="flex gap-2">
            <Select 
              placeholder="Select SOP..." 
              size="sm" 
              className="flex-grow"
              selectedKeys={selectedPlaybookId ? [selectedPlaybookId] : []}
              onChange={(e) => setSelectedPlaybookId(e.target.value)}
            >
              {availablePlaybooks.map(pb => (
                <SelectItem key={pb.id} textValue={pb.title}>
                    <div className="flex flex-col">
                        <span>{pb.title}</span>
                        <span className="text-tiny text-gray-400">{pb.steps?.length} steps</span>
                    </div>
                </SelectItem>
              ))}
            </Select>
            <Button size="sm" color="primary" onPress={handleRun} isLoading={loading} isDisabled={!selectedPlaybookId}>
              Run
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Active Runs */}
      {activeExecutions.map(ex => {
        const completed = ex.steps.filter(s => s.status === 'completed').length;
        const total = ex.steps.length;
        const percent = total > 0 ? (completed / total) * 100 : 0;

        return (
          <Card key={ex.id} className="bg-content1/50 border border-primary/20">
            <CardHeader className="pb-0 flex justify-between items-start">
                <div>
                     <h3 className="text-sm font-bold text-primary">{ex.playbook?.title || 'Unknown Playbook'}</h3>
                     <p className="text-tiny text-gray-400">Started {new Date(ex.startedAt).toLocaleTimeString()}</p>
                </div>
                <Chip size="sm" variant="flat" color={percent === 100 ? "success" : "warning"}>
                    {percent.toFixed(0)}%
                </Chip>
            </CardHeader>
            <CardBody className="gap-2">
                <Progress size="sm" value={percent} color={percent === 100 ? "success" : "primary"} className="mb-2"/>
                <div className="flex flex-col gap-2">
                    {ex.steps.map(step => (
                        <div key={step.id} className={`flex items-start gap-2 text-sm p-1.5 rounded hover:bg-white/5 ${step.status === 'completed' ? 'opacity-60' : ''}`}>
                             <Checkbox 
                                size="sm" 
                                isSelected={step.status === 'completed'} 
                                onValueChange={() => handleStepToggle(ex.id, step.id, step.status)}
                             />
                             <div className="flex flex-col">
                                 <span className={step.status === 'completed' ? 'line-through decoration-white/30' : ''}>
                                    {step.step.name}
                                 </span>
                                 {step.step.type === 'automation' && (
                                     <span className="text-[10px] text-secondary">
                                        ⚡ Automated
                                     </span>
                                 )}
                             </div>
                        </div>
                    ))}
                </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
