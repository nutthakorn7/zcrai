import { useEffect, useState } from 'react';
import { 
  Card, CardBody, Button, Chip, Textarea,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Tabs, Tab, Input
} from "@heroui/react";
import { Icon } from '../../shared/ui';
import { ApprovalsAPI, ApprovalRequest } from '../../shared/api/approvals';
import { InputsAPI, InputRequest } from '../../shared/api/inputs';
import { formatDistanceToNow } from 'date-fns';

export default function ActionsPage() {
  const [activeTab, setActiveTab] = useState<'approvals' | 'inputs'>('approvals');
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [inputs, setInputs] = useState<InputRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Approval Modal State
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [comments, setComments] = useState('');
  
  // Input Modal State
  const [selectedInput, setSelectedInput] = useState<InputRequest | null>(null);
  const [inputData, setInputData] = useState<Record<string, any>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [approvalsData, inputsData] = await Promise.all([
        ApprovalsAPI.listPending(),
        InputsAPI.listPending()
      ]);
      setApprovals(approvalsData);
      setInputs(inputsData);
    } catch (e) {
      console.error('Failed to load actions', e);
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== APPROVALS HANDLERS ====================
  const openDecisionModal = (request: ApprovalRequest, type: 'approved' | 'rejected') => {
    setSelectedApproval(request);
    setDecision(type);
    setComments('');
    setIsModalOpen(true);
  };

  const handleApprovalSubmit = async () => {
    if (!selectedApproval) return;
    try {
      setIsSubmitting(true);
      await ApprovalsAPI.decide(selectedApproval.id, decision, comments);
      setApprovals(prev => prev.filter(a => a.id !== selectedApproval.id));
      setIsModalOpen(false);
      setSelectedApproval(null);
    } catch (e) {
      console.error(e);
      alert('Failed to submit decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== INPUTS HANDLERS ====================
  const openInputModal = (request: InputRequest) => {
    setSelectedInput(request);
    setInputData({});
    setIsInputModalOpen(true);
  };

  const handleInputSubmit = async () => {
    if (!selectedInput) return;
    try {
      setIsSubmitting(true);
      await InputsAPI.submit(selectedInput.id, inputData);
      setInputs(prev => prev.filter(i => i.id !== selectedInput.id));
      setIsInputModalOpen(false);
      setSelectedInput(null);
    } catch (e) {
      console.error(e);
      alert('Failed to submit input');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 h-screen overflow-y-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold flex items-center gap-2">
             <Icon.CheckCircle className="w-6 h-6 text-primary"/> 
             Action Center
           </h1>
           <p className="text-foreground/60 text-sm mt-1">Review pending approvals and provide required inputs for playbooks.</p>
        </div>
        <Button size="sm" variant="flat" onPress={loadData} startContent={<Icon.Refresh className="w-4 h-4"/>}>
          Refresh
        </Button>
      </div>

      <Tabs aria-label="Action Tabs" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as any)} className="mb-4">
        <Tab key="approvals" title={
            <div className="flex items-center gap-2">
                <span>Approvals</span>
                <Chip size="sm" variant="flat" color={approvals.length > 0 ? "warning" : "default"}>{approvals.length}</Chip>
            </div>
        }>
            {/* APPROVALS TABLE */}
            {isLoading ? <Spinner className="mt-10" /> : approvals.length === 0 ? (
                <EmptyState label="No Pending Approvals" />
            ) : (
                <ApprovalsTable data={approvals} onDecide={openDecisionModal} />
            )}
        </Tab>
        <Tab key="inputs" title={
             <div className="flex items-center gap-2">
                <span>Inputs</span>
                <Chip size="sm" variant="flat" color={inputs.length > 0 ? "primary" : "default"}>{inputs.length}</Chip>
            </div>
        }>
            {/* INPUTS TABLE */}
            {isLoading ? <Spinner className="mt-10" /> : inputs.length === 0 ? (
                <EmptyState label="No Pending Inputs" />
            ) : (
                <InputsTable data={inputs} onOpen={openInputModal} />
            )}
        </Tab>
      </Tabs>

      {/* Approval Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                {decision === 'approved' ? 'Approve Action' : 'Reject Action'}
              </ModalHeader>
              <ModalBody>
                <p className="text-sm">Are you sure you want to {decision} this request?</p>
                <Textarea label="Comments" value={comments} onValueChange={setComments} />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color={decision === 'approved' ? 'success' : 'danger'} onPress={handleApprovalSubmit} isLoading={isSubmitting}>
                  Confirm
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Input Modal */}
      <Modal isOpen={isInputModalOpen} onClose={() => setIsInputModalOpen(false)} size="2xl">
        <ModalContent>
           {(onClose) => (
             <>
               <ModalHeader>Provide Input</ModalHeader>
               <ModalBody>
                 <p className="text-sm text-foreground/60 mb-4">
                    The playbook <strong>{selectedInput?.playbook?.title}</strong> is waiting for the following information:
                 </p>
                 <div className="space-y-4">
                    {/* Dynamic Form Generation (Simple for MVP) */}
                    {selectedInput?.inputSchema?.properties && Object.entries(selectedInput.inputSchema.properties).map(([key, field]: [string, any]) => (
                        <div key={key}>
                            <Input 
                                label={field.title || key} 
                                description={field.description}
                                placeholder={`Enter ${key}...`}
                                value={inputData[key] || ''}
                                onValueChange={(val) => setInputData({...inputData, [key]: val})}
                                isRequired={selectedInput.inputSchema.required?.includes(key)}
                            />
                        </div>
                    ))}
                    {(!selectedInput?.inputSchema?.properties) && (
                        <div className="p-4 bg-warning/10 text-warning rounded-lg">
                            No schema defined. Enter raw JSON below (Advanced).
                            <Textarea 
                                className="mt-2"
                                placeholder="{}"
                                value={JSON.stringify(inputData)}
                                onValueChange={(v) => {
                                    try { setInputData(JSON.parse(v)) } catch {}
                                }}
                            />
                        </div>
                    )}
                 </div>
               </ModalBody>
               <ModalFooter>
                 <Button variant="light" onPress={onClose}>Cancel</Button>
                 <Button color="primary" onPress={handleInputSubmit} isLoading={isSubmitting}>Submit</Button>
               </ModalFooter>
             </>
           )}
        </ModalContent>
      </Modal>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-foreground/40 bg-white/5 rounded-xl border border-dashed border-white/10">
          <Icon.CheckCircle className="w-16 h-16 mb-4 opacity-50" />
          <h3 className="text-lg font-medium">{label}</h3>
        </div>
    )
}

function ApprovalsTable({ data, onDecide }: { data: ApprovalRequest[], onDecide: any }) {
    return (
        <Card className="border border-white/5 bg-white/5">
          <CardBody className="p-0">
            <Table removeWrapper aria-label="Approvals table" className="bg-transparent">
              <TableHeader>
                <TableColumn>REQUESTED</TableColumn>
                <TableColumn>PLAYBOOK</TableColumn>
                <TableColumn>STEP</TableColumn>
                <TableColumn align="end">ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.id} className="hover:bg-white/5 border-b border-white/5">
                    <TableCell>{formatDistanceToNow(new Date(item.requestedAt), { addSuffix: true })}</TableCell>
                    <TableCell>{item.playbook?.title}</TableCell>
                    <TableCell>{item.step?.name}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button isIconOnly size="sm" color="danger" variant="light" onPress={() => onDecide(item, 'rejected')}><Icon.Close/></Button>
                        <Button size="sm" color="success" variant="flat" onPress={() => onDecide(item, 'approved')} startContent={<Icon.Check className="w-4 h-4"/>}>Approve</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
    )
}

function InputsTable({ data, onOpen }: { data: InputRequest[], onOpen: any }) {
    return (
        <Card className="border border-white/5 bg-white/5">
          <CardBody className="p-0">
            <Table removeWrapper aria-label="Inputs table" className="bg-transparent">
              <TableHeader>
                <TableColumn>REQUESTED</TableColumn>
                <TableColumn>PLAYBOOK</TableColumn>
                <TableColumn>STEP</TableColumn>
                <TableColumn align="end">ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.id} className="hover:bg-white/5 border-b border-white/5">
                    <TableCell>{formatDistanceToNow(new Date(item.requestedAt), { addSuffix: true })}</TableCell>
                    <TableCell>{item.playbook?.title}</TableCell>
                    <TableCell>{item.step?.name}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" color="primary" variant="flat" onPress={() => onOpen(item)}>Provide Input</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
    )
}
