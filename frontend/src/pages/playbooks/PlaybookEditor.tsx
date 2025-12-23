import { useState, useEffect } from 'react';
import { 
  Button, Card, CardBody, Input, Chip, 
  Textarea, Select, SelectItem, Tabs, Tab,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Spinner, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell
} from "@heroui/react";
import { Icon } from '../../shared/ui';
import { Playbook, PlaybookStep, PlaybooksAPI, Action, PlaybookExecution } from '../../shared/api/playbooks';
import { CasesAPI, Case } from '../../shared/api/cases';

interface PlaybookEditorProps {
    playbook: Playbook;
    onClose: () => void;
    onUpdate: (updated: Playbook) => void;
    onDelete: () => void;
}

export default function PlaybookEditor({ playbook, onClose, onUpdate, onDelete }: PlaybookEditorProps) {
    const [localPlaybook, setLocalPlaybook] = useState<Playbook>(playbook);
    const [activeTab, setActiveTab] = useState('editor');
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
    const [newStepType, setNewStepType] = useState<'manual' | 'automation'>('manual');
    const [newStepActionId, setNewStepActionId] = useState('');
    const [newStepConfig, setNewStepConfig] = useState('');

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

    const addStep = () => {
        if (!newStepName) return;

        let parsedConfig = {};
        if (newStepType === 'automation' && newStepConfig) {
            try {
                parsedConfig = JSON.parse(newStepConfig);
            } catch (e) {
                alert('Invalid JSON Configuration');
                return;
            }
        }

        const newSteps = [...(localPlaybook.steps || []), {
            name: newStepName,
            type: newStepType,
            order: (localPlaybook.steps?.length || 0) + 1,
            description: newStepType === 'manual' ? 'Manual instruction' : `Executes ${newStepActionId}`,
            actionId: newStepType === 'automation' ? newStepActionId : undefined,
            config: newStepType === 'automation' ? parsedConfig : undefined
        }];
        setLocalPlaybook({ ...localPlaybook, steps: newSteps });
        
        // Reset Form
        setNewStepName('');
        setNewStepType('manual');
        setNewStepActionId('');
        setNewStepConfig('');
    };

    const removeStep = (index: number) => {
        const newSteps = [...(localPlaybook.steps || [])];
        newSteps.splice(index, 1);
        setLocalPlaybook({ ...localPlaybook, steps: newSteps });
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
                    <Button size="sm" variant="flat" startContent={<Icon.Download className="w-4 h-4"/>}>Export</Button>
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
                        onSelectionChange={(k) => setActiveTab(k as string)}
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
                        <div className="w-full px-8 space-y-8 pb-20">
                            {/* Start Node */}
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/50 flex items-center justify-center shadow-[0_0_20px_rgba(23,201,100,0.2)] z-10">
                                    <Icon.Signal className="w-8 h-8 text-success" />
                                </div>
                                <div className="h-8 w-px bg-white/20 my-2" />
                                <Chip size="sm" variant="flat" className="bg-content1 border border-white/10">Trigger: {localPlaybook.triggerType}</Chip>
                                <div className="h-8 w-px bg-white/20" />
                                <Icon.ChevronDown className="w-4 h-4 text-white/20 -mt-1" />
                            </div>

                            {/* Steps Graph */}
                            {localPlaybook.steps?.map((step: PlaybookStep, idx: number) => (
                                <div key={idx} className="flex flex-col items-center relative group">
                                        {/* Card */}
                                        <Card className="w-96 border border-white/10 bg-content1/80 backdrop-blur hover:border-primary/50 transition-all shadow-lg text-foreground">
                                            <CardBody className="p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded ${step.type === 'automation' ? 'bg-secondary/10 text-secondary' : 'bg-warning/10 text-warning'}`}>
                                                            {step.type === 'automation' ? <Icon.Cpu className="w-4 h-4"/> : <Icon.User className="w-4 h-4"/>}
                                                        </div>
                                                        <span className="font-semibold">{step.name}</span>
                                                    </div>
                                                    <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => removeStep(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Icon.Delete className="w-4 h-4"/></Button>
                                                </div>
                                                <p className="text-xs text-foreground/60 bg-white/5 p-2 rounded">{step.description || "No parameters configured."}</p>
                                            </CardBody>
                                        </Card>

                                        {/* Connector */}
                                        {idx < (localPlaybook.steps?.length || 0) - 1 && (
                                            <>
                                            <div className="h-8 w-px bg-white/20" />
                                            <Icon.ChevronDown className="w-4 h-4 text-white/20 -mt-1" />
                                            </>
                                        )}
                                </div>
                            ))}

                            {/* Add Button */}
                            <div className="flex justify-center flex-col items-center gap-4">
                                <Card className="w-full max-w-lg border border-white/10 bg-content1/50 p-4">
                                    <h4 className="text-sm font-semibold mb-3">Add Step</h4>
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
                                                onChange={(e) => setNewStepType(e.target.value as 'manual' | 'automation')}
                                            >
                                                <SelectItem key="manual">Manual</SelectItem>
                                                <SelectItem key="automation">Automation</SelectItem>
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
                                                
                                                {newStepActionId && (
                                                    <Textarea
                                                        label="Configuration (JSON)"
                                                        placeholder='{"ip": "1.2.3.4"}'
                                                        minRows={3}
                                                        value={newStepConfig}
                                                        onValueChange={setNewStepConfig}
                                                        description="Enter parameters required by the action."
                                                    />
                                                )}
                                            </div>
                                        )}

                                        <Button color="primary" onPress={addStep} startContent={<Icon.Add className="w-4 h-4"/>} isDisabled={!newStepName}>
                                            Add Step
                                        </Button>
                                    </div>
                                </Card>
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
