import { useState, useEffect } from 'react';
import { Card, Button, Input, Textarea, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, useDisclosure } from '@heroui/react';
import { Plus, Edit, Trash2, TestTube } from 'lucide-react';
import { api } from '../../shared/api';
import { PageHeader, ConfirmDialog } from '../../shared/ui';
import toast from 'react-hot-toast';

interface Parser {
  id: string;
  name: string;
  description?: string;
  type: 'regex' | 'grok' | 'json_path';
  pattern: string;
  fieldMappings?: Record<string, string>;
  testInput?: string;
  isActive: boolean;
  createdAt: string;
}

interface ParserTestResult {
  success: boolean;
  data?: any;
  error?: string;
}

export default function ParsersPage() {
  const [parsers, setParsers] = useState<Parser[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isTestOpen, onOpen: onTestOpen, onClose: onTestClose } = useDisclosure();
  const [editingParser, setEditingParser] = useState<Parser | null>(null);
  const [testResult, setTestResult] = useState<ParserTestResult | null>(null);
  
  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [parserToDelete, setParserToDelete] = useState<string | null>(null);

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
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDeleteClick = (id: string) => {
    setParserToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!parserToDelete) return;
    try {
      await api.delete(`/parsers/${parserToDelete}`);
      toast.success('Parser deleted');
      fetchParsers();
    } catch (error) {
      toast.error('Failed to delete parser');
    } finally {
      setDeleteConfirmOpen(false);
      setParserToDelete(null);
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
      <PageHeader title="Custom Parsers" description="Create custom log parsing rules">
        <Button color="primary" startContent={<Plus className="w-4 h-4" />} onPress={openCreateModal}>
          New Parser
        </Button>
      </PageHeader>

      <Card className="p-6">
        <Table aria-label="Parsers table">
          <TableHeader>
            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">NAME</TableColumn>
            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">TYPE</TableColumn>
            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">PATTERN</TableColumn>
            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">STATUS</TableColumn>
            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">ACTIONS</TableColumn>
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
                    <Button size="sm" variant="light" color="danger" isIconOnly onPress={() => handleDeleteClick(parser.id)}>
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
                onSelectionChange={(keys) => setFormData({ ...formData, type: Array.from(keys)[0] as 'regex' | 'grok' | 'json_path' })}
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

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Parser"
        description="Are you sure you want to delete this parser?"
        confirmLabel="Delete"
        confirmColor="danger"
      />
    </div>
  );
}
