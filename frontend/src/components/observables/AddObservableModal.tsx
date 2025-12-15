import { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem, Switch } from "@heroui/react";
import { ObservablesAPI } from '../../shared/api/observables';
import { Icon } from '../../shared/ui';

interface AddObservableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const IOC_TYPES = [
  { label: 'IP Address', value: 'ip' },
  { label: 'Domain', value: 'domain' },
  { label: 'URL', value: 'url' },
  { label: 'File Hash', value: 'hash' },
  { label: 'Email', value: 'email' },
];

export function AddObservableModal({ isOpen, onClose, onSuccess }: AddObservableModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'ip',
    value: '',
    isMalicious: true,
    tags: ''
  });

  const handleSubmit = async () => {
    if (!formData.value) return;

    try {
      setLoading(true);
      await ObservablesAPI.create({
        type: formData.type,
        value: formData.value,
        isMalicious: formData.isMalicious,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      });
      onSuccess();
      onClose();
      // Reset form
      setFormData({ type: 'ip', value: '', isMalicious: true, tags: '' });
    } catch (e) {
      console.error('Failed to create observable:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Add New Observable
              <span className="text-xs font-normal text-default-500">Manually add an indicator to the watchlist</span>
            </ModalHeader>
            <ModalBody className="gap-4">
              <Select 
                label="Type" 
                selectedKeys={[formData.type]} 
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                {IOC_TYPES.map((type) => (
                  <SelectItem key={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </Select>

              <Input
                autoFocus
                label="Value"
                placeholder={formData.type === 'ip' ? 'e.g. 1.2.3.4' : 'Enter value...'}
                value={formData.value}
                onValueChange={(v) => setFormData({ ...formData, value: v })}
                startContent={
                  <div className="pointer-events-none flex items-center">
                    <span className="text-default-400 text-small">
                      {formData.type === 'url' ? 'https://' : ''}
                    </span>
                  </div>
                }
              />

              <Input
                label="Tags"
                placeholder="phishing, apt29, critical (comma separated)"
                value={formData.tags}
                onValueChange={(v) => setFormData({ ...formData, tags: v })}
                startContent={<Icon.Info className="w-4 h-4 text-default-400" />}
              />

              <div className="flex items-center justify-between p-3 bg-content2 rounded-lg border border-default-200">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Mark as Malicious</span>
                  <span className="text-xs text-default-500">Flag this indicator as a threat</span>
                </div>
                <Switch 
                  isSelected={formData.isMalicious} 
                  onValueChange={(v) => setFormData({ ...formData, isMalicious: v })}
                  color="danger"
                  size="sm"
                />
              </div>

            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose} isDisabled={loading}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSubmit} isLoading={loading}>
                Add Observable
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
