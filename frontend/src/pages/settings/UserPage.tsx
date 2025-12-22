import { useEffect, useState } from 'react';
import { 
  Card, CardBody, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Select, SelectItem
} from "@heroui/react";
import { api } from "../../shared/api/api";
import { useAuth } from "../../shared/store/useAuth";

interface User {
  id: string;
  email: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
}

export default function UserPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);
  
  // Invite Form
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('soc_analyst');

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.data);
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (onClose: () => void) => {
    setIsLoading(true);
    try {
      await api.post('/users', { email, role });
      fetchUsers();
      onClose();
      setEmail('');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to invite user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      if (status === 'suspended') {
        await api.delete(`/users/${userId}`);
      } else {
        await api.put(`/users/${userId}`, { status });
      }
      fetchUsers();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Button color="primary" onPress={onOpen}>Invite User</Button>
      </div>

      <Card className="bg-content1">
        <CardBody>
          <Table aria-label="Users table">
            <TableHeader>
              <TableColumn>EMAIL</TableColumn>
              <TableColumn>ROLE</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>MFA</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent={"No users found."}>
              {Array.isArray(users) && users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip 
                      size="sm" 
                      variant="flat" 
                      color={
                        user.role === 'superadmin' ? 'danger' :
                        user.role === 'tenant_admin' ? 'secondary' : 
                        'default'
                      }
                    >
                      {user.role.replace('_', ' ')}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" color={user.status === 'active' ? 'success' : user.status === 'pending' ? 'warning' : 'danger'} variant="dot">
                      {user.status}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className={user.mfaEnabled ? "text-success" : "text-default-400"}>
                      {user.mfaEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button size="sm" variant="light">Options</Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="User Actions">
                        <DropdownItem key="activate" onPress={() => handleStatusChange(user.id, 'active')}>Activate</DropdownItem>
                        <DropdownItem key="suspend" onPress={() => handleStatusChange(user.id, 'suspended')} className="text-danger" color="danger">Suspend</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
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
              <ModalHeader>Invite New User</ModalHeader>
              <ModalBody>
                <Input
                  label="Email"
                  placeholder="user@example.com"
                  value={email}
                  onValueChange={setEmail}
                />
                <Select 
                  label="Role" 
                  selectedKeys={[role]} 
                  onChange={(e) => setRole(e.target.value)}
                >
                  {[
                    { key: "soc_analyst", label: "SOC Analyst" },
                    { key: "tenant_admin", label: "Tenant Admin" },
                    { key: "customer", label: "Customer (Read-only)" },
                    ...(currentUser?.role === 'superadmin' ? [{ key: "superadmin", label: "Super Admin (System-wide)", className: "text-danger" }] : [])
                  ].map((item) => (
                    <SelectItem key={item.key} className={item.className || ""}>
                      {item.label}
                    </SelectItem>
                  ))}
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={() => handleInvite(onClose)} isLoading={isLoading}>Invite</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
