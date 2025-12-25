import { useEffect, useState, useMemo } from 'react';
import { Card, CardBody, Button, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Input, Textarea, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Avatar } from "@heroui/react";
import { Icon } from '../../shared/ui';
import { CasesAPI, Case } from '../../shared/api';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { DonutCard } from '../../components/DonutCard';
import { FilterBar } from '../../components/FilterBar';
import { SEVERITY_COLORS, getSeverityColor, getSeverityDotSize } from '../../constants/severity';
import { eachDayOfInterval, format, addDays, subDays, differenceInDays } from 'date-fns';

const COLS = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
};

const ALL_COLS = {
  ...COLS,
  closed: 'Closed'
};

const STATUS_ICONS = {
  open: '⚪',
  investigating: '🔵',
  resolved: '✅',
  closed: '⭕'
};

const SLA_HOURS = {
  critical: 4,
  high: 24,
  medium: 48,
  low: 72,
  info: 168
};

// Helper to calculate time remaining
const getTimeRemaining = (createdAt: string, severity: string) => {
  const created = new Date(createdAt).getTime();
  const now = new Date().getTime();
  const slaHours = SLA_HOURS[severity.toLowerCase() as keyof typeof SLA_HOURS] || 48;
  const slaMs = slaHours * 60 * 60 * 1000;
  const deadline = created + slaMs;
  const remaining = deadline - now;
  
  const hoursLeft = Math.floor(remaining / (1000 * 60 * 60));
  const isOverdue = remaining < 0;
  
  return { hoursLeft, isOverdue, slaHours, percentUsed: ((now - created) / slaMs) * 100 };
};

type ViewMode = 'kanban' | 'table' | 'graph' | 'timeline';

