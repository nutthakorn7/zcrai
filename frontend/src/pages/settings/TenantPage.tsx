import { useEffect, useState } from 'react';
import { 
  Card, CardBody, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure 
} from "@heroui/react";
import { api } from "../../shared/api/api";

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to suspend this tenant?')) return;
    try {
      await api.delete(`/tenants/${id}`);
      fetchTenants();
    } catch (error) {
      alert('Failed to suspend tenant');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tenant Management</h1>
        <Button color="primary" onPress={onOpen}>Create Tenant</Button>
      </div>

      <Card className="bg-content1">
        <CardBody>
          <Table aria-label="Tenants table">
            <TableHeader>
              <TableColumn>NAME</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
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
                    <Button size="sm" color="danger" variant="light" onPress={() => handleDelete(tenant.id)}>
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
    </div>
  );
}
