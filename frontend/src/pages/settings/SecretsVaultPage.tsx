import { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip, Divider, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';
import { SOARAPI, SOARIntegration } from '../../shared/api';
import toast from 'react-hot-toast';
import { Icon } from '../../shared/ui';
import { ShieldCheck, Key, Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

// Definitions of supported providers and their required fields
const PROVIDERS = [
  { key: 'crowdstrike', label: 'CrowdStrike Falcon', fields: ['clientId', 'clientSecret', 'domain'] },
  { key: 'sentinelone', label: 'SentinelOne', fields: ['apiToken', 'url'] },
  { key: 'fortigate', label: 'FortiGate Firewall', fields: ['apiKey', 'ipAddress'] },
];

/**
 * SecretsVaultPage allows administrators to securely manage response integration credentials.
 */
export default function SecretsVaultPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [integrations, setIntegrations] = useState<SOARIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setIsLoading(true);
      const data = await SOARAPI.listIntegrations();
      setIntegrations(data);
    } catch (error) {
      toast.error('Failed to load integrations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProvider) return;
    try {
      setIsSaving(true);
      await SOARAPI.saveSecret(selectedProvider, formData);
      toast.success(`${selectedProvider} credentials saved`);
      onClose();
      loadIntegrations();
    } catch (error) {
      toast.error('Failed to save credentials');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this integration?')) return;
    try {
      await SOARAPI.deleteSecret(id);
      toast.success('Integration removed');
      loadIntegrations();
    } catch (error) {
      toast.error('Failed to remove integration');
    }
  };

  const providerInfo = PROVIDERS.find(p => p.key === selectedProvider);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Secrets Vault
          </h1>
          <p className="text-foreground/60 text-sm mt-1">Securely manage credentials for SOAR response actions</p>
        </div>
        <Button 
          color="primary" 
          startContent={<Plus className="w-4 h-4" />}
          onPress={() => {
            setSelectedProvider('');
            setFormData({});
            onOpen();
          }}
        >
          Add Integration
        </Button>
      </div>

      {/* Integrations Table */}
      <Card className="bg-content1/50 backdrop-blur-md border border-white/5 shadow-2xl overflow-hidden">
        <CardBody className="p-0">
          <Table aria-label="Integrations table" removeWrapper className="bg-transparent">
            <TableHeader>
              <TableColumn className="bg-content2/50">PROVIDER</TableColumn>
              <TableColumn className="bg-content2/50">STATUS</TableColumn>
              <TableColumn className="bg-content2/50">LAST UPDATED</TableColumn>
              <TableColumn align="end" className="bg-content2/50">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody 
              emptyContent={"No integrations configured yet."} 
              loadingContent={<RefreshCw className="animate-spin text-primary" />} 
              loadingState={isLoading ? 'loading' : 'idle'}
            >
              {integrations.map((item) => (
                <TableRow key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3 py-1">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Key className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-bold capitalize">{item.provider}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" color={item.isActive ? 'success' : 'default'} variant="flat" className="capitalize">
                      {item.isActive ? 'Active' : 'Disabled'}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-foreground/60 text-xs tabular-nums">
                    {new Date(item.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" isIconOnly onPress={() => {
                        setSelectedProvider(item.provider);
                        onOpen();
                      }} className="hover:bg-primary/20 hover:text-primary border-transparent">
                        <Icon.Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" color="danger" isIconOnly onPress={() => handleDelete(item.id)} className="hover:bg-danger/20 border-transparent">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Configuration Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg" backdrop="blur">
        <ModalContent className="bg-content1/90 border border-white/10">
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-xl">Configure Integration</span>
            <span className="text-xs text-foreground/40 font-normal">Sensitive data is end-to-end encrypted</span>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <Select 
              label="Provider" 
              placeholder="Select security vendor"
              selectedKeys={selectedProvider ? [selectedProvider] : []}
              onSelectionChange={(keys) => setSelectedProvider(Array.from(keys)[0] as string)}
              className="max-w-full"
            >
              {PROVIDERS.map(p => (
                <SelectItem key={p.key} className="capitalize">{p.label}</SelectItem>
              ))}
            </Select>

            {providerInfo && (
              <div className="space-y-4 py-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Divider />
                <p className="text-[10px] text-foreground/40 uppercase font-black tracking-widest pl-1">Credentials</p>
                {providerInfo.fields.map(field => (
                  <Input 
                    key={field}
                    label={field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    placeholder={`Enter ${field}`}
                    variant="bordered"
                    type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('token') || field.toLowerCase().includes('key') ? 'password' : 'text'}
                    value={formData[field] || ''}
                    onValueChange={(val) => setFormData(p => ({ ...p, [field]: val }))}
                  />
                ))}
                
                <div className="flex gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl mt-4">
                  <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0" />
                  <p className="text-xs text-foreground/70 leading-relaxed">
                    <strong>Note:</strong> Credentials provided here will be encrypted using <code className="bg-primary/10 px-1 rounded">AES-256-GCM</code> on the server side. Only authorised SOC services can decrypt this data.
                  </p>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter className="border-t border-white/5">
            <Button variant="flat" onPress={onClose} className="font-semibold">Cancel</Button>
            <Button 
              color="primary" 
              onPress={handleSave} 
              isLoading={isSaving} 
              isDisabled={!selectedProvider}
              className="font-bold px-8 shadow-lg shadow-primary/20"
            >
              Save Integration
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
