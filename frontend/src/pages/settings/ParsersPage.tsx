import { useState, useEffect } from 'react';
import { Card, Button, Input, Textarea, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, useDisclosure } from '@heroui/react';
import { Plus, Edit, Trash2, TestTube } from 'lucide-react';
import { api } from '../../shared/api/api';
import toast from 'react-hot-toast';

interface Parser {
  id: string;
  name: string;
  description?: string;
  type: 'regex' | 'grok' | 'json_path';
  pattern: string;
  fieldMappings?: any;
  testInput?: string;
  isActive: boolean;
  createdAt: string;
}

export default function ParsersPage() {
  const [parsers, setParsers] = useState<Parser[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isTestOpen, onOpen: onTestOpen, onClose: onTestClose } = useDisclosure();
  const [editingParser, setEditingParser] = useState<Parser | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'regex' as 'regex' | 'grok' | 'json_path',
    pattern: '',
    testInput: '',
  });

  useEffect(() => {
    fetchParsers();
  }, []);

  const fetchParsers = async () => {
    try {
      const res = await api.get('/parsers');
      setParsers(res.data.data || []);
    } catch (error) {
      toast.error('Failed to load parsers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingParser) {
        await api.put(`/parsers/${editingParser.id}`, formData);
        toast.success('Parser updated');
      } else {
        await api.post('/parsers', formData);
        toast.success('Parser created');
      }
      onClose();
      fetchParsers();
      resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this parser?')) return;
    try {
      await api.delete(`/parsers/${id}`);
      toast.success('Parser deleted');
      fetchParsers();
    } catch (error) {
      toast.error('Failed to delete parser');
    }
  };

  const handleTest = async () => {
    try {
      const res = await api.post('/parsers/test', {
        pattern: formData.pattern,
        type: formData.type,
        testInput: formData.testInput,
      });
      setTestResult(res.data.data);
      onTestOpen();
    } catch (error) {
      toast.error('Test failed');
    }
  };

  const handleEdit = (parser: Parser) => {
    setEditingParser(parser);
    setFormData({
      name: parser.name,
      description: parser.description || '',
      type: parser.type,
      pattern: parser.pattern,
      testInput: parser.testInput || '',
    });
    onOpen();
  };

  const resetForm = () => {
    setEditingParser(null);
    setFormData({
      name: '',
      description: '',
      type: 'regex',
      pattern: '',
      testInput: '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    onOpen();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Custom Parsers</h1>
          <p className="text-sm text-default-600">Create custom log parsing rules</p>
        </div>
        <Button color="primary" startContent={<Plus className="w-4 h-4" />} onPress={openCreateModal}>
          New Parser
        </Button>
      </div>

      <Card className="p-6">
        <Table aria-label="Parsers table">
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>TYPE</TableColumn>
            <TableColumn>PATTERN</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>ACTIONS</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No parsers found" isLoading={loading}>
            {parsers.map((parser) => (
              <TableRow key={parser.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{parser.name}</div>
                    {parser.description && (
                      <div className="text-xs text-default-500">{parser.description}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">{parser.type.toUpperCase()}</Chip>
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-default-100 px-2 py-1 rounded">
                    {parser.pattern.length > 40 ? parser.pattern.substring(0, 40) + '...' : parser.pattern}
                  </code>
                </TableCell>
                <TableCell>
                  <Chip color={parser.isActive ? 'success' : 'default'} size="sm" variant="flat">
                    {parser.isActive ? 'Active' : 'Inactive'}
                  </Chip>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="light" isIconOnly onPress={() => handleEdit(parser)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="light" color="danger" isIconOnly onPress={() => handleDelete(parser.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="3xl">
        <ModalContent>
          <ModalHeader>{editingParser ? 'Edit Parser' : 'Create Parser'}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Name"
                placeholder="e.g., Apache Access Log Parser"
                value={formData.name}
                onValueChange={(val) => setFormData({ ...formData, name: val })}
              />
              <Textarea
                label="Description"
                placeholder="What does this parser do?"
                value={formData.description}
                onValueChange={(val) => setFormData({ ...formData, description: val })}
              />
              <Select
                label="Parser Type"
                selectedKeys={[formData.type]}
                onSelectionChange={(keys) => setFormData({ ...formData, type: Array.from(keys)[0] as any })}
              >
                <SelectItem key="regex">Regex</SelectItem>
                <SelectItem key="json_path">JSON Path</SelectItem>
                <SelectItem key="grok">Grok (Coming Soon)</SelectItem>
              </Select>
              <Textarea
                label="Pattern"
                placeholder={formData.type === 'regex' ? 'e.g., ^(?<ip>.+?) - (?<user>.+?) \\[(?<timestamp>.+?)\\]' : 'e.g., data.user.name'}
                value={formData.pattern}
                onValueChange={(val) => setFormData({ ...formData, pattern: val })}
                minRows={3}
              />
              <Textarea
                label="Test Input (Sample Log)"
                placeholder="Paste a sample log to test your pattern"
                value={formData.testInput}
                onValueChange={(val) => setFormData({ ...formData, testInput: val })}
                minRows={3}
              />
              <Button
                color="secondary"
                variant="flat"
                startContent={<TestTube className="w-4 h-4" />}
                onPress={handleTest}
                isDisabled={!formData.pattern || !formData.testInput}
              >
                Test Pattern
              </Button>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>Cancel</Button>
            <Button color="primary" onPress={handleSubmit} isDisabled={!formData.name || !formData.pattern}>
              {editingParser ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Test Result Modal */}
      <Modal isOpen={isTestOpen} onClose={onTestClose}>
        <ModalContent>
          <ModalHeader>Test Result</ModalHeader>
          <ModalBody>
            {testResult?.success ? (
              <div className="space-y-2">
                <Chip color="success" variant="flat">✓ Pattern Matched</Chip>
                <pre className="bg-default-100 p-4 rounded text-xs overflow-auto">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="space-y-2">
                <Chip color="danger" variant="flat">✗ Pattern Failed</Chip>
                <p className="text-sm text-danger">{testResult?.error}</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onPress={onTestClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