export default function CaseBoardPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showClosed, setShowClosed] = useState(false);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 600 });
  
  // Update graph dimensions on resize
  useEffect(() => {
    const updateDim = () => {
        const container = document.getElementById('graph-container');
        if (container) {
            setGraphDimensions({ width: container.clientWidth, height: container.clientHeight || 500 });
        }
    };
    window.addEventListener('resize', updateDim);
    setTimeout(updateDim, 100); // Initial delay
    return () => window.removeEventListener('resize', updateDim);
  }, [viewMode]);

  // Construct Graph Data
  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    const nodeSet = new Set<string>();

    cases.forEach(c => {
        if (!nodeSet.has(c.id)) {
            nodes.push({ id: c.id, name: c.title, type: 'case', severity: c.severity, val: 20 });
            nodeSet.add(c.id);
        }

        // Assignee Node
        const assignee = c.assigneeName || 'Unassigned';
        if (!nodeSet.has(assignee)) {
            nodes.push({ id: assignee, name: assignee, type: 'user', val: 10 });
            nodeSet.add(assignee);
        }
        links.push({ source: c.id, target: assignee });

        // Source Node (if applicable, using Assignee logic for now but ideally would be Source IP etc)
        // Just linking to Assignee for now to show clusters of work
    });

    return { nodes, links };
  }, [cases]);
  
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
      case "sla":
        if (caseItem.status === 'resolved' || caseItem.status === 'closed') return <span className="text-gray-500">-</span>;
        const { hoursLeft, isOverdue } = getTimeRemaining(caseItem.createdAt, caseItem.severity);
        return (
            <Chip 
            size="sm" 
            variant="flat" 
            className={`h-6 ${isOverdue ? 'bg-danger/10 text-danger' : hoursLeft < 4 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}
            startContent={isOverdue ? <Icon.Alert className="w-3 h-3" /> : <Icon.Clock className="w-3 h-3" />}
            >
            {isOverdue ? `Overdue ${Math.abs(hoursLeft)}h` : `${hoursLeft}h left`}
            </Chip>
        );
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
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Case Management</h1>
          <p className="text-sm mt-1 text-foreground/60">{filteredCases.length} active cases in flight</p>
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
            <Button
              size="sm"
              variant={viewMode === 'graph' ? 'flat' : 'light'}
              onPress={() => setViewMode('graph')}
              startContent={<Icon.Chart className="w-4 h-4" />}
            >
              Graph
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'timeline' ? 'flat' : 'light'}
              onPress={() => setViewMode('timeline')}
              startContent={<Icon.Calendar className="w-4 h-4" />}
            >
              Timeline
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
            th: "bg-content2 text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] border-b border-white/10",
            td: "py-3 text-foreground/90",
            tr: "hover:bg-content2/50 border-b border-white/5 last:border-0 cursor-pointer transition-all",
          }}
          onRowAction={(key) => navigate(`/cases/${key}`)}
        >
          <TableHeader>
            <TableColumn key="severity">SEVERITY</TableColumn>
            <TableColumn key="title">TITLE</TableColumn>
            <TableColumn key="status">STATUS</TableColumn>
            <TableColumn key="sla">SLA</TableColumn>
            <TableColumn key="assignee">ASSIGNEE</TableColumn>
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
              <div key={status} className="min-w-[300px] bg-content2/50 rounded-xl p-4 flex flex-col gap-4 border border-white/5">
                <h3 className="font-semibold text-gray-300 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span>{STATUS_ICONS[status as keyof typeof COLS] || '•'}</span>
                    {label}
                  </div>
                  <Chip size="sm" variant="flat">{cases.filter(c => c.status === status).length}</Chip>
                </h3>
                
                <div className="flex flex-col gap-3 overflow-y-auto min-h-0 custom-scrollbar pr-1">
                  {cases.filter(c => c.status === status).length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-xl bg-content1/20">
                          <Icon.Briefcase className="w-8 h-8 mb-2 opacity-50" />
                          <p className="text-xs">No cases</p>
                      </div>
                  ) : (
                      cases.filter(c => c.status === status).map(c => {
                        const { hoursLeft, isOverdue } = getTimeRemaining(c.createdAt, c.severity);
                        return (
                          <Card 
                            key={c.id} 
                            isPressable 
                            onPress={() => navigate(`/cases/${c.id}`)} 
                            className="bg-content1/40 backdrop-blur-md hover:bg-content1/60 transition-all duration-300 border border-white/5 hover:border-primary/40 group shadow-sm hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1"
                          >
                            <CardBody className="gap-3 p-4">
                              <div className="flex justify-between items-start">
                                <Chip size="sm" color={getSeverityColorUtil(c.severity)} variant="dot" className="border-none pl-0 bg-transparent">{c.severity}</Chip>
                                {status !== 'resolved' && status !== 'closed' && (
                                  <Chip 
                                    size="sm" 
                                    variant="flat" 
                                    className={`h-5 text-[10px] border border-white/5 ${isOverdue ? 'bg-danger/20 text-danger-300' : hoursLeft < 4 ? 'bg-warning/20 text-warning-300' : 'bg-success/20 text-success-300'}`}
                                    startContent={isOverdue ? <Icon.Alert className="w-3 h-3" /> : <Icon.Clock className="w-3 h-3" />}
                                  >
                                    {isOverdue ? `Overdue ${Math.abs(hoursLeft)}h` : `${hoursLeft}h left`}
                                  </Chip>
                                )}
                              </div>
                              
                              <h3 className="font-semibold text-sm leading-tight text-foreground/90 group-hover:text-primary transition-colors line-clamp-2">
                                {c.title}
                              </h3>
                              
                              <div className="flex justify-between items-center pt-3 mt-1 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    <Avatar 
                                        showFallback 
                                        name={c.assigneeName ? c.assigneeName.toUpperCase() : undefined}
                                        src={undefined} // Placeholder for real avatar URL
                                        icon={!c.assigneeName && <Icon.User className="w-3 h-3" />}
                                        className="w-6 h-6 text-[10px]"
                                        classNames={{ base: c.assigneeName ? "bg-primary/20 text-primary" : "bg-default-100 text-default-500" }}
                                    />
                                    <span className="text-xs text-default-400 font-medium truncate max-w-[100px]">
                                        {c.assigneeName || 'Unassigned'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-default-400 font-mono tracking-tighter opacity-70">
                                    {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </CardBody>
                          </Card>
                        );
                      })
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Graph View */}
      {viewMode === 'graph' && (
        <Card className="flex-1 bg-content1/50 border border-white/5 overflow-hidden">
            <CardBody className="p-0 relative" id="graph-container">
                <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md p-3 rounded-lg border border-white/10">
                    <h3 className="text-sm font-semibold mb-2">Legend</h3>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
                            <span className="text-xs">Case (Medium)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                            <span className="text-xs">Case (Critical)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-xs">Analyst</span>
                        </div>
                    </div>
                </div>
                <ForceGraph2D
                    width={graphDimensions.width}
                    height={graphDimensions.height}
                    graphData={graphData}
                    nodeLabel="name"
                    nodeColor={(node: any) => {
                        if (node.type === 'user') return '#22C55E';
                        if (node.severity === 'critical') return '#EF4444';
                        if (node.severity === 'high') return '#F97316';
                        return '#3B82F6';
                    }}
                    nodeRelSize={6}
                    linkColor={() => 'rgba(255,255,255,0.2)'}
                    backgroundColor="rgba(0,0,0,0)"
                    onNodeClick={(node: any) => {
                        if (node.type === 'case') navigate(`/cases/${node.id}`);
                    }}
                    nodeCanvasObject={(node: any, ctx, globalScale) => {
                        const label = node.name;
                        const fontSize = 12/globalScale;
                        ctx.font = `${fontSize}px Sans-Serif`;
                        const textWidth = ctx.measureText(label).width;
                        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                        if (node.type === 'case') {
                             ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
                        } else {
                             ctx.beginPath();
                             ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
                             ctx.fill();
                        }

                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        
                        // Node color
                        if (node.type === 'user') ctx.fillStyle = '#22C55E';
                        else if (node.severity === 'critical') ctx.fillStyle = '#EF4444';
                        else if (node.severity === 'high') ctx.fillStyle = '#F97316';
                        else ctx.fillStyle = '#3B82F6';

                        if (node.type === 'case') {
                            ctx.fillRect(node.x - 6, node.y - 6, 12, 12);
                        } else {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
                            ctx.fill();
                        }
                        
                        // Text
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.fillText(label, node.x, node.y + 12);
                    }}
                />
            </CardBody>
        </Card>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <Card className="flex-1 bg-content1/50 border border-white/5 overflow-hidden">
            <CardBody className="p-4" id="timeline-container">
                <div className="flex flex-col h-full">
                     {/* Timeline Header */}
                     <div className="flex items-center mb-4 pb-4 border-b border-white/5 overflow-x-auto custom-scrollbar">
                         <div className="min-w-[200px] sticky left-0 bg-content1 z-10 p-2 font-semibold text-gray-400">Case</div>
                         {/* Dynamic Date Header */}
                         {(() => {
                             const dates = cases.map(c => new Date(c.createdAt));
                             const minDate = subDays(new Date(Math.min(...dates.map(d => d.getTime())) || Date.now()), 1);
                             const maxDate = addDays(new Date(), 2);
                             const days = eachDayOfInterval({ start: minDate, end: maxDate });
                             
                             return days.map(day => (
                                 <div key={day.toISOString()} className="min-w-[100px] text-center text-xs text-gray-500 border-l border-white/5">
                                     {format(day, 'MMM dd')}
                                 </div>
                             ));
                         })()}
                     </div>

                     {/* Timeline Rows */}
                     <div className="flex-1 overflow-y-auto custom-scrollbar">
                         {filteredCases.map(c => {
                             const dates = cases.map(cas => new Date(cas.createdAt));
                             const minDate = subDays(new Date(Math.min(...dates.map(d => d.getTime())) || Date.now()), 1);
                             const maxDate = addDays(new Date(), 2);
                             const totalDays = differenceInDays(maxDate, minDate) + 1;
                             
                             const start = new Date(c.createdAt);
                             // If not closed, assume 'now' for visualization or a default duration
                             // Ideally we use updated_at or closed_at if available
                             const end = c.status === 'closed' || c.status === 'resolved' ? new Date(start.getTime() + 1000 * 60 * 60 * 24) : new Date(); 
                             
                             const startOffsetDays = differenceInDays(start, minDate) + (start.getHours() / 24);
                             const durationDays = Math.max(differenceInDays(end, start), 0.2); // Minimum width
                             
                             const leftPercent = (startOffsetDays / totalDays) * 100;
                             const widthPercent = (durationDays / totalDays) * 100;

                             return (
                                 <div key={c.id} className="flex items-center hover:bg-white/5 transition-colors group mb-1 min-h-[40px]">
                                     <div className="min-w-[200px] max-w-[200px] sticky left-0 bg-content1 z-10 p-2 border-r border-white/5 truncate flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full bg-${getSeverityColorUtil(c.severity)} sm:bg-${getSeverityColor(c.severity).dot}`} style={{ backgroundColor: getSeverityColor(c.severity).dot }}></div>
                                          <span className="text-sm truncate cursor-pointer hover:text-primary" onClick={() => navigate(`/cases/${c.id}`)}>{c.title}</span>
                                     </div>
                                     <div className="flex-1 relative h-8 mx-2 bg-white/5 rounded-full overflow-hidden">
                                          {/* Grid Lines */}
                                          <div className="absolute inset-0 flex">
                                            {Array.from({ length: totalDays }).map((_, i) => (
                                                <div key={i} className="flex-1 border-l border-white/5 first:border-0"></div>
                                            ))}
                                          </div>
                                          
                                          {/* The Bar */}
                                          <div 
                                              className="absolute h-6 top-1 rounded-full cursor-pointer hover:brightness-110 transition-all flex items-center px-2 shadow-sm"
                                              style={{ 
                                                  left: `${leftPercent}%`, 
                                                  width: `${widthPercent}%`,
                                                  backgroundColor: getSeverityColor(c.severity).dot,
                                                  opacity: 0.8
                                              }}
                                              onClick={() => navigate(`/cases/${c.id}`)}
                                          >
                                              <span className="text-[10px] text-white font-medium truncate drop-shadow-md">{c.status}</span>
                                          </div>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                </div>
            </CardBody>
        </Card>
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
