import { useEffect, useState } from 'react';
import { 
  Button, Card, CardBody, Input, Chip, 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Textarea, Select, SelectItem, Tabs, Tab, ScrollShadow
} from "@heroui/react";
import { Icon } from '../../shared/ui';
import { PlaybooksAPI, Playbook, PlaybookStep } from '../../shared/api/playbooks';

// Mock Templates
const TEMPLATES = [
  { id: 't1', title: 'Phishing Investigation', description: 'Analyze email headers and URLs.', steps: 3, type: 'automation' },
  { id: 't2', title: 'Malware Containment', description: 'Isolate host and block hash.', steps: 5, type: 'automation' },
  { id: 't3', title: 'User Onboarding', description: 'Provision accounts and send welcome email.', steps: 4, type: 'manual' },
];

const MOCK_RUNS = [
    { id: 'r1', playbook: 'Phishing Investigation', status: 'success', duration: '45s', user: 'admin', time: '2 mins ago' },
    { id: 'r2', playbook: 'Malware Containment', status: 'failed', duration: '12s', user: 'system', time: '1 hour ago' },
    { id: 'r3', playbook: 'Phishing Investigation', status: 'success', duration: '42s', user: 'admin', time: '3 hours ago' },
];

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  // Using simple state for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<PlaybookStep[]>([]);
  
  // Step Form
  const [newStepName, setNewStepName] = useState('');
  const [newStepType, setNewStepType] = useState<'manual' | 'automation'>('manual');

  // Editor State
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [activeTab, setActiveTab] = useState('editor');

  useEffect(() => {
    loadPlaybooks();
  }, []);

  const loadPlaybooks = async () => {
    try {
      const data = await PlaybooksAPI.list();
      setPlaybooks(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectTemplate = (t: any) => {
    setTitle(t.title);
    setDescription(t.description);
    setSteps([
        { name: 'Start', type: 'manual', order: 1, description: 'Trigger Event' },
        { name: 'Analyze', type: 'automation', order: 2, description: 'Run analysis script' },
        { name: 'Decision', type: 'manual', order: 3, description: 'Human approval' },
    ]);
    setNewStepName('');
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setTitle('');
    setDescription('');
    setSteps([]);
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      if (!title) return;
      await PlaybooksAPI.create({
        title,
        description,
        steps,
        triggerType: 'manual',
        isActive: true
      });
      setIsModalOpen(false);
      loadPlaybooks();
    } catch (e) {
      console.error(e);
    }
  };

  const addStep = () => {
    if (!newStepName) return;
    setSteps([...steps, {
      name: newStepName,
      type: newStepType,
      order: steps.length + 1,
      description: newStepType === 'manual' ? 'Manual instruction' : undefined
    }]);
    setNewStepName('');
    setNewStepType('manual');
  };

  const removeStep = (index: number) => {
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    setSteps(newSteps);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden animate-fade-in">
       {/* Sidebar: Library */}
       <div className="w-80 border-r border-white/5 bg-content1/50 flex flex-col pt-16">
           <div className="p-4 border-b border-white/5">
               <h2 className="font-bold flex items-center gap-2 text-foreground"><Icon.Briefcase className="w-5 h-5 text-primary"/> Library</h2>
               <Input placeholder="Search templates..." size="sm" className="mt-2" startContent={<Icon.Search className="w-4 h-4 text-foreground/50"/>} />
           </div>

           {/* Enterprise ROI Stats */}
           <div className="p-4 grid grid-cols-2 gap-3 border-b border-white/5 bg-white/5">
                <div className="bg-content1 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-foreground/50 uppercase font-bold">Time Saved</div>
                    <div className="text-xl font-mono font-bold text-success">124h</div>
                </div>
                <div className="bg-content1 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-foreground/50 uppercase font-bold">Active</div>
                    <div className="text-xl font-mono font-bold text-primary">8/12</div>
                </div>
           </div>
           
           <ScrollShadow className="flex-1 p-4 space-y-4">
               <div>
                   <h3 className="text-xs font-bold text-foreground/50 uppercase mb-2">My Playbooks</h3>
                   <div className="space-y-2">
                       {playbooks.map(pb => (
                           <Card key={pb.id} isPressable onPress={() => setSelectedPlaybook(pb)} className={`border border-white/5 bg-transparent hover:bg-white/5 transition-all ${selectedPlaybook?.id === pb.id ? 'bg-primary/10 border-primary/20' : ''}`}>
                               <CardBody className="p-3">
                                   <div className="flex justify-between items-start">
                                       <span className="font-medium text-sm text-foreground">{pb.title}</span>
                                       {pb.isActive && <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(23,201,100,0.5)]" />}
                                   </div>
                                   <p className="text-xs text-foreground/50 mt-1 line-clamp-1">{pb.description}</p>
                               </CardBody>
                           </Card>
                       ))}
                   </div>
               </div>

               <div>
                   <h3 className="text-xs font-bold text-foreground/50 uppercase mb-2">Templates</h3>
                   <div className="space-y-2">
                       {TEMPLATES.map(t => (
                           <Card key={t.id} isPressable onPress={() => handleSelectTemplate(t)} className="border border-dashed border-white/10 bg-transparent hover:bg-white/5">
                               <CardBody className="p-3">
                                    <span className="font-medium text-sm text-foreground">{t.title}</span>
                                    <div className="flex gap-2 mt-2">
                                        <Chip size="sm" variant="flat" className="h-5 text-[10px]">{t.steps} Steps</Chip>
                                        <Chip size="sm" variant="flat" color="secondary" className="h-5 text-[10px]">{t.type}</Chip>
                                    </div>
                               </CardBody>
                           </Card>
                       ))}
                   </div>
               </div>
           </ScrollShadow>
           
           <div className="p-4 border-t border-white/5">
               <Button color="primary" className="w-full" onPress={handleOpenCreate} startContent={<Icon.Add className="w-4 h-4"/>}>Create New</Button>
           </div>
       </div>

       {/* Main Content */}
       <div className="flex-1 flex flex-col min-w-0 pt-16">
           {selectedPlaybook ? (
               <>
                {/* Header */}
                <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-content1/20 backdrop-blur">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                            <Icon.Cpu className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-foreground">{selectedPlaybook.title}</h1>
                            <div className="flex items-center gap-2 text-xs text-foreground/50">
                                <span>Version 1.0</span>
                                <span>•</span>
                                <span>Updated 2 days ago</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="flat" startContent={<Icon.Download className="w-4 h-4"/>}>Export</Button>
                        <Button size="sm" variant="flat" color={selectedPlaybook.isActive ? "success" : "default"} startContent={selectedPlaybook.isActive ? <Icon.CheckCircle className="w-4 h-4"/> : <Icon.XCircle className="w-4 h-4"/>}>
                            {selectedPlaybook.isActive ? "Active" : "Inactive"}
                        </Button>
                        <Button size="sm" color="primary" variant="shadow" startContent={<Icon.TrendingUp className="w-4 h-4"/>}>Run Playbook</Button>
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
                            <div className="max-w-4xl mx-auto space-y-8 pb-20">
                                {/* Start Node */}
                                <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/50 flex items-center justify-center shadow-[0_0_20px_rgba(23,201,100,0.2)] z-10">
                                        <Icon.Signal className="w-8 h-8 text-success" />
                                    </div>
                                    <div className="h-8 w-px bg-white/20 my-2" />
                                    <Chip size="sm" variant="flat" className="bg-content1 border border-white/10">Trigger: {selectedPlaybook.triggerType}</Chip>
                                    <div className="h-8 w-px bg-white/20" />
                                    <Icon.ChevronDown className="w-4 h-4 text-white/20 -mt-1" />
                                </div>

                                {/* Steps Graph */}
                                {selectedPlaybook.steps?.map((step, idx) => (
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
                                                     <Button isIconOnly size="sm" variant="light" className="opacity-0 group-hover:opacity-100 transition-opacity"><Icon.Settings className="w-4 h-4"/></Button>
                                                 </div>
                                                 <p className="text-xs text-foreground/60 bg-white/5 p-2 rounded">{step.description || "No parameters configured."}</p>
                                             </CardBody>
                                         </Card>

                                         {/* Connector */}
                                         {idx < (selectedPlaybook.steps?.length || 0) - 1 && (
                                             <>
                                                <div className="h-8 w-px bg-white/20" />
                                                <Icon.ChevronDown className="w-4 h-4 text-white/20 -mt-1" />
                                             </>
                                         )}
                                    </div>
                                ))}

                                {/* Add Button */}
                                <div className="flex justify-center">
                                    <Button variant="bordered" className="border-white/20 hover:border-primary hover:text-primary border-dashed" startContent={<Icon.Add className="w-4 h-4"/>}>Add Step</Button>
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'runs' && (
                             <div className="max-w-4xl mx-auto">
                                 <Card className="bg-content1/50 border border-white/5">
                                     <CardBody className="p-0">
                                         <table className="w-full text-left text-sm text-foreground">
                                             <thead className="bg-white/5 text-foreground/50 uppercase text-xs font-bold">
                                                 <tr>
                                                     <th className="p-4">Status</th>
                                                     <th className="p-4">Started At</th>
                                                     <th className="p-4">Duration</th>
                                                     <th className="p-4">User</th>
                                                     <th className="p-4 text-right">Actions</th>
                                                 </tr>
                                             </thead>
                                             <tbody className="divide-y divide-white/5">
                                                 {MOCK_RUNS.map(run => (
                                                     <tr key={run.id} className="hover:bg-white/5 transition-colors">
                                                         <td className="p-4">
                                                             <Chip size="sm" color={run.status === 'success' ? 'success' : 'danger'} variant="flat" startContent={run.status === 'success' ? <Icon.CheckCircle className="w-3 h-3"/> : <Icon.Alert className="w-3 h-3"/>}>
                                                                 {run.status}
                                                             </Chip>
                                                         </td>
                                                         <td className="p-4">{run.time}</td>
                                                         <td className="p-4 font-mono">{run.duration}</td>
                                                         <td className="p-4 flex items-center gap-2">
                                                             <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">{run.user.charAt(0).toUpperCase()}</div>
                                                             {run.user}
                                                         </td>
                                                         <td className="p-4 text-right">
                                                             <Button size="sm" variant="light" color="primary">Details</Button>
                                                         </td>
                                                     </tr>
                                                 ))}
                                             </tbody>
                                         </table>
                                     </CardBody>
                                 </Card>
                             </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="max-w-2xl mx-auto space-y-6">
                                <Card className="bg-content1/50 border border-white/5">
                                    <CardBody className="p-6 space-y-4">
                                        <h3 className="text-lg font-bold">General Settings</h3>
                                        <Input label="Playbook Name" value={selectedPlaybook.title} />
                                        <Textarea label="Description" value={selectedPlaybook.description} />
                                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                            <div>
                                                <div className="font-medium text-sm">Active Status</div>
                                                <div className="text-xs text-foreground/50">Enable or disable this playbook</div>
                                            </div>
                                            <Chip color={selectedPlaybook.isActive ? "success" : "default"} variant="flat">{selectedPlaybook.isActive ? "Enabled" : "Disabled"}</Chip>
                                        </div>
                                    </CardBody>
                                </Card>

                                <Card className="bg-content1/50 border border-white/5">
                                    <CardBody className="p-6 space-y-4">
                                        <h3 className="text-lg font-bold">Environment Variables</h3>
                                        <p className="text-sm text-foreground/50">Define global variables accessible to all steps in this playbook.</p>
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <Input size="sm" placeholder="Key (e.g. SLACK_WEBHOOK)" className="flex-1" />
                                                <Input size="sm" placeholder="Value" className="flex-1" type="password" />
                                                <Button size="sm" isIconOnly><Icon.Add className="w-4 h-4"/></Button>
                                            </div>
                                            <div className="flex gap-2 items-center bg-content2 p-2 rounded text-sm group">
                                                <span className="font-mono text-primary flex-1">API_KEY</span>
                                                <span className="font-mono flex-1">••••••••</span>
                                                <Button size="sm" variant="light" isIconOnly color="danger" className="opacity-0 group-hover:opacity-100"><Icon.Delete className="w-4 h-4"/></Button>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>

                                <div className="flex justify-end gap-2">
                                     <Button variant="flat" color="danger">Delete Playbook</Button>
                                     <Button color="primary">Save Changes</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
               </>
           ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-foreground/50">
                   <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                       <Icon.Briefcase className="w-10 h-10 opacity-50" />
                   </div>
                   <h2 className="text-xl font-bold mb-2">Select a Playbook</h2>
                   <p className="max-w-md text-center text-sm">Choose a playbook from the library or create a new one to start automating your security workflows.</p>
                   <Button color="primary" variant="flat" className="mt-6" onPress={handleOpenCreate}>Create New Playbook</Button>
               </div>
           )}
       </div>

      {/* Create Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        size="2xl"
        className="bg-content1 border border-white/10"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Create New Playbook</ModalHeader>
              <ModalBody>
                <Input 
                  label="Title" 
                  placeholder="e.g. Phishing Investigation" 
                  value={title} 
                  onValueChange={setTitle}
                  isRequired
                />
                <Textarea 
                  label="Description" 
                  placeholder="Steps to investigate phishing emails..." 
                  value={description}
                  onValueChange={setDescription}
                />
                
                <div className="border border-white/10 rounded-lg p-4 mt-2">
                  <h4 className="border-b border-white/10 pb-2 mb-3 text-sm font-semibold">Steps Definition</h4>
                  
                  {/* Step List */}
                  <div className="flex flex-col gap-2 mb-4">
                    {steps.length === 0 && <p className="text-sm text-gray-500 italic">No steps added yet.</p>}
                    {steps.map((step, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-content2 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <Chip size="sm">{idx + 1}</Chip>
                          <span className="font-medium">{step.name}</span>
                          <Chip size="sm" variant="flat" color={step.type === 'automation' ? "secondary" : "default"}>
                            {step.type}
                          </Chip>
                        </div>
                        <Button isIconOnly size="sm" color="danger" variant="light" onPress={() => removeStep(idx)}>
                          <Icon.Delete className="w-4 h-4"/>
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add Step */}
                  <div className="flex gap-2 items-end">
                    <Input 
                      label="New Step Name" 
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
                      onChange={(e) => setNewStepType(e.target.value as any)}
                    >
                      <SelectItem key="manual">Manual</SelectItem>
                      <SelectItem key="automation">Automation</SelectItem>
                    </Select>
                    <Button size="sm" color="primary" onPress={addStep}>Add</Button>
                  </div>
                </div>

              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={handleCreate}>Create Playbook</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
