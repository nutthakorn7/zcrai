import { useEffect, useState } from 'react';
import { Card, CardBody, Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip } from "@heroui/react";
import { api } from "../../shared/api/api";

interface Integration {
  id: string;
  provider: string;
  label: string;
  createdAt: string;
}

export default function IntegrationPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [modalType, setModalType] = useState<'s1' | 'cs'>('s1');

  // Form State
  const [s1Url, setS1Url] = useState('');
  const [s1Token, setS1Token] = useState('');
  const [csClientId, setCsClientId] = useState('');
  const [csSecret, setCsSecret] = useState('');
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

  const handleAddIntegration = async (onClose: () => void) => {
    setIsLoading(true);
    try {
      if (modalType === 's1') {
        await api.post('/integrations/sentinelone', {
          url: s1Url,
          token: s1Token,
          label: label || 'SentinelOne',
        });
      } else {
        await api.post('/integrations/crowdstrike', {
          clientId: csClientId,
          clientSecret: csSecret,
          label: label || 'CrowdStrike',
        });
      }
      fetchIntegrations();
      onClose();
      resetForm();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add integration');
    } finally {
      setIsLoading(false);
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
    setLabel('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <div className="flex gap-2">
          <Button 
            color="primary" 
            onPress={() => { setModalType('s1'); onOpen(); }}
          >
            Add SentinelOne
          </Button>
          <Button 
            color="secondary" 
            onPress={() => { setModalType('cs'); onOpen(); }}
          >
            Add CrowdStrike
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
                  <Chip size="sm" color={int.provider === 'sentinelone' ? 'primary' : 'secondary'}>
                    {int.provider}
                  </Chip>
                </div>
                <p className="text-small text-default-500">
                  Added on {new Date(int.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button color="danger" variant="light" onPress={() => handleDelete(int.id)}>
                Remove
              </Button>
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
                Add {modalType === 's1' ? 'SentinelOne' : 'CrowdStrike'} Integration
              </ModalHeader>
              <ModalBody>
                <Input
                  label="Label (Optional)"
                  placeholder="e.g. Production Env"
                  value={label}
                  onValueChange={setLabel}
                />
                
                {modalType === 's1' ? (
                  <>
                    <Input
                      label="Base URL"
                      placeholder="https://apne1-pax8.sentinelone.net"
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
                ) : (
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
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary" onPress={() => handleAddIntegration(onClose)} isLoading={isLoading}>
                  Test & Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
