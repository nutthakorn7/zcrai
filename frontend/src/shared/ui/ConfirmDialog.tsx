import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Icon } from './icon';

type ConfirmColor = 'danger' | 'warning' | 'primary' | 'success';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: ConfirmColor;
  isLoading?: boolean;
}

/**
 * Reusable confirmation dialog for destructive actions.
 * Shows a warning icon and requires explicit user confirmation.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  const iconColors: Record<ConfirmColor, string> = {
    danger: 'text-danger',
    warning: 'text-warning',
    primary: 'text-primary',
    success: 'text-success',
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="sm">
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-danger/10 ${iconColors[confirmColor]}`}>
            <Icon.Alert className="w-5 h-5" />
          </div>
          <span>{title}</span>
        </ModalHeader>
        <ModalBody>
          <p className="text-foreground/70">{description}</p>
        </ModalBody>
        <ModalFooter>
          <Button color="default" variant="light" onPress={onClose}>
            {cancelLabel}
          </Button>
          <Button
            color={confirmColor}
            onPress={handleConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
