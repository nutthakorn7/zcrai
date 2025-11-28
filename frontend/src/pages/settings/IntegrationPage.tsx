import { useEffect, useState } from 'react';
import { Card, CardBody, Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip, Select, SelectItem } from "@heroui/react";
import { api } from "../../shared/api/api";

interface Integration {
  id: string;
  provider: string;
  label: string;
  createdAt: string;
  hasApiKey: boolean;
  lastSyncStatus: 'success' | 'error' | 'pending' | null;
  lastSyncError: string | null;
  lastSyncAt: string | null;
}

export default function IntegrationPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  
  // Mode: 'add' | 'edit'
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  // Selected Provider for Add
  const [modalType, setModalType] = useState<'s1' | 'cs' | 'ai'>('s1');
  // Selected Integration for Edit
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // AI Provider Select
  const [aiProvider, setAiProvider] = useState('openai');

  // Form State
  const [s1Url, setS1Url] = useState('');
  const [s1Token, setS1Token] = useState('');
  const [csClientId, setCsClientId] = useState('');
  const [csSecret, setCsSecret] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [label, setLabel] = useState('');

  const fetchIntegrations = async () => {
    try {
      const { data } = await api.get('/integrations');
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to fetch integrations');
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleOpenAdd = (type: 's1' | 'cs' | 'ai') => {
    setMode('add');
    setModalType(type);
    resetForm();
    onOpen();
  };

  const handleOpenEdit = (int: Integration) => {
    setMode('edit');
    setSelectedIntegration(int);
    setLabel(int.label);
    onOpen();
  };

  const handleSubmit = async (onClose: () => void) => {
    setIsLoading(true);
    try {
      if (mode === 'add') {
        if (modalType === 's1') {
          await api.post('/integrations/sentinelone', {
            url: s1Url,
            token: s1Token,
            label: label || 'SentinelOne',
          });
        } else if (modalType === 'cs') {
          await api.post('/integrations/crowdstrike', {
            clientId: csClientId,
            clientSecret: csSecret,
            label: label || 'CrowdStrike',
          });
        } else if (modalType === 'ai') {
          await api.post(`/integrations/ai/${aiProvider}`, {
            apiKey: aiKey,
            label: label || aiProvider.toUpperCase(),
          });
        }
      } else {
        // Edit Mode
        if (selectedIntegration) {
          await api.put(`/integrations/${selectedIntegration.id}`, {
            label: label,
          });
        }
      }

      fetchIntegrations();
      onClose();
      resetForm();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Test State
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const { data } = await api.post(`/integrations/${id}/test`);
      alert(`✅ ${data.message}`);
    } catch (error: any) {
      alert(`❌ ${error.response?.data?.error || 'Connection failed'}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;
    try {
      await api.delete(`/integrations/${id}`);
      fetchIntegrations();
    } catch (error) {
      alert('Failed to delete integration');
    }
  };

  const resetForm = () => {
    setS1Url('');
    setS1Token('');
    setCsClientId('');
    setCsSecret('');
    setAiKey('');
    setLabel('');
    setAiProvider('openai');
    setSelectedIntegration(null);
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'sentinelone': return 'primary';
      case 'crowdstrike': return 'secondary';
      case 'openai': return 'success';
      case 'claude': return 'warning';
      case 'gemini': return 'default';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <div className="flex gap-2">
          <Button color="primary" onPress={() => handleOpenAdd('s1')}>
            Add SentinelOne
          </Button>
          <Button color="secondary" onPress={() => handleOpenAdd('cs')}>
            Add CrowdStrike
          </Button>
          <Button color="success" className="text-white" onPress={() => handleOpenAdd('ai')}>
            Add AI Provider
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {integrations.map((int) => (
          <Card key={int.id} className="bg-content1">
            <CardBody className="flex flex-row justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold">{int.label}</h3>
                  <Chip size="sm" color={getProviderColor(int.provider) as any}>
                    {int.provider}
                  </Chip>
                  {/* Visual Indicator - แสดงสถานะตาม lastSyncStatus */}
                  {!int.hasApiKey ? (
                    <Chip size="sm" variant="dot" color="danger" className="border-none pl-1">
                      Missing API Key
                    </Chip>
                  ) : int.lastSyncStatus === 'error' ? (
                    <Chip size="sm" variant="dot" color="warning" className="border-none pl-1" title={int.lastSyncError || 'Sync failed'}>
                      Sync Error
                    </Chip>
                  ) : (
                    <Chip size="sm" variant="dot" color="success" className="border-none pl-1" title={int.lastSyncStatus === 'pending' ? 'Syncing...' : 'Synced'}>
                      Connected
                    </Chip>
                  )}
                </div>
                <p className="text-small text-default-500">
                  Added on {new Date(int.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  color="success"
                  isLoading={testingId === int.id}
                  onPress={() => handleTestConnection(int.id)}
                >
                  Test Connection
                </Button>
                <Button size="sm" variant="flat" onPress={() => handleOpenEdit(int)}>
                  Edit
                </Button>
                <Button size="sm" color="danger" variant="light" onPress={() => handleDelete(int.id)}>
                  Remove
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
        
        {integrations.length === 0 && (
          <div className="text-center py-10 text-default-500">
            No integrations configured yet.
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {mode === 'add' ? (
                  `Add ${modalType === 's1' ? 'SentinelOne' : modalType === 'cs' ? 'CrowdStrike' : 'AI Provider'} Integration`
                ) : (
                  'Edit Integration'
                )}
              </ModalHeader>
              <ModalBody>
                <Input
                  label="Label"
                  placeholder="e.g. Production Env, PAX8 Instance"
                  value={label}
                  onValueChange={setLabel}
                />
                
                {mode === 'add' && (
                  <>
                    {modalType === 's1' && (
                      <>
                        <Input
                          label="Base URL"
                          placeholder="https://apne1-pax8.sentinelone.net (Example)"
                          description="Enter your SentinelOne console URL"
                          value={s1Url}
                          onValueChange={setS1Url}
                        />
                        <Input
                          label="API Token"
                          placeholder="Enter your API Token"
                          value={s1Token}
                          onValueChange={setS1Token}
                          type="password"
                        />
                      </>
                    )}

                    {modalType === 'cs' && (
                      <>
                        <Input
                          label="Client ID"
                          placeholder="Enter Client ID"
                          value={csClientId}
                          onValueChange={setCsClientId}
                        />
                        <Input
                          label="Client Secret"
                          placeholder="Enter Client Secret"
                          value={csSecret}
                          onValueChange={setCsSecret}
                          type="password"
                        />
                      </>
                    )}

                    {modalType === 'ai' && (
                      <>
                        <Select 
                          label="Provider" 
                          selectedKeys={[aiProvider]} 
                          onChange={(e) => setAiProvider(e.target.value)}
                        >
                          <SelectItem key="openai">OpenAI</SelectItem>
                          <SelectItem key="claude">Claude (Anthropic)</SelectItem>
                          <SelectItem key="gemini">Gemini (Google)</SelectItem>
                          <SelectItem key="deepseek">DeepSeek</SelectItem>
                        </Select>
                        <Input
                          label="API Key"
                          placeholder={`sk-... (Enter your ${aiProvider} API Key)`}
                          value={aiKey}
                          onValueChange={setAiKey}
                          type="password"
                        />
                      </>
                    )}
                  </>
                )}
              </ModalBody>

              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary" onPress={() => handleSubmit(onClose)} isLoading={isLoading}>
                  {mode === 'add' ? 'Test & Save' : 'Update'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
