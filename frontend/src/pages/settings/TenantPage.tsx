import { useEffect, useState } from 'react';
import { 
  Card, CardBody, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure 
} from "@heroui/react";
import { api } from "@/shared/api";
import { ConfirmDialog } from "@/shared/ui";

interface Tenant {
  id: string;
  name: string;
  status: string;
  userCount?: number;
}

export default function TenantPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [tenantToSuspend, setTenantToSuspend] = useState<string | null>(null);
  const [suspending, setSuspending] = useState(false);

  const fetchTenants = async () => {
    try {
      const { data } = await api.get('/tenants');
      setTenants(data.data);
    } catch (error) {
      console.error('Failed to fetch tenants');
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (onClose: () => void) => {
    setIsLoading(true);
    try {
      await api.post('/tenants', { name });
      fetchTenants();
      onClose();
      setName('');
    } catch (error) {
       const err = error as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Failed to create tenant');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSuspend = async () => {
    if (!tenantToSuspend) return;
    setSuspending(true);
    try {
      await api.delete(`/tenants/${tenantToSuspend}`);
      fetchTenants();
    } catch (error) {
      alert('Failed to suspend tenant');
    } finally {
      setSuspending(false);
      setTenantToSuspend(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Tenant Management</h1>
        <Button color="primary" onPress={onOpen} className="font-bold">Create Tenant</Button>
      </div>

      <Card className="bg-content1">
        <CardBody>
          <Table aria-label="Tenants table">
            <TableHeader>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">NAME</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">STATUS</TableColumn>
              <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent={"No tenants found."}>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>{tenant.name}</TableCell>
                  <TableCell>
                    <Chip size="sm" color={tenant.status === 'active' ? 'success' : 'danger'} variant="dot">
                      {tenant.status}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" color="danger" variant="light" onPress={() => setTenantToSuspend(tenant.id)}>
                      Suspend
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Create New Tenant</ModalHeader>
              <ModalBody>
                <Input
                  label="Tenant Name"
                  placeholder="Company Name"
                  value={name}
                  onValueChange={setName}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={() => handleCreateTenant(onClose)} isLoading={isLoading}>Create</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <ConfirmDialog 
        isOpen={!!tenantToSuspend}
        onClose={() => setTenantToSuspend(null)}
        onConfirm={confirmSuspend}
        title="Suspend Tenant"
        description="Are you sure you want to suspend this tenant? They will lose access immediately."
        confirmLabel="Suspend"
        confirmColor="danger"
        isLoading={suspending}
      />
    </div>
  );
}
