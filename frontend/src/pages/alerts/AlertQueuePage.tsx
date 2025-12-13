import { useEffect, useState, useMemo } from 'react';
import { Button, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Textarea, Select, SelectItem, Checkbox } from "@heroui/react";
import { Icon } from '../../shared/ui';
import { AlertsAPI, Alert } from '../../shared/api/alerts';
import { useNavigate } from 'react-router-dom';
import { DonutCard } from '../../components/DonutCard';
import { FilterBar } from '../../components/FilterBar';
import { SEVERITY_COLORS, getSeverityColor, getSeverityDotSize } from '../../constants/severity';

export default function AlertQueuePage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  
  // Filter states
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const { isOpen: isDismissOpen, onOpen: onDismissOpen, onOpenChange: onDismissChange } = useDisclosure();
  const { isOpen: isPromoteOpen, onOpen: onPromoteOpen, onOpenChange: onPromoteChange } = useDisclosure();
  const [dismissReason, setDismissReason] = useState('');
  const [caseData, setCaseData] = useState({ title: '', description: '', priority: 'normal' });
  
  const navigate = useNavigate();

  const fetchAlerts = async () => {
    try {
      const data = await AlertsAPI.list();
      setAlerts(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (severityFilter.length > 0 && !severityFilter.includes(a.severity)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(a.status)) return false;
      if (sourceFilter && a.source !== sourceFilter) return false;
      if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [alerts, severityFilter, statusFilter, sourceFilter, searchQuery]);

  // Aggregate data for donut charts
  const severityData = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    filteredAlerts.forEach(a => {
      const sev = a.severity.toLowerCase();
      if (sev in counts) counts[sev as keyof typeof counts]++;
    });
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({
        name: SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS].label,
        value,
        color: SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS].dot
      }));
  }, [filteredAlerts]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAlerts.forEach(a => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    const colors = {
      new: '#60A5FA', reviewing: '#FBBF24', dismissed: '#9CA3AF', promoted: '#34D399'
    };
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[name as keyof typeof colors] || '#9CA3AF'
    }));
  }, [filteredAlerts]);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAlerts.forEach(a => {
      counts[a.source] = (counts[a.source] || 0) + 1;
    });
    const colors = ['#60A5FA', '#34D399', '#FBBF24', '#F97316'];
    return Object.entries(counts).map(([name, value], idx) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[idx % colors.length]
    }));
  }, [filteredAlerts]);

  const handleDismiss = async () => {
    try {
      if (selectedAlerts.size > 0) {
        await AlertsAPI.bulkDismiss(Array.from(selectedAlerts), dismissReason || 'Bulk dismissed');
      }
      setSelectedAlerts(new Set());
      setDismissReason('');
      onDismissChange();
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePromote = async () => {
    try {
      if (selectedAlerts.size > 0) {
        await AlertsAPI.bulkPromote(Array.from(selectedAlerts), caseData);
      }
      setSelectedAlerts(new Set());
      setCaseData({ title: '', description: '', priority: 'normal' });
      onPromoteChange();
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedAlerts(new Set(filteredAlerts.map(a => a.id)));
    } else {
      setSelectedAlerts(new Set());
    }
  };

  const handleRowSelection = (id: string, isSelected: boolean) => {
    const newSet = new Set(selectedAlerts);
    if (isSelected) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedAlerts(newSet);
  };

  const getSeverityColorUtil = (sev: string) => {
    switch(sev) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      default: return 'default';
    }
  };

  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    alerts.forEach(a => sources.add(a.source));
    return Array.from(sources).sort();
  }, [alerts]);

  const renderCell = (alert: Alert, columnKey: string) => {
    switch (columnKey) {
      case "select":
        return (
          <Checkbox
            isSelected={selectedAlerts.has(alert.id)}
            onValueChange={(isSelected) => handleRowSelection(alert.id, isSelected)}
          />
        );
      case "severity":
        const severityColor = getSeverityColor(alert.severity);
        return (
          <div className="flex items-center gap-2">
            <div 
              className="rounded-full" 
              style={{ 
                width: getSeverityDotSize(alert.severity), 
                height: getSeverityDotSize(alert.severity),
                backgroundColor: severityColor.dot
              }}
            />
            <Chip size="sm" color={getSeverityColorUtil(alert.severity)} variant="dot">{alert.severity}</Chip>
          </div>
        );
      case "title":
        return <span className="font-medium">{alert.title}</span>;
      case "source":
        return <Chip size="sm" variant="flat" className="capitalize">{alert.source}</Chip>;
      case "status":
        const statusIcons = {
          new: '🆕',
          reviewing: '👁️',
          dismissed: '✖️',
          promoted: '✅'
        };
        return (
          <div className="flex items-center gap-2">
            <span>{statusIcons[alert.status as keyof typeof statusIcons] || '⚪'}</span>
            <Chip size="sm" variant="flat" className="capitalize">{alert.status}</Chip>
          </div>
        );
      case "created":
        const date = new Date(alert.createdAt);
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
          <div className="flex gap-1">
            <Button size="sm" variant="light" onPress={() => navigate(`/alerts/${alert.id}`)} isIconOnly>
              <Icon.Eye className="w-4 h-4" />
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Alert Queue</h1>
          <p className="text-gray-400">{filteredAlerts.length} alerts · {selectedAlerts.size} selected</p>
        </div>
        <div className="flex gap-2">
          {selectedAlerts.size > 0 && (
            <>
              <Button color="danger" variant="flat" onPress={onDismissOpen}>
                Dismiss ({selectedAlerts.size})
              </Button>
              <Button color="primary" onPress={onPromoteOpen}>
                Create Case ({selectedAlerts.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <DonutCard title="Severity" data={severityData} />
        <DonutCard title="Status" data={statusData} />
        <DonutCard title="Source" data={sourceData} />
      </div>

      {/* Filter Bar */}
      <FilterBar
        savedFilter=""
        onSavedFilterChange={() => {}}
        severityFilter={severityFilter}
        onSeverityFilterChange={setSeverityFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        assigneeFilter={sourceFilter}
        onAssigneeFilterChange={setSourceFilter}
        assignees={uniqueSources}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSubmit={() => {}}
        onClearFilters={() => {
          setSeverityFilter([]);
          setStatusFilter([]);
          setSourceFilter('');
          setSearchQuery('');
        }}
      />

      {/* Table */}
      <Table 
        aria-label="Alerts table"
        classNames={{
          wrapper: "bg-content1 shadow-none border border-white/5 rounded-lg",
          th: "bg-content2 text-xs font-bold text-foreground/60 uppercase tracking-wider border-b border-white/10",
          td: "py-3 text-foreground/90",
          tr: "hover:bg-content2/50 border-b border-white/5 last:border-0 cursor-pointer transition-all",
        }}
      >
        <TableHeader>
          <TableColumn key="select">
            <Checkbox
              isSelected={selectedAlerts.size === filteredAlerts.length && filteredAlerts.length > 0}
              onValueChange={handleSelectAll}
            />
          </TableColumn>
          <TableColumn key="severity">SEVERITY</TableColumn>
          <TableColumn key="title">TITLE</TableColumn>
          <TableColumn key="source">SOURCE</TableColumn>
          <TableColumn key="status">STATUS</TableColumn>
          <TableColumn key="created">CREATED</TableColumn>
          <TableColumn key="actions">ACTIONS</TableColumn>
        </TableHeader>
        <TableBody items={filteredAlerts} emptyContent="No alerts found.">
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => <TableCell>{renderCell(item, columnKey as string)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Dismiss Modal */}
      <Modal isOpen={isDismissOpen} onOpenChange={onDismissChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Dismiss Alerts ({selectedAlerts.size})</ModalHeader>
              <ModalBody>
                <Textarea
                  label="Reason (optional)"
                  placeholder="e.g., False positive, Duplicate, etc."
                  value={dismissReason}
                  onValueChange={setDismissReason}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color="danger" onPress={handleDismiss}>Dismiss</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Promote Modal */}
      <Modal isOpen={isPromoteOpen} onOpenChange={onPromoteChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Create Case from Alerts ({selectedAlerts.size})</ModalHeader>
              <ModalBody>
                <input
                  className="w-full px-3 py-2 bg-content2 rounded-lg border border-white/10 text-foreground"
                  placeholder="Case Title"
                  value={caseData.title}
                  onChange={e => setCaseData({...caseData, title: e.target.value})}
                />
                <Textarea
                  label="Description"
                  placeholder="Describe the incident..."
                  value={caseData.description}
                  onValueChange={v => setCaseData({...caseData, description: v})}
                />
                <Select
                  label="Priority"
                  selectedKeys={[caseData.priority]}
                  onChange={(e) => setCaseData({...caseData, priority: e.target.value})}
                >
                  <SelectItem key="urgent">Urgent</SelectItem>
                  <SelectItem key="high">High</SelectItem>
                  <SelectItem key="normal">Normal</SelectItem>
                  <SelectItem key="low">Low</SelectItem>
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color="primary" onPress={handlePromote}>Create Case</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
