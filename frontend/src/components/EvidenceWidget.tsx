import { useEffect, useState, useCallback } from "react";
import { 
  Card, Button, Chip, 
  Input, Select, SelectItem,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, 
  Spinner,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem
} from "@heroui/react";
import { Icon } from "../shared/ui";
import { ObservablesAPI, Observable } from "../shared/api/observables";

interface EvidenceWidgetProps {
  caseId: string;
}

export const EvidenceWidget = ({ caseId }: EvidenceWidgetProps) => {
  const [observables, setObservables] = useState<Observable[]>([]);
  const [loading, setLoading] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Add Form
  const [newItemType, setNewItemType] = useState("ip");
  const [newItemValue, setNewItemValue] = useState("");
  const [adding, setAdding] = useState(false);

  // Wrap fetchObservables in useCallback to satisfy exhaustive-deps
  const fetchObservables = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ObservablesAPI.list({ caseId });
      setObservables(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (caseId) fetchObservables();
  }, [caseId, fetchObservables]);

  const handleAdd = async () => {
    if (!newItemValue) return;
    try {
      setAdding(true);
      await ObservablesAPI.create({
        caseId,
        type: newItemType,
        value: newItemValue,
        isMalicious: undefined, 
        tags: ['manual-entry']
      });
      setNewItemValue("");
      onClose();
      fetchObservables();
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const handleEnrich = async (id: string) => {
    try {
        // Optimistic UI update (optional, but good for feedback)
        await ObservablesAPI.enrich(id);
        // Toast or simple alert
        alert("Verification queued.");
        // Reload after short delay since it's async queue
        setTimeout(fetchObservables, 2000);
    } catch(e) {
        console.error(e);
    }
  };

  const handleVerdict = async (id: string, isMalicious: boolean) => {
      try {
          await ObservablesAPI.setStatus(id, isMalicious);
          fetchObservables();
      } catch (e) {
          console.error(e);
      }
  };

  return (
    <Card className="p-4 bg-content1/50 border border-white/5 h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
           <Icon.Shield className="w-5 h-5 text-primary" />
           Evidence Board
        </h3>
        <Button size="sm" color="primary" variant="flat" onPress={onOpen} startContent={<Icon.Add className="w-4 h-4" />}>
          Add IOC
        </Button>
      </div>

      <div className="flex flex-col gap-2 min-h-[200px]">
        {loading && <div className="flex justify-center p-4"><Spinner size="sm" /></div>}
        
        {!loading && observables.map((obs) => (
          <div key={obs.id} className="flex items-center justify-between p-3 bg-content2/30 rounded-lg hover:bg-content2/50 transition-colors group">
             <div className="flex items-center gap-3">
                 {/* Icon based on Type */}
                 <div className={`p-2 rounded-md ${
                     obs.isMalicious ? 'bg-danger/20 text-danger' : 
                     obs.isMalicious === false ? 'bg-success/20 text-success' : 
                     'bg-default/20 text-default-500'
                 }`}>
                    {obs.type === 'ip' && <Icon.Server className="w-4 h-4" />}
                    {obs.type === 'domain' && <Icon.Global className="w-4 h-4" />}
                    {obs.type === 'email' && <Icon.User className="w-4 h-4" />}
                    {obs.type === 'hash' && <Icon.FileText className="w-4 h-4" />}
                    {obs.type === 'url' && <Icon.Search className="w-4 h-4" />}
                 </div>
                 
                 <div className="flex flex-col">
                     <span className="font-mono text-sm">{obs.value}</span>
                     <div className="flex gap-2 text-[10px] text-gray-500">
                        <span className="uppercase">{obs.type}</span>
                        <span>•</span>
                        <span>Seen: {parseInt(obs.sightingCount)} times</span>
                     </div>
                 </div>
             </div>
             
             <div className="flex items-center gap-2">
                 {/* Verdict Chip */}
                 {obs.isMalicious === true && <Chip size="sm" color="danger" variant="flat">MALICIOUS</Chip>}
                 {obs.isMalicious === false && <Chip size="sm" color="success" variant="flat">SAFE</Chip>}
                 {obs.isMalicious === undefined && (
                     <Button size="sm" variant="light" className="text-xs h-6" onPress={() => handleEnrich(obs.id)}>
                        Analyze
                     </Button>
                 )}

                 {/* Actions Menu */}
                 <Dropdown>
                    <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="light" className="opacity-0 group-hover:opacity-100"><Icon.Menu className="w-4 h-4" /></Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Evidence Actions">
                        <DropdownItem key="enrich" startContent={<Icon.Refresh className="w-4 h-4" />} onPress={() => handleEnrich(obs.id)}>Re-Analyze</DropdownItem>
                        <DropdownItem key="mark_malicious" className="text-danger" color="danger" onPress={() => handleVerdict(obs.id, true)}>Mark as Malicious</DropdownItem>
                        <DropdownItem key="mark_safe" className="text-success" color="success" onPress={() => handleVerdict(obs.id, false)}>Mark as Safe</DropdownItem>
                        <DropdownItem key="copy" onPress={() => navigator.clipboard.writeText(obs.value)}>Copy Value</DropdownItem>
                    </DropdownMenu>
                 </Dropdown>
             </div>
          </div>
        ))}
        
        {!loading && observables.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500 gap-2">
                <Icon.Search className="w-8 h-8 opacity-50" />
                <p className="text-xs">No evidence collected yet.</p>
            </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
            <ModalHeader>Add Indicator of Compromise</ModalHeader>
            <ModalBody>
                <div className="flex flex-col gap-4">
                    <Select label="Type" selectedKeys={[newItemType]} onChange={(e) => setNewItemType(e.target.value)}>
                        <SelectItem key="ip">IP Address</SelectItem>
                        <SelectItem key="domain">Domain</SelectItem>
                        <SelectItem key="url">URL</SelectItem>
                        <SelectItem key="hash">File Hash</SelectItem>
                        <SelectItem key="email">Email Address</SelectItem>
                    </Select>
                    <Input 
                        label="Value" 
                        placeholder="e.g. 192.168.1.1" 
                        value={newItemValue} 
                        onValueChange={setNewItemValue} 
                    />
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="flat" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={handleAdd} isLoading={adding}>Add Evidence</Button>
            </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
};
