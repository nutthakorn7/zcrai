import { useEffect, useState, useCallback } from "react";
import { Card, CardBody, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, useDisclosure, Tabs, Tab } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { api } from "@/shared/api";
import { Icon } from "@/shared/ui";
import { usePageContext } from "../../contexts/PageContext";

interface InputRequest {
  id: string;
  tenantId: string;
  executionId: string;
  stepId: string;
  status: 'pending' | 'submitted';
  requestedAt: string;
  respondedAt: string | null;
  respondedBy: string | null;
  inputSchema: any;
  inputData: any | null;
  execution: {
    playbook: { name: string };
    case: { id: string; title: string };
  };
  step: {
    step: { name: string; description: string | null };
  };
}

export default function InputsPage() {
  const navigate = useNavigate();
  const [inputs, setInputs] = useState<InputRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setPageContext } = usePageContext();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  
  const [selectedInput, setSelectedInput] = useState<InputRequest | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInputs = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get('/approvals/pending-inputs'); // Note: Endpoint to be double checked in backend if exists or just use general approvals
      // Based on my Plan, backend has listPendingInputs
      setInputs(data.data || []);
      
      setPageContext({
        pageName: 'Input Requests',
        pageDescription: 'Provide necessary information for active security playbooks.',
        data: {
          pendingInputs: (data.data || []).length
        }
      });
    } catch (error) {
      console.error('Failed to fetch input requests', error);
    } finally {
      setIsLoading(false);
    }
  }, [setPageContext]);

  useEffect(() => {
    fetchInputs();
  }, [fetchInputs]);

  const handleSubmit = async (onClose: () => void) => {
    if (!selectedInput) return;
    setIsSubmitting(true);
    try {
      await api.post(`/approvals/inputs/${selectedInput.id}/submit`, {
        data: formData
      });
      await fetchInputs();
      onClose();
    } catch (error) {
      alert('Failed to submit input');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openInputModal = (request: InputRequest) => {
    setSelectedInput(request);
    setFormData({});
    onOpen();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
            Input Requests
          </h1>
          <p className="text-foreground/60 text-sm mt-1">Provide context for automated workflows</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs 
            aria-label="Input Requests Tabs" 
            selectedKey="inputs"
            onSelectionChange={(key) => key === 'approvals' ? navigate('/approvals') : null}
            variant="underlined"
            classNames={{
              tabList: "gap-6",
              cursor: "w-full bg-primary",
              tab: "max-w-fit px-0 h-12",
              tabContent: "group-data-[selected=true]:text-primary font-semibold"
            }}
          >
            <Tab key="approvals" title="Action Approvals" />
            <Tab key="inputs" title="Input Requests" />
          </Tabs>
          <Button 
            isIconOnly 
            variant="flat" 
            onClick={fetchInputs} 
            isLoading={isLoading}
          >
            <Icon.Refresh className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <Card className="bg-default-50/50 border-default-100">
        <CardBody className="p-0">
          <Table 
            aria-label="Pending Inputs"
            classNames={{
              wrapper: "bg-transparent shadow-none",
              th: "bg-default-100/50 text-default-600 font-semibold",
              td: "py-4"
            }}
          >
            <TableHeader>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">PLAYBOOK / STEP</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">CASE</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">REQUESTED</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]" align="center">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent={isLoading ? "Loading requests..." : "No input requests found"}>
              {inputs.map((item: InputRequest) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-default-900">{item.execution.playbook.name}</span>
                      <span className="text-xs text-default-500">{item.step.step.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">#{item.execution.case.id.slice(0, 8)}</span>
                      <span className="text-xs text-default-400 truncate max-w-[200px]">{item.execution.case.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-default-500">
                      {new Date(item.requestedAt).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Button 
                        size="sm" 
                        color="primary" 
                        variant="flat"
                        onClick={() => openInputModal(item)}
                        startContent={<Icon.Edit className="w-4 h-4" />}
                      >
                        Provide Input
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                Provide Workflow Input
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="p-3 bg-default-100 rounded-lg">
                    <p className="text-xs text-default-500 uppercase font-bold mb-1">Context</p>
                    <p className="text-sm font-semibold">{selectedInput?.step.step.name}</p>
                    <p className="text-xs text-default-400 mt-1">{selectedInput?.step.step.description}</p>
                  </div>
                  
                  {/* Dynamic Form Generation based on inputSchema */}
                  <div className="space-y-3">
                    {selectedInput?.inputSchema && Object.entries(selectedInput.inputSchema).map(([key, schema]: [string, any]) => (
                      <Input
                        key={key}
                        label={schema.label || key}
                        placeholder={schema.placeholder || `Enter ${key}`}
                        type={schema.type || 'text'}
                        value={formData[key] || ''}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, [key]: val }))}
                        variant="bordered"
                        description={schema.description}
                      />
                    ))}
                    {(!selectedInput?.inputSchema || Object.keys(selectedInput.inputSchema).length === 0) && (
                        <p className="text-xs text-default-400 italic">No schema defined. Enter raw JSON if needed or just submit.</p>
                    )}
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button 
                  color="primary"
                  onPress={() => handleSubmit(onClose)}
                  isLoading={isSubmitting}
                >
                  Submit Information
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
