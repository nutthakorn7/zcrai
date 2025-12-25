import { useState, useEffect } from 'react';
import { 
  Button, Card, CardBody, Input, Chip, 
  Textarea, Select, SelectItem, Tabs, Tab,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Spinner, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Popover, PopoverTrigger, PopoverContent
} from "@heroui/react";
import { Icon } from '../../shared/ui';
import { Playbook, PlaybookStep, PlaybooksAPI, Action, PlaybookExecution } from '../../shared/api/playbooks';
import { CasesAPI, Case } from '../../shared/api/cases';
import { WorkflowCanvas } from './components/WorkflowCanvas';

interface PlaybookEditorProps {
    playbook: Playbook;
    onClose: () => void;
    onUpdate: (updated: Playbook) => void;
    onDelete: () => void;
}

export default function PlaybookEditor({ playbook, onClose, onUpdate, onDelete }: PlaybookEditorProps) {
    const [localPlaybook, setLocalPlaybook] = useState<Playbook>(playbook);
    const [activeTab, setActiveTab] = useState<'editor' | 'runs' | 'settings'>('editor');
    const [isSaving, setIsSaving] = useState(false);
    const [availableActions, setAvailableActions] = useState<Action[]>([]);
    
    // Test Run State
    const [isTestRunOpen, setIsTestRunOpen] = useState(false);
    const [testCases, setTestCases] = useState<Case[]>([]);
    const [selectedCaseId, setSelectedCaseId] = useState('');
    const [isRunning, setIsRunning] = useState(false);

    // Run History State
    const [executions, setExecutions] = useState<PlaybookExecution[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Step Form State
    const [newStepName, setNewStepName] = useState('');
    const [newStepType, setNewStepType] = useState<'manual' | 'automation' | 'condition'>('manual');
    const [newStepActionId, setNewStepActionId] = useState('');
    const [newStepConfig, setNewStepConfig] = useState('');
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);

    useEffect(() => {
        PlaybooksAPI.getActions().then(setAvailableActions).catch(console.error);
    }, []);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const updated = await PlaybooksAPI.update(localPlaybook.id, {
                title: localPlaybook.title,
                description: localPlaybook.description,
                isActive: localPlaybook.isActive,
                steps: localPlaybook.steps 
            });
            onUpdate(updated);
        } catch (e) {
            console.error(e);
            alert('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async () => {
        const newStatus = !localPlaybook.isActive;
        const updated = { ...localPlaybook, isActive: newStatus };
        setLocalPlaybook(updated); // Optimistic
        try {
            await PlaybooksAPI.update(localPlaybook.id, { isActive: newStatus });
            onUpdate(updated);
        } catch (e) {
            console.error(e);
            setLocalPlaybook(localPlaybook); // Revert
            alert('Failed to update status');
        }
    };

    const saveStep = () => {
        if (!newStepName) return;

        let parsedConfig = {};
        if ((newStepType === 'automation' || newStepType === 'condition') && newStepConfig) {
            try {
                parsedConfig = JSON.parse(newStepConfig);
            } catch (e) {
                alert('Invalid JSON Configuration');
                return;
            }
        }

        const stepData: Partial<PlaybookStep> = {
            name: newStepName,
            type: newStepType,
            description: newStepType === 'manual' ? 'Manual instruction' : `Executes ${newStepActionId}`,
            actionId: newStepType === 'automation' ? newStepActionId : undefined,
            config: (newStepType === 'automation' || newStepType === 'condition') ? parsedConfig : undefined
        };

        const newSteps = [...(localPlaybook.steps || [])];
        
        if (editingStepIndex !== null) {
            // Update existing
            newSteps[editingStepIndex] = { 
                ...newSteps[editingStepIndex], 
                ...stepData 
            };
        } else {
            // Add new
            newSteps.push({
                ...stepData as PlaybookStep,
                order: (localPlaybook.steps?.length || 0) + 1
            });
        }

        setLocalPlaybook({ ...localPlaybook, steps: newSteps });
        resetStepForm();
    };

    const resetStepForm = () => {
        setNewStepName('');
        setNewStepType('manual');
        setNewStepActionId('');
        setNewStepConfig('');
        setEditingStepIndex(null);
    };

    const selectStepForEditing = (step: PlaybookStep) => {
        const index = localPlaybook.steps?.findIndex(s => s === step);
        if (index !== undefined && index !== -1) {
            setEditingStepIndex(index);
            setNewStepName(step.name);
            setNewStepType(step.type);
            setNewStepActionId(step.actionId || '');
            setNewStepConfig(step.config ? JSON.stringify(step.config, null, 2) : '');
            
            // Scroll to form?
            document.getElementById('step-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const removeStep = (index: number) => {
        const newSteps = [...(localPlaybook.steps || [])];
        newSteps.splice(index, 1);
        // Correct orders
        const correctedSteps = newSteps.map((s, idx) => ({ ...s, order: idx + 1 }));
        setLocalPlaybook({ ...localPlaybook, steps: correctedSteps });
    };

    const removeStepById = (id: string) => {
        const index = id.startsWith('step-') 
            ? parseInt(id.replace('step-', '')) - 1 
            : localPlaybook.steps?.findIndex(s => s.id === id);
            
        if (index !== undefined && index !== -1) {
            if (confirm('Are you sure you want to delete this step?')) {
                removeStep(index);
            }
        }
    };

    const handleNodePositionChange = (id: string, x: number, y: number) => {
        const index = id.startsWith('step-') 
            ? parseInt(id.replace('step-', '')) - 1 
            : localPlaybook.steps?.findIndex(s => s.id === id);

        if (index !== undefined && index !== -1) {
            const newSteps = [...localPlaybook.steps];
            newSteps[index] = { ...newSteps[index], positionX: x, positionY: y };
            setLocalPlaybook({ ...localPlaybook, steps: newSteps });
        }
    };

    const handleDropStep = (type: string, position: { x: number, y: number }) => {
        const newStep: PlaybookStep = {
            name: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Step`,
            type: type as any,
            order: (localPlaybook.steps?.length || 0) + 1,
            positionX: position.x,
            positionY: position.y
        };

        const newSteps = [...(localPlaybook.steps || []), newStep];
        setLocalPlaybook({ ...localPlaybook, steps: newSteps });
        
        // Auto-select for editing to encourage naming
        selectStepForEditing(newStep);
    };

    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localPlaybook, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", `${localPlaybook.title.replace(/\s+/g, '_')}_playbook.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            try {
                const imported = JSON.parse(text);
                if (imported.steps) {
                    setLocalPlaybook({ ...localPlaybook, ...imported, id: localPlaybook.id }); // Keep local ID
                    alert('Playbook imported successfully!');
                }
            } catch (err) {
                alert('Invalid Playbook JSON');
            }
        };
        input.click();
    };

    // Test Run Logic
    const openTestRun = async () => {
        try {
            setIsTestRunOpen(true);
            const cases = await CasesAPI.list({ status: 'open' }); // Fetch open cases
            setTestCases(cases.slice(0, 10)); // Limit to recent 10
        } catch (e) {
            console.error("Failed to fetch cases for test run", e);
        }
    };

    const handleTestRun = async () => {
        if (!selectedCaseId) return;
        setIsRunning(true);
        try {
            await PlaybooksAPI.run(selectedCaseId, localPlaybook.id);
            alert('Playbook execution started!');
            setIsTestRunOpen(false);
            // Switch to history tab to show it running? 
            setActiveTab('runs');
            loadHistory();
        } catch (e) {
            console.error(e);
            alert('Failed to start playbook run');
        } finally {
            setIsRunning(false);
        }
    };

    const loadHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const data = await PlaybooksAPI.listExecutionsByPlaybook(localPlaybook.id);
            setExecutions(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'runs') {
            loadHistory();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    return (
        <div className="flex-1 flex flex-col min-w-0">
             {/* Header */}
             <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-content1/20 backdrop-blur">
                <div className="flex items-center gap-4">
                    <Button isIconOnly variant="light" onPress={onClose}><Icon.ChevronLeft /></Button>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Icon.Cpu className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">{localPlaybook.title}</h1>
                        <div className="flex items-center gap-2 text-xs text-foreground/60">
                            <span className={localPlaybook.isActive ? 'text-success' : 'text-default-500'}>
                                {localPlaybook.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span>•</span>
                            <span>Created {new Date(localPlaybook.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="flat" startContent={<Icon.Terminal className="w-4 h-4"/>} onPress={openTestRun}>Test Run</Button>
                    <Button size="sm" variant="flat" startContent={<Icon.Upload className="w-4 h-4"/>} onPress={handleImport}>Import</Button>
                    <Button size="sm" variant="flat" startContent={<Icon.Download className="w-4 h-4"/>} onPress={handleExport}>Export</Button>
                    <Button 
                        size="sm" 
                        variant="flat" 
                        color={localPlaybook.isActive ? "success" : "default"} 
                        startContent={localPlaybook.isActive ? <Icon.CheckCircle className="w-4 h-4"/> : <Icon.XCircle className="w-4 h-4"/>}
                        onPress={toggleStatus}
                    >
                        {localPlaybook.isActive ? "Active" : "Inactive"}
                    </Button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 border-b border-white/5">
                    <Tabs 
                        variant="underlined" 
                        aria-label="Playbook tabs"
                        selectedKey={activeTab}
                        onSelectionChange={(k) => setActiveTab(k as any)}
                        classNames={{
                            cursor: "w-full bg-primary",
                            tabContent: "group-data-[selected=true]:text-primary"
                        }}
                    >
                        <Tab key="editor" title="Workflow Editor" />
                        <Tab key="runs" title="Run History" />
                        <Tab key="settings" title="Settings" />
                    </Tabs>
                </div>
                
                <div className="flex-1 overflow-auto bg-grid-pattern p-8 relative">
                        {/* Dotted Grid Background */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                    {activeTab === 'editor' && (
                        <div className="w-full h-full flex gap-6">
                            {/* Step Library Sidebar */}
                            <div className="w-64 flex flex-col gap-4">
                                <Card className="border border-white/5 bg-black/40 backdrop-blur-md">
                                    <div className="p-4 border-b border-white/5">
                                        <h3 className="text-xs font-bold text-foreground/60 uppercase tracking-wider flex items-center gap-2">
                                            <Icon.Dashboard className="w-3.5 h-3.5"/> Step Library
                                        </h3>
                                    </div>
                                    <div className="p-3 space-y-2">
                                        <div 
                                            draggable 
                                            onDragStart={(e) => onDragStart(e, 'automation')}
                                            className="flex flex-col gap-1 p-3 bg-primary/10 border border-primary/20 rounded-lg cursor-grab active:cursor-grabbing hover:bg-primary/20 transition-all group"
                                        >
                                            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                                <Icon.Zap className="w-4 h-4" /> Automation
                                            </div>
                                            <div className="text-[10px] text-foreground/40 leading-tight">Run enrichment, blocking, or scripts.</div>
                                        </div>

                                        <div 
                                            draggable 
                                            onDragStart={(e) => onDragStart(e, 'condition')}
                                            className="flex flex-col gap-1 p-3 bg-secondary/10 border border-secondary/20 rounded-lg cursor-grab active:cursor-grabbing hover:bg-secondary/20 transition-all group"
                                        >
                                            <div className="flex items-center gap-2 text-secondary font-semibold text-sm">
                                                <Icon.TrendingUp className="w-4 h-4" /> Condition
                                            </div>
                                            <div className="text-[10px] text-foreground/40 leading-tight">Branch logic (IF/ELSE) based on data.</div>
                                        </div>

                                        <div 
                                            draggable 
                                            onDragStart={(e) => onDragStart(e, 'manual')}
                                            className="flex flex-col gap-1 p-3 bg-white/5 border border-white/10 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                                                <Icon.User className="w-4 h-4" /> Manual
                                            </div>
                                            <div className="text-[10px] text-foreground/40 leading-tight">Analysts must perform a task.</div>
                                        </div>

                                        <div className="pt-2 text-[10px] text-center text-foreground/30 italic">
                                            Drag and drop onto canvas
                                        </div>
                                    </div>
                                </Card>

                                <div className="mt-auto">
                                     <Button 
                                        color="primary" 
                                        variant="shadow" 
                                        className="w-full font-bold shadow-primary/20"
                                        onPress={handleSave}
                                        isLoading={isSaving}
                                        startContent={<Icon.Check className="w-4 h-4"/>}
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-6">
                                <WorkflowCanvas 
                                    steps={localPlaybook.steps || []} 
                                    onDeleteStep={removeStepById}
                                    onSelectStep={selectStepForEditing}
                                    onNodePositionChange={handleNodePositionChange}
                                    onDropStep={handleDropStep}
                                />

                                {/* Step Configuration Form */}
                                <div id="step-form-anchor" className="flex justify-center flex-col items-center gap-4">
                                    <Card className="w-full border border-white/10 bg-content1/50 p-6 backdrop-blur-md">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-sm font-semibold">{editingStepIndex !== null ? 'Edit Step' : 'Add New Step'}</h3>
                                        {editingStepIndex !== null && (
                                            <Button size="sm" variant="light" color="danger" onPress={resetStepForm}>Cancel Edit</Button>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex gap-2">
                                            <Input 
                                                label="Step Name" 
                                                size="sm"
                                                value={newStepName}
                                                onValueChange={setNewStepName}
                                                className="flex-grow"
                                            />
                                            <Select 
                                                label="Type" 
                                                size="sm" 
                                                className="w-40"
                                                selectedKeys={[newStepType]}
                                                onChange={(e) => setNewStepType(e.target.value as 'manual' | 'automation' | 'condition')}
                                            >
                                                <SelectItem key="manual">Manual</SelectItem>
                                                <SelectItem key="automation">Automation</SelectItem>
                                                <SelectItem key="condition">Condition (If/Else)</SelectItem>
                                            </Select>
                                        </div>

                                        {newStepType === 'automation' && (
                                            <div className="flex flex-col gap-3 p-3 bg-white/5 rounded border border-white/10">
                                                <Select 
                                                    label="Select Action" 
                                                    size="sm"
                                                    selectedKeys={newStepActionId ? [newStepActionId] : []}
                                                    onChange={(e) => setNewStepActionId(e.target.value)}
                                                >
                                                    {availableActions.map(a => (
                                                        <SelectItem key={a.id} textValue={a.name}>
                                                            {a.name}
                                                        </SelectItem>
                                                    ))}
                                                </Select>
                                                {newStepActionId && (() => {
                                                    const selectedAction = availableActions.find(a => a.id === newStepActionId);
                                                    const hasSchema = selectedAction?.schema?.properties;

                                                    if (hasSchema) {
                                                        // Parse existing config or default
                                                        let currentConfig: Record<string, any> = {};
                                                        try { currentConfig = newStepConfig ? JSON.parse(newStepConfig) : {} } catch {}

                                                        return (
                                                            <div className="space-y-3 mt-2 border-t border-white/10 pt-2">
                                                                <div className="text-xs font-semibold text-foreground/70 mb-2">Configure Parameters</div>
                                                                {Object.entries(selectedAction!.schema.properties).map(([key, prop]: [string, any]) => (
                                                                    <div key={key} className="relative">
                                                                        <div className="flex justify-between mb-1">
                                                                            <span className="text-xs">
                                                                                {key} {selectedAction!.schema.required?.includes(key) && <span className="text-danger">*</span>}
                                                                            </span>
                                                                            <span className="text-[10px] text-foreground/50">{prop.description}</span>
                                                                        </div>
                                                                        
                                                                        <div className="flex gap-1">
                                                                            <Input
                                                                                size="sm"
                                                                                placeholder={`Enter ${key}...`}
                                                                                value={currentConfig[key] || ''}
                                                                                onValueChange={(val) => {
                                                                                     const newConf = { ...currentConfig, [key]: val };
                                                                                     setNewStepConfig(JSON.stringify(newConf));
                                                                                }}
                                                                                className="flex-grow"
                                                                            />
                                                                            {/* Variable Helper for this Input */}
                                                                            <Popover placement="bottom-end">
                                                                                <PopoverTrigger>
                                                                                    <Button isIconOnly size="sm" variant="light" className="min-w-8 w-8 h-8"><Icon.Add className="w-4 h-4 text-primary"/></Button>
                                                                                </PopoverTrigger>
                                                                                <PopoverContent className="bg-content1 border border-white/10 p-2">
                                                                                    <div className="text-xs font-bold mb-2 px-2">Insert Variable</div>
                                                                                    <div className="grid grid-cols-1 gap-1 w-48 max-h-48 overflow-y-auto">
                                                                                        {['{{case.id}}', '{{case.source_ip}}', '{{alert.severity}}', '{{alert.destination_ip}}'].map(v => (
                                                                                            <Button key={v} size="sm" variant="flat" className="justify-start h-6 text-xs" onPress={() => {
                                                                                                const newVal = (currentConfig[key] || '') + v;
                                                                                                const newConf = { ...currentConfig, [key]: newVal };
                                                                                                setNewStepConfig(JSON.stringify(newConf));
                                                                                            }}>
                                                                                                {v}
                                                                                            </Button>
                                                                                        ))}
                                                                                    </div>
                                                                                </PopoverContent>
                                                                            </Popover>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                <div className="text-[10px] text-foreground/30 text-center mt-2">
                                                                    Generated Config: <code className="bg-white/5 px-1 rounded">{newStepConfig}</code>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    // Fallback to Raw JSON
                                                    return (
                                                    <div className="relative">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <div className="text-xs text-foreground/60">Using variables: <code className="text-[10px] bg-white/10 px-1 rounded">{`{{case.ip}}`}</code></div>
                                                            <Popover placement="bottom-end">
                                                                <PopoverTrigger>
                                                                    <Button size="sm" variant="light" className="h-6 min-w-0 px-2 text-xs" startContent={<Icon.Add className="w-3 h-3"/>}>Insert Variable</Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="bg-content1 border border-white/10 p-2">
                                                                    <div className="text-xs font-bold mb-2 px-2">Available Variables</div>
                                                                    <div className="grid grid-cols-1 gap-1 w-48 max-h-48 overflow-y-auto">
                                                                        {[
                                                                            '{{case.id}}', '{{case.title}}', '{{case.severity}}', '{{case.description}}',
                                                                            '{{alert.source_ip}}', '{{alert.destination_ip}}', '{{alert.file_hash}}'
                                                                        ].map(v => (
                                                                            <Button key={v} size="sm" variant="flat" className="justify-start h-6 text-xs" onPress={() => setNewStepConfig(prev => prev + `"${v}"`)}>
                                                                                {v}
                                                                            </Button>
                                                                        ))}
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                        <Textarea
                                                            label="Configuration (JSON)"
                                                            placeholder='{"ip": "{{alert.source_ip}}"}'
                                                            minRows={3}
                                                            value={newStepConfig}
                                                            onValueChange={setNewStepConfig}
                                                            description="Enter parameters required by the action."
                                                        />
                                                    </div>
                                                    )
                                                })()}
                                            </div>
                                        )}

                                        {newStepType === 'condition' && (
                                            <div className="flex flex-col gap-3 p-3 bg-white/5 rounded border border-white/10">
                                                <Input
                                                    label="Condition Logic"
                                                    placeholder="{{case.severity}} == critical"
                                                    size="sm"
                                                    value={newStepConfig} // We reuse config field for raw string condition for simplicity in MVP, or JSON
                                                    // Actually, let's use JSON structure: {"condition": "...", "true_step": "...", "false_step": "..."}
                                                    // But for UI, let's just use text inputs and merge them into JSON on save?
                                                    // Refactor: newStepConfig is string. We'll parse it or use separate states?
                                                    // Simpler: Just allow editing the JSON directly for now, with helper description.
                                                    // Or better: Render 3 inputs and update newStepConfig.
                                                    className="hidden" // Hiding raw input, using custom inputs below
                                                />
                                                
                                                <div className="space-y-2">
                                                     <div className="text-xs font-semibold text-foreground/70">If Condition:</div>
                                                     <Input 
                                                        size="sm" 
                                                        placeholder="{{case.severity}} == critical" 
                                                        // This requires state for condition components. 
                                                        // For MVP, let's use the Textarea JSON Config but pre-fill a template.
                                                     />
                                                     <div className="p-2 bg-yellow-500/10 text-yellow-500 text-xs rounded">
                                                        For Conditions, please use JSON format in the config box below:<br/>
                                                        <code>{`{"condition": "{{case.severity}} == critical", "true_step": "3", "false_step": "4"}`}</code>
                                                     </div>
                                                     <Textarea
                                                            label="Condition Configuration (JSON)"
                                                            placeholder='{"condition": "...", "true_step": "...", "false_step": "..."}'
                                                            minRows={4}
                                                            value={newStepConfig}
                                                            onValueChange={setNewStepConfig}
                                                      />
                                                </div>
                                            </div>
                                        )}

                                        <Button 
                                            color="primary" 
                                            onPress={saveStep} 
                                            startContent={editingStepIndex !== null ? <Icon.CheckCircle className="w-4 h-4"/> : <Icon.Plus className="w-4 h-4"/>} 
                                            isDisabled={!newStepName}
                                        >
                                            {editingStepIndex !== null ? 'Update Step' : 'Add Step to Playbook'}
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}
                    
                    {activeTab === 'runs' && (
                        <div className="max-w-4xl mx-auto space-y-4">
                            {isLoadingHistory ? (
                                <div className="flex justify-center p-8"><Spinner /></div>
                            ) : executions.length === 0 ? (
                                <Card className="bg-content1/50 border border-white/5">
                                    <CardBody className="p-6 text-center text-foreground/60">
                                        <Icon.Clock className="w-8 h-8 mx-auto mb-2 opacity-50"/>
                                        <p>No execution history found for this playbook.</p>
                                        <p className="text-xs mt-2">Click "Test Run" to execute it against a case.</p>
                                    </CardBody>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                     <Table aria-label="Execution History">
                                        <TableHeader>
                                            <TableColumn>STATUS</TableColumn>
                                            <TableColumn>STARTED</TableColumn>
                                            <TableColumn>CASE STATUS</TableColumn>
                                            <TableColumn>DURATION</TableColumn>
                                        </TableHeader>
                                        <TableBody items={executions}>
                                            {(run) => (
                                                <TableRow key={run.id}>
                                                    <TableCell>
                                                        <Chip size="sm" color={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'} variant="flat">
                                                            {run.status}
                                                        </Chip>
                                                    </TableCell>
                                                    <TableCell>{new Date(run.startedAt).toLocaleString()}</TableCell>
                                                    <TableCell>
                                                        {run.completedAt ? 'Completed' : 'Running'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {run.completedAt ? 
                                                            `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s` 
                                                            : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <Card className="bg-content1/50 border border-white/5">
                                <CardBody className="p-6 space-y-4">
                                    <h3 className="text-lg font-bold">General Settings</h3>
                                    <Input 
                                        label="Playbook Name" 
                                        value={localPlaybook.title} 
                                        onValueChange={(v) => setLocalPlaybook({...localPlaybook, title: v})}
                                    />
                                    <Textarea 
                                        label="Description" 
                                        value={localPlaybook.description || ''} 
                                        onValueChange={(v) => setLocalPlaybook({...localPlaybook, description: v})}
                                    />
                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                        <div>
                                            <div className="font-medium text-sm">Active Status</div>
                                            <div className="text-xs text-foreground/60">Enable or disable this playbook</div>
                                        </div>
                                        <Chip color={localPlaybook.isActive ? "success" : "default"} variant="flat">{localPlaybook.isActive ? "Enabled" : "Disabled"}</Chip>
                                    </div>
                                </CardBody>
                            </Card>

                            <div className="flex justify-end gap-2">
                                    <Button variant="flat" color="danger" onPress={() => {
                                        if (confirm('Are you sure?')) onDelete();
                                    }}>Delete Playbook</Button>
                                    <Button color="primary" onPress={handleSave} isLoading={isSaving}>Save Changes</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        {/* Test Run Modal */}
        <Modal isOpen={isTestRunOpen} onClose={() => setIsTestRunOpen(false)}>
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader>Test Run Playbook</ModalHeader>
                        <ModalBody>
                             <p className="text-sm text-foreground/60 mb-4">Select a case to run this playbook against. The actions will be executed in the context of the selected case.</p>
                             <Select 
                                label="Select Case" 
                                placeholder="Choose a case..." 
                                selectedKeys={selectedCaseId ? [selectedCaseId] : []}
                                onChange={(e) => setSelectedCaseId(e.target.value)}
                            >
                                {testCases.map(c => (
                                    <SelectItem key={c.id} textValue={c.title}>
                                        <div className="flex flex-col">
                                            <span className="text-small">{c.title}</span>
                                            <span className="text-tiny text-default-500">{c.id.slice(0,8)} • {c.severity}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </Select>
                        </ModalBody>
                        <ModalFooter>
                             <Button variant="light" onPress={onClose}>Cancel</Button>
                             <Button color="primary" onPress={handleTestRun} isLoading={isRunning} isDisabled={!selectedCaseId}>
                                 Run Playbook
                             </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
        </div>
    );
}
