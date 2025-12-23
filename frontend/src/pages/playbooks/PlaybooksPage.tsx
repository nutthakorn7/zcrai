import { useEffect, useState } from 'react';
import { 
  Button, Card, CardBody, Input, Chip, 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Textarea, Select, SelectItem, ScrollShadow,
  Spinner
} from "@heroui/react";
import { Icon } from '../../shared/ui';
import { PlaybooksAPI, Playbook, PlaybookStep } from '../../shared/api/playbooks';
import PlaybookEditor from './PlaybookEditor';

// Client-side Templates (for quick start)
const TEMPLATES = [
  { id: 't1', title: 'Phishing Investigation', description: 'Analyze email headers and URLs.', steps: 3, type: 'automation' },
  { id: 't2', title: 'Malware Containment', description: 'Isolate host and block hash.', steps: 5, type: 'automation' },
  { id: 't3', title: 'User Onboarding', description: 'Provision accounts and send welcome email.', steps: 4, type: 'manual' },
];

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Create Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<PlaybookStep[]>([]);
  
  // Step Form (in Modal)
  const [newStepName, setNewStepName] = useState('');
  const [newStepType, setNewStepType] = useState<'manual' | 'automation'>('manual');

  // Selected Playbook for Editing
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  
  useEffect(() => {
    loadPlaybooks();
  }, []);

  const loadPlaybooks = async () => {
    try {
      setIsLoading(true);
      const data = await PlaybooksAPI.list();
      setPlaybooks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
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
      setIsSubmitting(true);
      const newPlaybook = await PlaybooksAPI.create({
        title,
        description,
        steps,
        triggerType: 'manual',
        isActive: true
      });
      setIsModalOpen(false);
      // Add to list and select it immediately
      setPlaybooks([...playbooks, newPlaybook]);
      setSelectedPlaybook(newPlaybook);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = (updated: Playbook) => {
      setPlaybooks(playbooks.map(p => p.id === updated.id ? updated : p));
      setSelectedPlaybook(updated);
  };

  const handleDelete = async () => {
      if (!selectedPlaybook) return;
      if (!confirm('Are you sure you want to delete this playbook?')) return;
      
      try {
          await PlaybooksAPI.delete(selectedPlaybook.id);
          setPlaybooks(playbooks.filter(p => p.id !== selectedPlaybook.id));
          setSelectedPlaybook(null);
      } catch (e) {
          console.error(e);
          alert('Failed to delete playbook');
      }
  };

  const addStepToModal = () => {
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

  const removeStepFromModal = (index: number) => {
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
               <Input placeholder="Search playbooks..." size="sm" className="mt-2" startContent={<Icon.Search className="w-4 h-4 text-foreground/60"/>} />
           </div>

           {/* Enterprise ROI Stats */}
           <div className="p-4 grid grid-cols-2 gap-3 border-b border-white/5 bg-white/5">
                <div className="bg-content1 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-foreground/60 uppercase font-bold">Time Saved</div>
                    <div className="text-xl font-mono font-bold text-success">124h</div>
                </div>
                <div className="bg-content1 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-foreground/60 uppercase font-bold">Active</div>
                    <div className="text-xl font-mono font-bold text-primary">{playbooks.filter(p => p.isActive).length}/{playbooks.length}</div>
                </div>
           </div>
           
           <ScrollShadow className="flex-1 p-4 space-y-4">
               {isLoading ? (
                   <div className="flex justify-center p-4"><Spinner /></div>
               ) : (
                   <>
                        {playbooks.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-foreground/60 uppercase mb-2">My Playbooks</h3>
                                <div className="space-y-2">
                                    {playbooks.map(pb => (
                                        <Card key={pb.id} isPressable onPress={() => setSelectedPlaybook(pb)} className={`border border-white/5 bg-transparent hover:bg-white/5 transition-all ${selectedPlaybook?.id === pb.id ? 'bg-primary/10 border-primary/20' : ''}`}>
                                            <CardBody className="p-3">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-medium text-sm text-foreground">{pb.title}</span>
                                                    {pb.isActive && <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(23,201,100,0.5)]" />}
                                                </div>
                                                <p className="text-xs text-foreground/60 mt-1 line-clamp-1">{pb.description}</p>
                                            </CardBody>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-xs font-bold text-foreground/60 uppercase mb-2">Templates</h3>
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
                   </>
               )}
           </ScrollShadow>
           
           <div className="p-4 border-t border-white/5">
               <Button color="primary" className="w-full" onPress={handleOpenCreate} startContent={<Icon.Add className="w-4 h-4"/>}>Create New</Button>
           </div>
       </div>

       {/* Main Content (Editor or Placeholder) */}
       {selectedPlaybook ? (
           <PlaybookEditor 
            key={selectedPlaybook.id} // Re-mount on change
            playbook={selectedPlaybook}
            onClose={() => setSelectedPlaybook(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
           />
       ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-foreground/60 pt-16">
               <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                   <Icon.Briefcase className="w-10 h-10 opacity-50" />
               </div>
               <h2 className="text-xl font-bold mb-2">Select a Playbook</h2>
               <p className="max-w-md text-center text-sm">Choose a playbook from the library or create a new one to start automating your security workflows.</p>
               <Button color="primary" variant="flat" className="mt-6" onPress={handleOpenCreate}>Create New Playbook</Button>
           </div>
       )}

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
                  <h3 className="border-b border-white/10 pb-2 mb-3 text-sm font-semibold">Steps Definition</h3>
                  
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
                        <Button isIconOnly size="sm" color="danger" variant="light" onPress={() => removeStepFromModal(idx)}>
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
                    <Button size="sm" color="primary" onPress={addStepToModal}>Add</Button>
                  </div>
                </div>

              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={handleCreate} isLoading={isSubmitting}>Create Playbook</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
