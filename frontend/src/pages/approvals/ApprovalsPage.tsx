import { useEffect, useState, useCallback } from "react";
import { Card, CardBody, Button, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Tooltip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea, useDisclosure, Tabs, Tab } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { api } from "@/shared/api";
import { Icon } from "@/shared/ui";
import { usePageContext } from "../../contexts/PageContext";

interface ApprovalRequest {
  id: string;
  tenantId: string;
  executionId: string;
  stepId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  actedAt: string | null;
  actedBy: string | null;
  comments: string | null;
  execution: {
    playbook: { name: string };
    case: { id: string; title: string };
  };
  step: {
    step: { name: string; description: string | null };
  };
}

export default function ApprovalsPage() {
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setPageContext } = usePageContext();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchApprovals = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get('/approvals/pending');
      setApprovals(data.data || []);
      
      setPageContext({
        pageName: 'Approval Center',
        pageDescription: 'Review and manage manual approval requests from automated playbooks.',
        data: {
          pendingCount: (data.data || []).length
        }
      });
    } catch (error) {
      console.error('Failed to fetch approvals', error);
    } finally {
      setIsLoading(false);
    }
  }, [setPageContext]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleDecide = async (onClose: () => void) => {
    if (!selectedApproval) return;
    setIsSubmitting(true);
    try {
      await api.post(`/approvals/${selectedApproval.id}/decide`, {
        decision,
        comments
      });
      await fetchApprovals();
      onClose();
    } catch (error) {
      alert('Failed to process approval');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDecisionModal = (approval: ApprovalRequest, type: 'approved' | 'rejected') => {
    setSelectedApproval(approval);
    setDecision(type);
    setComments('');
    onOpen();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
            Approval Center
          </h1>
          <p className="text-foreground/60 text-sm mt-1">Manual gates for sensitive security actions</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs 
            aria-label="Approval Center Tabs" 
            selectedKey="approvals"
            onSelectionChange={(key) => key === 'inputs' ? navigate('/approvals/inputs') : null}
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
            onClick={fetchApprovals} 
            isLoading={isLoading}
          >
            <Icon.Refresh className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <Card className="bg-default-50/50 border-default-100">
        <CardBody className="p-0">
          <Table 
            aria-label="Pending Approvals"
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
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">STATUS</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]" align="center">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent={isLoading ? "Loading approvals..." : "No pending approvals found"}>
              {approvals.map((item: ApprovalRequest) => (
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
                    <Chip size="sm" variant="flat" color="warning">Pending</Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Tooltip content="Approve Action">
                        <Button 
                          size="sm" 
                          color="success" 
                          variant="flat"
                          isIconOnly
                          onClick={() => openDecisionModal(item, 'approved')}
                        >
                          <Icon.Check className="w-4 h-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Reject Action">
                        <Button 
                          size="sm" 
                          color="danger" 
                          variant="flat"
                          isIconOnly
                          onClick={() => openDecisionModal(item, 'rejected')}
                        >
                          <Icon.Close className="w-4 h-4" />
                        </Button>
                      </Tooltip>
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
                {decision === 'approved' ? 'Approve Action' : 'Reject Action'}
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="p-3 bg-default-100 rounded-lg">
                    <p className="text-xs text-default-500 uppercase font-bold mb-1">Target Action</p>
                    <p className="text-sm font-semibold">{selectedApproval?.step.step.name}</p>
                    <p className="text-xs text-default-400 mt-1">{selectedApproval?.step.step.description}</p>
                  </div>
                  
                  <Textarea
                    label="Comments"
                    placeholder="Provide rationale for your decision..."
                    value={comments}
                    onValueChange={setComments}
                    variant="bordered"
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button 
                  color={decision === 'approved' ? 'success' : 'danger'}
                  onPress={() => handleDecide(onClose)}
                  isLoading={isSubmitting}
                >
                  Confirm {decision === 'approved' ? 'Approval' : 'Rejection'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
