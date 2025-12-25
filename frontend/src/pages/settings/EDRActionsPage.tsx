import { useState } from 'react';
import { Card, CardBody, Button, Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip, Divider, Textarea } from '@heroui/react';
import { api } from '../../shared/api';
import toast from 'react-hot-toast';
import { Icon } from '../../shared/ui';

// Available EDR Providers
const EDR_PROVIDERS = [
  { key: 'crowdstrike', label: 'CrowdStrike Falcon', color: 'danger' as const },
  { key: 'sentinelone', label: 'SentinelOne', color: 'secondary' as const },
];

// Available Actions per Provider
const PROVIDER_ACTIONS: Record<string, { key: string; label: string; dangerous: boolean; description: string }[]> = {
  crowdstrike: [
    { key: 'isolate_host', label: 'Isolate Host', dangerous: true, description: 'Network contain a host to prevent lateral movement' },
    { key: 'lift_containment', label: 'Lift Containment', dangerous: false, description: 'Restore network access to a contained host' },
    { key: 'kill_process', label: 'Kill Process', dangerous: true, description: 'Terminate a running process on the host' },
    { key: 'get_device_details', label: 'Get Device Details', dangerous: false, description: 'Retrieve device information' },
  ],
  sentinelone: [
    { key: 'quarantine_host', label: 'Quarantine Host', dangerous: true, description: 'Disconnect a host from the network' },
    { key: 'unquarantine_host', label: 'Unquarantine Host', dangerous: false, description: 'Restore network access to a quarantined host' },
    { key: 'blocklist_hash', label: 'Blocklist Hash', dangerous: true, description: 'Block a file hash globally' },
    { key: 'get_agent_details', label: 'Get Agent Details', dangerous: false, description: 'Retrieve agent information' },
  ],
};

// Action History
interface ActionLog {
  id: string;
  timestamp: string;
  provider: string;
  action: string;
  target: string;
  status: 'success' | 'failed' | 'pending';
  executedBy: string;
  result?: EDRActionResult;
}

