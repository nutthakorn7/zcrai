import { useEffect, useState } from 'react';
import { 
  Button, Card, CardBody, CardHeader, Input, Chip, 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Textarea, Select, SelectItem
} from "@heroui/react";
import { Icon } from '../../shared/ui';
import { PlaybooksAPI, Playbook, PlaybookStep } from '../../shared/api/playbooks';

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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Playbooks (SOPs)</h1>
          <p className="text-gray-400">Manage standard operating procedures and automations.</p>
        </div>
        <Button color="primary" onPress={handleOpenCreate} startContent={<Icon.Add className="w-5 h-5"/>}>
          Create Playbook
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playbooks.map(pb => (
          <Card key={pb.id} className="bg-content1/50 border border-white/5">
            <CardHeader className="flex justify-between">
              <div>
                <h3 className="font-bold text-lg">{pb.title}</h3>
                <p className="text-tiny text-gray-400">{pb.steps?.length || 0} Steps</p>
              </div>
              <Chip size="sm" color={pb.isActive ? "success" : "default"} variant="dot">
                {pb.isActive ? "Active" : "Inactive"}
              </Chip>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-foreground/70 mb-4 line-clamp-2">
                {pb.description || "No description provided."}
              </p>
              <div className="flex gap-2">
                 <Chip size="sm" variant="flat" color="primary">{pb.triggerType}</Chip>
              </div>
            </CardBody>
          </Card>
        ))}
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
