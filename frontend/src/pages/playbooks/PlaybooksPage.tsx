import { useEffect, useState } from 'react';
import { 
  Button, Card, CardBody, Input, Chip, 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Textarea, ScrollShadow,
  Spinner
} from "@heroui/react";
import { Icon, PageHeader, ConfirmDialog } from '../../shared/ui';
import { PlaybooksAPI, Playbook } from '@/shared/api';
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

  // Selected Playbook for Editing
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  
  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
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
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setTitle('');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      if (!title) return;
      setIsSubmitting(true);
      const newPlaybook = await PlaybooksAPI.create({
        title,
        description,
        steps: [], // Start with empty steps
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

  const handleDeleteClick = () => {
      if (!selectedPlaybook) return;
      setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
      if (!selectedPlaybook) return;
      try {
          await PlaybooksAPI.delete(selectedPlaybook.id);
          setPlaybooks(playbooks.filter(p => p.id !== selectedPlaybook.id));
          setSelectedPlaybook(null);
      } catch (e) {
          console.error(e);
          alert('Failed to delete playbook');
      } finally {
          setDeleteConfirmOpen(false);
      }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden animate-fade-in">
       {/* Page Header */}
       <div className="p-6 border-b border-white/5">
         <PageHeader title="Automation Playbooks" description="Design and manage security automation workflows">
           <Button 
             color="primary" 
             onPress={handleOpenCreate}
             startContent={<Icon.Add className="w-4 h-4" />}
           >
             New Playbook
           </Button>
         </PageHeader>
       </div>

       {/* Main Content */}
       <div className="flex flex-1 overflow-hidden">
         {/* Sidebar: Library */}
         <div className="w-80 border-r border-white/5 bg-content1/50 flex flex-col">
            <div className="p-4 border-b border-white/5 bg-white/5">
                <h2 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] flex items-center gap-2 mb-3">
                    <Icon.Briefcase className="w-4 h-4 text-primary"/> Library
                </h2>
                <Input placeholder="Search playbooks..." size="sm" className="mt-2" startContent={<Icon.Search className="w-4 h-4 text-foreground/60"/>} />
           </div>

           {/* Enterprise ROI Stats */}
           <div className="p-4 grid grid-cols-2 gap-3 border-b border-white/5 bg-white/5">
                <div className="bg-content1 rounded-lg p-3 border border-white/5 flex flex-col justify-center">
                    <div className="text-[9px] text-foreground/40 uppercase font-black font-display tracking-widest">Time Saved</div>
                    <div className="text-xl font-bold font-display text-success tracking-tight">124h</div>
                </div>
                <div className="bg-content1 rounded-lg p-3 border border-white/5 flex flex-col justify-center">
                    <div className="text-[9px] text-foreground/40 uppercase font-black font-display tracking-widest">Active</div>
                    <div className="text-xl font-bold font-display text-primary tracking-tight">{playbooks.filter(p => p.isActive).length}/{playbooks.length}</div>
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
            onDelete={handleDeleteClick}
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

       </div> {/* End of Main Content flex wrapper */}

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
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={handleCreate} isLoading={isSubmitting}>Create Playbook</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Playbook"
        description="Are you sure you want to delete this playbook?"
        confirmLabel="Delete"
        confirmColor="danger"
      />
    </div>
  );
}
