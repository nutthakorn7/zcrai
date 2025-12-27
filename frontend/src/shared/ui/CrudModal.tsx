import { ReactNode } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';

type ModalMode = 'create' | 'edit' | 'view';

interface CrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  mode?: ModalMode;
  children: ReactNode;
  onSubmit?: () => void | Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  hideFooter?: boolean;
}

/**
 * Reusable CRUD modal wrapper for create, edit, and view operations.
 * Handles common modal patterns with consistent styling.
 */
export function CrudModal({
  isOpen,
  onClose,
  title,
  mode = 'create',
  children,
  onSubmit,
  isLoading = false,
  submitLabel,
  cancelLabel = 'Cancel',
  size = 'lg',
  hideFooter = false,
}: CrudModalProps) {
  const getDefaultSubmitLabel = () => {
    switch (mode) {
      case 'create':
        return 'Create';
      case 'edit':
        return 'Save Changes';
      case 'view':
        return 'Close';
      default:
        return 'Submit';
    }
  };

  const handleSubmit = async () => {
    if (mode === 'view') {
      onClose();
      return;
    }
    if (onSubmit) {
      await onSubmit();
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size={size}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-lg font-semibold">{title}</span>
        </ModalHeader>
        <ModalBody>{children}</ModalBody>
        {!hideFooter && (
          <ModalFooter>
            {mode !== 'view' && (
              <Button color="default" variant="light" onPress={onClose}>
                {cancelLabel}
              </Button>
            )}
            <Button
              color={mode === 'view' ? 'default' : 'primary'}
              onPress={handleSubmit}
              isLoading={isLoading}
            >
              {submitLabel || getDefaultSubmitLabel()}
            </Button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}