interface EDRActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export default function EDRActionsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();
  
  const [provider, setProvider] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [agentId, setAgentId] = useState('');
  const [processId, setProcessId] = useState('');
  const [hash, setHash] = useState('');
  const [reason, setReason] = useState('');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<EDRActionResult | null>(null);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);

  const selectedAction = PROVIDER_ACTIONS[provider]?.find(a => a.key === action);

  const getRequiredParams = () => {
    const hostActions = ['isolate_host', 'lift_containment', 'quarantine_host', 'unquarantine_host', 'get_device_details', 'get_agent_details'];
    const processActions = ['kill_process'];
    const hashActions = ['blocklist_hash'];
    
    if (hostActions.includes(action)) return 'agentId';
    if (processActions.includes(action)) return 'processId';
    if (hashActions.includes(action)) return 'hash';
    return 'agentId';
  };

  const canExecute = () => {
    if (!provider || !action) return false;
    const paramType = getRequiredParams();
    if (paramType === 'agentId' && !agentId) return false;
    if (paramType === 'processId' && !processId) return false;
    if (paramType === 'hash' && !hash) return false;
    return true;
  };

  const handleExecute = async () => {
    if (selectedAction?.dangerous && !isConfirmOpen) {
      onConfirmOpen();
      return;
    }
    
    onConfirmClose();
    setExecuting(true);
    
    try {
      const params: Record<string, string> = {};
      const paramType = getRequiredParams();
      
      if (paramType === 'agentId') params.agentId = agentId;
      if (paramType === 'processId') params.processId = processId;
      if (paramType === 'hash') params.hash = hash;
      if (reason) params.reason = reason;
      
      const response = await api.post('/edr/execute', {
        provider,
        action,
        parameters: params,
      });
      
      setResult(response.data);
      
      // Add to logs
      const newLog: ActionLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        provider,
        action,
        target: agentId || processId || hash,
        status: response.data?.success ? 'success' : 'failed',
        executedBy: 'Current User',
        result: response.data,
      };
      setActionLogs([newLog, ...actionLogs]);
      
      if (response.data?.success) {
        toast.success('Action executed successfully');
      } else {
        toast.error(response.data?.message || 'Action failed');
      }
      
      onOpen(); // Show result modal
    } catch (error) {
       const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to execute action');
    } finally {
      setExecuting(false);
    }
  };

  const resetForm = () => {
    setProvider('');
    setAction('');
    setAgentId('');
    setProcessId('');
    setHash('');
    setReason('');
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">EDR Response Actions</h1>
          <p className="text-foreground/60 text-sm mt-1">Execute endpoint detection & response actions</p>
        </div>
        <Chip color="warning" variant="flat" startContent={<Icon.Alert className="w-4 h-4" />}>
          Actions are logged for audit
        </Chip>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Action Form */}
        <Card className="lg:col-span-2 bg-content1/50 backdrop-blur-md border border-white/5">
          <CardBody className="p-6 space-y-6">
            <h2 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] mb-4">Execute Action</h2>
            
            {/* Provider Selection */}
            <Select
              label="EDR Provider"
              placeholder="Select provider"
              selectedKeys={provider ? [provider] : []}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                setProvider(val);
                setAction(''); // Reset action when provider changes
              }}
            >
              {EDR_PROVIDERS.map((p) => (
                <SelectItem key={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </Select>

            {/* Action Selection */}
            {provider && (
              <Select
                label="Action"
                placeholder="Select action"
                selectedKeys={action ? [action] : []}
                onSelectionChange={(keys) => setAction(Array.from(keys)[0] as string)}
              >
                {PROVIDER_ACTIONS[provider]?.map((a) => (
                  <SelectItem key={a.key} textValue={a.label}>
                    <div className="flex items-center justify-between w-full">
                      <span>{a.label}</span>
                      {a.dangerous && (
                        <Chip size="sm" color="danger" variant="flat">Dangerous</Chip>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </Select>
            )}

            {/* Action Description */}
            {selectedAction && (
              <div className="p-3 bg-content2/50 rounded-lg">
                <p className="text-sm text-foreground/80">{selectedAction.description}</p>
              </div>
            )}

            {/* Parameters */}
            {action && (
              <>
                <Divider />
                <h3 className="text-md font-medium">Parameters</h3>
                
                {getRequiredParams() === 'agentId' && (
                  <Input
                    label="Agent/Device ID"
                    placeholder="Enter agent or device identifier"
                    value={agentId}
                    onValueChange={setAgentId}
                    description="The unique identifier of the target endpoint"
                  />
                )}
                
                {getRequiredParams() === 'processId' && (
                  <Input
                    label="Process ID"
                    placeholder="Enter process ID (PID)"
                    value={processId}
                    onValueChange={setProcessId}
                    description="The process ID to terminate"
                  />
                )}
                
                {getRequiredParams() === 'hash' && (
                  <Input
                    label="File Hash"
                    placeholder="Enter SHA256 or MD5 hash"
                    value={hash}
                    onValueChange={setHash}
                    description="The file hash to block globally"
                  />
                )}

                <Textarea
                  label="Reason (Optional)"
                  placeholder="Reason for executing this action..."
                  value={reason}
                  onValueChange={setReason}
                />
              </>
            )}

            {/* Execute Button */}
            <div className="flex gap-3">
              <Button
                color={selectedAction?.dangerous ? 'danger' : 'primary'}
                isLoading={executing}
                isDisabled={!canExecute()}
                onPress={handleExecute}
                startContent={!executing && <Icon.Shield className="w-4 h-4" />}
              >
                {selectedAction?.dangerous ? 'Execute Dangerous Action' : 'Execute Action'}
              </Button>
              <Button variant="flat" onPress={resetForm}>
                Reset
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Recent Actions */}
        <Card className="bg-content1/50 backdrop-blur-md border border-white/5">
          <CardBody className="p-6">
            <h2 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] mb-4">Recent Actions</h2>
            
            {actionLogs.length === 0 ? (
              <p className="text-sm text-foreground/60 text-center py-8">
                No actions executed yet
              </p>
            ) : (
              <div className="space-y-3">
                {actionLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="p-3 bg-content2/50 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{log.action}</span>
                      <Chip
                        size="sm"
                        color={log.status === 'success' ? 'success' : log.status === 'failed' ? 'danger' : 'warning'}
                        variant="flat"
                      >
                        {log.status}
                      </Chip>
                    </div>
                    <p className="text-xs text-foreground/60">
                      {log.provider} • {log.target}
                    </p>
                    <p className="text-xs text-foreground/40">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Result Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>Action Result</ModalHeader>
          <ModalBody>
            {result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <Chip color="success" variant="flat">Success</Chip>
                  ) : (
                    <Chip color="danger" variant="flat">Failed</Chip>
                  )}
                  <span>{result.message}</span>
                </div>
                {!!result.data && (
                  <pre className="bg-content2 p-4 rounded-lg text-sm overflow-auto max-h-64">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onPress={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Confirmation Modal for Dangerous Actions */}
      <Modal isOpen={isConfirmOpen} onClose={onConfirmClose}>
        <ModalContent>
          <ModalHeader className="text-danger">⚠️ Confirm Dangerous Action</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p>You are about to execute a <strong>dangerous action</strong>:</p>
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="font-semibold">{selectedAction?.label}</p>
                <p className="text-sm text-foreground/70">{selectedAction?.description}</p>
              </div>
              <p className="text-sm text-foreground/60">
                This action may disrupt services or isolate endpoints. Please confirm you want to proceed.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onConfirmClose}>Cancel</Button>
            <Button color="danger" onPress={handleExecute}>
              Confirm & Execute
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
