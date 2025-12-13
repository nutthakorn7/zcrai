import { useEffect, useState, useMemo } from 'react';
import { Card, CardBody, Button, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Input, Textarea, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { Icon } from '../../shared/ui';
import { CasesAPI, Case } from '../../shared/api/cases';
import { useNavigate } from 'react-router-dom';
import { DonutCard } from '../../components/DonutCard';
import { FilterBar } from '../../components/FilterBar';
import { SEVERITY_COLORS, getSeverityColor, getSeverityDotSize } from '../../constants/severity';

const COLS = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
};

const ALL_COLS = {
  ...COLS,
  closed: 'Closed'
};

type ViewMode = 'kanban' | 'table';

export default function CaseBoardPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showClosed, setShowClosed] = useState(false);
  
  // Filter states
  const [savedFilter, setSavedFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [formData, setFormData] = useState({ title: '', description: '', severity: 'medium' });
  const navigate = useNavigate();

  const fetchCases = async () => {
    try {
      const data = await CasesAPI.list();
      setCases(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Load saved filters from localStorage on mount
  useEffect(() => {
    const savedFilters = localStorage.getItem('caseFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        if (filters.savedFilter) setSavedFilter(filters.savedFilter);
        if (filters.severityFilter) setSeverityFilter(filters.severityFilter);
        if (filters.statusFilter) setStatusFilter(filters.statusFilter);
        if (filters.assigneeFilter) setAssigneeFilter(filters.assigneeFilter);
        if (filters.searchQuery) setSearchQuery(filters.searchQuery);
      } catch (e) {
        console.error('Failed to load saved filters', e);
      }
    }
  }, []);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    const filters = {
      savedFilter,
      severityFilter,
      statusFilter,
      assigneeFilter,
      searchQuery
    };
    localStorage.setItem('caseFilters', JSON.stringify(filters));
  }, [savedFilter, severityFilter, statusFilter, assigneeFilter, searchQuery]);

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    // Auto-apply saved filters
    if (savedFilter === 'my-cases') {
      // Would filter by current user - placeholder for now
      setStatusFilter(['open', 'investigating']);
    } else if (savedFilter === 'unassigned') {
      setAssigneeFilter('Unassigned');
    } else if (savedFilter === 'critical') {
      setSeverityFilter(['critical']);
    } else if (savedFilter === 'sla-risk') {
      // Would filter by SLA - placeholder
      setStatusFilter(['open']);
    }
  }, [savedFilter]);

  // Get unique assignees for autocomplete
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    cases.forEach(c => {
      if (c.assigneeName) assignees.add(c.assigneeName);
    });
    assignees.add('Unassigned');
    return Array.from(assignees).sort();
  }, [cases]);

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (severityFilter.length > 0 && !severityFilter.includes(c.severity)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(c.status)) return false;
      if (assigneeFilter && c.assigneeName?.toLowerCase() !== assigneeFilter.toLowerCase()) return false;
      if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [cases, severityFilter, statusFilter, assigneeFilter, searchQuery]);

  // Aggregate data for donut charts
  const severityData = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    filteredCases.forEach(c => {
      const sev = c.severity.toLowerCase();
      if (sev in counts) counts[sev as keyof typeof counts]++;
    });
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({
        name: SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS].label,
        value,
        color: SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS].dot
      }));
  }, [filteredCases]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCases.forEach(c => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    const colors = {
      open: '#60A5FA', investigating: '#FBBF24', resolved: '#34D399', closed: '#9CA3AF'
    };
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[name as keyof typeof colors] || '#9CA3AF'
    }));
  }, [filteredCases]);

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCases.forEach(c => {
      counts[c.priority] = (counts[c.priority] || 0) + 1;
    });
    const colors = { urgent: '#EF4444', high: '#F97316', normal: '#3B82F6', low: '#9CA3AF' };
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[name as keyof typeof colors] || '#9CA3AF'
    }));
  }, [filteredCases]);

  const assigneeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCases.forEach(c => {
      const assignee = c.assigneeName || 'Unassigned';
      counts[assignee] = (counts[assignee] || 0) + 1;
    });
    const palette = ['#60A5FA', '#34D399', '#FBBF24', '#F97316', '#A78BFA'];
    return Object.entries(counts).map(([name, value], idx) => ({
      name,
      value,
      color: palette[idx % palette.length]
    }));
  }, [filteredCases]);

  const handleClearFilters = () => {
    setSavedFilter('');
    setSeverityFilter([]);
    setStatusFilter([]);
    setAssigneeFilter('');
    setSearchQuery('');
  };

  const handleCreate = async () => {
    await CasesAPI.create(formData);
    onOpenChange();
    fetchCases();
  };

  const getSeverityColorUtil = (sev: string) => {
    switch(sev) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      default: return 'default';
    }
  };

  const renderCell = (caseItem: Case, columnKey: string) => {
    switch (columnKey) {
      case "severity":
        const severityColor = getSeverityColor(caseItem.severity);
        return (
          <div className="flex items-center gap-2">
            <div 
              className="rounded-full" 
              style={{ 
                width: getSeverityDotSize(caseItem.severity), 
                height: getSeverityDotSize(caseItem.severity),
                backgroundColor: severityColor.dot
              }}
            />
            <Chip size="sm" color={getSeverityColorUtil(caseItem.severity)} variant="dot">{caseItem.severity}</Chip>
          </div>
        );
      case "title":
        return <span className="font-medium">{caseItem.title}</span>;
      case "status":
        const statusIcons = {
          open: '⚪',
          investigating: '🔵',
          resolved: '✅',
          closed: '⭕'
        };
        return (
          <div className="flex items-center gap-2">
            <span>{statusIcons[caseItem.status as keyof typeof statusIcons] || '⚪'}</span>
            <Chip size="sm" variant="flat" className="capitalize">{caseItem.status}</Chip>
          </div>
        );
      case "assignee":
        return <span className="text-sm">{caseItem.assigneeName || 'Unassigned'}</span>;
      case "priority":
        return <Chip size="sm" variant="flat">{caseItem.priority}</Chip>;
      case "created":
        const date = new Date(caseItem.createdAt);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        return (
          <span className="text-sm text-gray-400">
            {isToday 
              ? `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
              : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            }
          </span>
        );
      case "actions":
        return (
          <Button size="sm" variant="light" onPress={() => navigate(`/cases/${caseItem.id}`)} isIconOnly>
            <Icon.Eye className="w-4 h-4" />
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Case Management</h1>
          <p className="text-gray-400">{filteredCases.length} cases</p>
        </div>
        <div className="flex gap-2">
          {/* View Switcher */}
          <div className="flex bg-content1 rounded-lg p-1 border border-white/5">
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'flat' : 'light'}
              onPress={() => setViewMode('table')}
              startContent={<Icon.Document className="w-4 h-4" />}
            >
              Table
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'kanban' ? 'flat' : 'light'}
              onPress={() => setViewMode('kanban')}
              startContent={<Icon.Dashboard className="w-4 h-4" />}
            >
              Kanban
            </Button>
          </div>
          <Button color="primary" onPress={onOpen} startContent={<Icon.Add className="w-4 h-4" />}>
            New Case
          </Button>
        </div>
      </div>

      {/* Dashboard Cards (Table View Only) */}
      {viewMode === 'table' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <DonutCard title="Severity" data={severityData} onSegmentClick={(name) => setSeverityFilter([name.toLowerCase()])} />
            <DonutCard title="Status" data={statusData} onSegmentClick={(name) => setStatusFilter([name.toLowerCase()])} />
            <DonutCard title="Priority" data={priorityData} />
            <DonutCard title="Owner" data={assigneeData} />
          </div>

          {/* Filter Bar */}
          <FilterBar
            savedFilter={savedFilter}
            onSavedFilterChange={setSavedFilter}
            severityFilter={severityFilter}
            onSeverityFilterChange={setSeverityFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            assigneeFilter={assigneeFilter}
            onAssigneeFilterChange={setAssigneeFilter}
            assignees={uniqueAssignees}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSubmit={() => {}} // Filters are applied automatically
            onClearFilters={handleClearFilters}
          />
        </>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <Table 
          aria-label="Cases table"
          classNames={{
            wrapper: "bg-content1 shadow-none border border-white/5 rounded-lg",
            th: "bg-content2 text-xs font-bold text-foreground/60 uppercase tracking-wider border-b border-white/10",
            td: "py-3 text-foreground/90",
            tr: "hover:bg-content2/50 border-b border-white/5 last:border-0 cursor-pointer transition-all",
          }}
          onRowAction={(key) => navigate(`/cases/${key}`)}
        >
          <TableHeader>
            <TableColumn key="severity">SEVERITY</TableColumn>
            <TableColumn key="title">TITLE</TableColumn>
            <TableColumn key="status">STATUS</TableColumn>
            <TableColumn key="assignee">ASSIGNEE</TableColumn>
            <TableColumn key="priority">PRIORITY</TableColumn>
            <TableColumn key="created">CREATED</TableColumn>
            <TableColumn key="actions">ACTIONS</TableColumn>
          </TableHeader>
          <TableBody items={filteredCases} emptyContent="No cases found.">
            {(item) => (
              <TableRow key={item.id}>
                {(columnKey) => <TableCell>{renderCell(item, columnKey as string)}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-400">
              {showClosed ? 'Showing all statuses' : 'Hiding closed cases'}
            </p>
            <Button
              size="sm"
              variant="flat"
              onPress={() => setShowClosed(!showClosed)}
            >
              {showClosed ? 'Hide Closed' : 'Show Closed'}
            </Button>
          </div>

          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {Object.entries(showClosed ? ALL_COLS : COLS).map(([status, label]) => (
              <div key={status} className="min-w-[300px] bg-content2/50 rounded-xl p-4 flex flex-col gap-4">
                <h3 className="font-semibold text-gray-300 flex justify-between">
                  {label}
                  <Chip size="sm" variant="flat">{cases.filter(c => c.status === status).length}</Chip>
                </h3>
                
                <div className="flex flex-col gap-3 overflow-y-auto min-h-0 custom-scrollbar">
                  {cases.filter(c => c.status === status).map(c => (
                    <Card key={c.id} isPressable onPress={() => navigate(`/cases/${c.id}`)} className="bg-content1/50 hover:bg-content1 transition-all border border-white/5 hover:border-primary/30">
                      <CardBody className="gap-2">
                        <div className="flex justify-between items-start">
                          <Chip size="sm" color={getSeverityColorUtil(c.severity)} variant="dot">{c.severity}</Chip>
                          <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-medium line-clamp-2">{c.title}</h4>
                        <div className="flex justify-between items-center mt-2">
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Icon.User className="w-3 h-3" />
                            {c.assigneeName || 'Unassigned'}
                          </div>
                          <Chip size="sm" variant="flat" className="text-[10px] h-5">{c.priority}</Chip>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Create New Case</ModalHeader>
              <ModalBody>
                <Input label="Title" placeholder="e.g. Ransomware Activity detected" value={formData.title} onValueChange={v => setFormData({...formData, title: v})} />
                <Textarea label="Description" placeholder="Details..." value={formData.description} onValueChange={v => setFormData({...formData, description: v})} />
                <Select label="Severity" defaultSelectedKeys={['medium']} onChange={(e) => setFormData({...formData, severity: e.target.value})}>
                  <SelectItem key="critical">Critical</SelectItem>
                  <SelectItem key="high">High</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="low">Low</SelectItem>
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={handleCreate}>Create</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
