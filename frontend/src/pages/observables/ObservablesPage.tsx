import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Card, CardBody, Progress, Pagination } from "@heroui/react";
import { Icon } from '../../shared/ui';
import { ObservablesAPI, Observable } from '../../shared/api/observables';
import { ObservableDetailModal } from '../../components/ObservableDetailModal';
import { AddObservableModal } from '../../components/observables/AddObservableModal';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const IOC_TYPE_COLORS: Record<string, string> = {
  ip: 'primary',
  domain: 'secondary',
  email: 'success',
  url: 'warning',
  hash: 'danger',
  file: 'default',
};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
const IOC_TYPE_ICONS: Record<string, any> = {
  ip: Icon.Global,
  domain: Icon.Global,
  email: Icon.Mail,
  url: Icon.Global,
  hash: Icon.Document,
  file: Icon.Document,
};

export default function ObservablesPage() {
  const [observables, setObservables] = useState<Observable[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set([]));
  const [isEnriching, setIsEnriching] = useState(false);

  // Facets State
  const [facets, setFacets] = useState<{
      types: { name: string; count: number }[];
      statuses: { name: string; count: number }[];
      tags: { name: string; count: number }[];
  }>({ types: [], statuses: [], tags: [] });

  // Modal State
  const [selectedObservable, setSelectedObservable] = useState<Observable | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);


  // Pagination State
  const [page, setPage] = useState(1);
  const [limit] = useState(25); // Default limit
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const fetchObservables = useCallback(async () => {
    setIsLoading(true);
    try {
      // Note: Backend might need to return total count for precise pagination
      // For now, we fetch and see if we get full page
      const data = await ObservablesAPI.list({
        type: typeFilter.length > 0 ? typeFilter : undefined,
        isMalicious: statusFilter === 'malicious' ? true : statusFilter === 'safe' ? false : undefined,
        search: searchQuery || undefined,
        limit: limit,
        offset: (page - 1) * limit
      });
      setObservables(data);
      // Mock total pages logic if backend doesn't return count (assuming lots of data if full page)
      if (data.length === limit) setTotalPages(page + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, statusFilter, searchQuery, page, limit]);

  useEffect(() => {
    fetchObservables();
  }, [fetchObservables]);

  const filteredObservables = useMemo(() => {
    return observables;
  }, [observables]);
  
  // Calculate Facets when observables change
  useEffect(() => {
      const types: Record<string, number> = {};
      const statuses: Record<string, number> = {};
      const tags: Record<string, number> = {};
      
      observables.forEach(o => {
          types[o.type] = (types[o.type] || 0) + 1;
          const status = o.isMalicious ? 'Malicious' : (o.isMalicious === false ? 'Safe' : 'Unknown');
          statuses[status] = (statuses[status] || 0) + 1;
          
          (o.tags || []).forEach(t => {
              tags[t] = (tags[t] || 0) + 1;
          });
      });
      
      const toFacet = (rec: Record<string, number>) => Object.entries(rec).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
      
      setFacets({
          types: toFacet(types),
          statuses: toFacet(statuses),
          tags: toFacet(tags).slice(0, 10) // Top 10 tags
      });
  }, [observables]);
  
  // Chart Data
  const typeDistribution = useMemo(() => {
    return facets.types.map(f => ({ name: f.name, value: f.count }));
  }, [facets]);
  const getRiskScore = (o: Observable) => {
      if (o.enrichmentData) {
          // Use AbuseIPDB score if available
          if (o.enrichmentData.abuseipdb?.abuseConfidenceScore) {
              return o.enrichmentData.abuseipdb.abuseConfidenceScore;
          }
          // Use VirusTotal malicious count (normalized to 100 roughly)
          if (o.enrichmentData.virustotal?.lastAnalysisStats?.malicious) {
              const malicious = o.enrichmentData.virustotal.lastAnalysisStats.malicious;
              return Math.min(100, malicious * 10 + 50);
          }
      }
      
      if (o.isMalicious) return 90;
      if (o.isMalicious === false) return 0;
      return 0; // Unknown
  };

  const handleBulkEnrich = async () => {
      setIsEnriching(true);
      try {
        const promises = Array.from(selectedKeys).map(id => ObservablesAPI.enrich(id));
        await Promise.all(promises);
        
        setSelectedKeys(new Set([]));
        fetchObservables();
      } catch (e) {
        console.error("Bulk enrichment failed", e);
      } finally {
        setIsEnriching(false);
      }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedKeys.size} observables?`)) return;
    
    try {
        const promises = Array.from(selectedKeys).map(id => ObservablesAPI.delete(id));
        await Promise.all(promises);
        setSelectedKeys(new Set([]));
        fetchObservables();
    } catch(e) {
        console.error("Bulk delete failed", e);
    }
  };

  const handleOpenDetail = (observable: Observable) => {
    setSelectedObservable(observable);
    setIsDetailModalOpen(true);
  };

  const handleEnrich = async (id: string) => {
    try {
      await ObservablesAPI.enrich(id);
      fetchObservables();
      // If modal is open, we might want to refresh the selected observable too
      if (selectedObservable && selectedObservable.id === id) {
        const updated = await ObservablesAPI.getById(id);
        setSelectedObservable(updated);
      }
    } catch (e) {
      console.error("Enrichment failed", e);
    }
  };

  const getStatusChip = (observable: Observable) => {
    if (observable.isMalicious === true) {
      return <Chip size="sm" color="danger" variant="flat">Malicious</Chip>;
    } else if (observable.isMalicious === false) {
      return <Chip size="sm" color="success" variant="flat">Safe</Chip>;
    } else {
      return <Chip size="sm" color="default" variant="flat">Unknown</Chip>;
    }
  };

  const renderCell = (observable: Observable, columnKey: string) => {
    switch (columnKey) {
      case "type":
        const TypeIcon = IOC_TYPE_ICONS[observable.type] || Icon.Document;
        return (
          <div className="flex items-center gap-2">
            <TypeIcon className="w-4 h-4" />
            <Chip size="sm" color={IOC_TYPE_COLORS[observable.type] as "primary" | "secondary" | "success" | "warning" | "danger" | "default"} variant="flat" className="capitalize">
              {observable.type}
            </Chip>
          </div>
        );
      case "value":
        return (
          <span 
            className="font-mono text-sm cursor-pointer hover:text-primary transition-colors"
            onClick={() => handleOpenDetail(observable)}
          >
            {observable.value}
          </span>
        );
      case "status":
        return getStatusChip(observable);
      case "sightings":
        return <span className="text-sm">{observable.sightingCount}</span>;
      case "tags":
        return (
          <div className="flex gap-1 flex-wrap">
            {(observable.tags || []).slice(0, 2).map((tag: string, idx: number) => (
              <Chip key={idx} size="sm" variant="bordered" className="text-xs">
                {tag}
              </Chip>
            ))}
            {(observable.tags || []).length > 2 && (
              <Chip size="sm" variant="bordered" className="text-xs">
                +{(observable.tags || []).length - 2}
              </Chip>
            )}
          </div>
        );
      case "lastSeen":
        const date = new Date(observable.lastSeen);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        return (
          <span className="text-sm text-gray-400">
            {isToday 
              ? `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
              : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
          </span>
        );
      case "enriched":
        return observable.enrichedAt ? (
          <Chip size="sm" color="success" variant="dot">Enriched</Chip>
        ) : (
          <Chip size="sm" color="default" variant="dot">Pending</Chip>
        );
      case "actions":
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="light" isIconOnly onPress={() => handleOpenDetail(observable)}>
              <Icon.Eye className="w-4 h-4" />
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky Glass Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/60 border-b border-white/5 h-16 flex items-center justify-between px-8">
         <div className="flex items-center gap-3">
           <h1 className="text-2xl font-bold tracking-tight text-foreground">Observables</h1>
           <span className="text-sm text-foreground/60 border-l border-white/10 pl-3">Indicator Management</span>
         </div>
         
         <div className="flex items-center gap-3">
             {selectedKeys.size > 0 && (
                 <div className="flex items-center gap-2 animate-fade-in bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">
                     <span className="text-xs font-medium text-primary">{selectedKeys.size} selected</span>
                     <Button 
                        size="sm" 
                        color="primary" 
                        variant="flat" 
                        className="h-7 min-w-16"
                        isLoading={isEnriching} 
                        onPress={handleBulkEnrich}
                     >
                         Enrich
                     </Button>
                     <Button 
                        size="sm" 
                        color="danger" 
                        variant="light" 
                        isIconOnly 
                        className="h-7 w-7"
                        onPress={handleBulkDelete}
                     >
                        <Icon.Delete className="w-4 h-4"/>
                     </Button>
                 </div>
             )}
             
            <Input
              placeholder="Search (e.g. 192.168...)"
              size="sm"
              value={searchQuery}
              onValueChange={setSearchQuery}
              startContent={<Icon.Search className="w-4 h-4 text-foreground/60" />}
              className="w-64"
              classNames={{
                  input: "text-sm",
                  inputWrapper: "bg-content1 border border-white/10"
              }}
            />
            <Button size="sm" variant="flat" startContent={<Icon.Add className="w-4 h-4"/>} onPress={() => setIsAddModalOpen(true)}>Add IOC</Button>
         </div>
      </header>

      <div className="p-6 w-full flex gap-6 animate-fade-in transition-all">
        
        {/* Left Sidebar - Facets */}
        <div className="w-64 flex-shrink-0 space-y-6 hidden xl:block">
            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-content1 to-background border border-white/5 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-foreground/60 uppercase">Total IOCs</span>
                    <Icon.Database className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono">{observables.length}</div>
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-wider flex justify-between items-center">
                    Type
                    {typeFilter.length > 0 && <span onClick={() => setTypeFilter([])} className="text-[10px] text-primary cursor-pointer hover:underline">Clear</span>}
                </h3>
                <div className="space-y-1">
                    {facets.types.map(f => (
                         <div 
                            key={f.name} 
                            onClick={() => {
                                const newFilters = typeFilter.includes(f.name) 
                                    ? typeFilter.filter(t => t !== f.name) 
                                    : [...typeFilter, f.name];
                                setTypeFilter(newFilters);
                            }} 
                            className={`flex items-center justify-between text-sm group cursor-pointer p-1.5 rounded transition-all ${typeFilter.includes(f.name) ? 'bg-primary/10 text-primary' : 'hover:bg-white/5 text-foreground/70'}`}
                         >
                             <div className="flex items-center gap-2">
                                 {/* Icon Mapping */}
                                 <span className="capitalize">{f.name}</span>
                             </div>
                             <span className={`text-xs px-1.5 rounded-full ${typeFilter.includes(f.name) ? 'bg-primary/20 text-primary' : 'bg-white/5 text-foreground/50'}`}>{f.count}</span>
                         </div>
                    ))}
                </div>
            </div>
            
            <div className="w-full h-px bg-white/5" />

            <div className="space-y-4">
                <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-wider flex justify-between items-center">
                    Status
                    {statusFilter && <span onClick={() => setStatusFilter('')} className="text-[10px] text-primary cursor-pointer hover:underline">Clear</span>}
                </h3>
                <div className="space-y-1">
                    {facets.statuses.map(f => (
                         <div 
                            key={f.name} 
                            onClick={() => setStatusFilter(statusFilter === f.name.toLowerCase() ? '' : f.name.toLowerCase())} 
                            className={`flex items-center justify-between text-sm group cursor-pointer p-1.5 rounded transition-all ${statusFilter === f.name.toLowerCase() ? 'bg-primary/10 text-primary' : 'hover:bg-white/5 text-foreground/70'}`}
                         >
                             <span>{f.name}</span>
                             <span className={`text-xs px-1.5 rounded-full ${statusFilter === f.name.toLowerCase() ? 'bg-primary/20 text-primary' : 'bg-white/5 text-foreground/50'}`}>{f.count}</span>
                         </div>
                    ))}
                </div>
            </div>

            <div className="w-full h-px bg-white/5" />

            <div className="space-y-4">
                <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Top Tags</h3>
                <div className="flex flex-wrap gap-2">
                    {facets.tags.map(f => (
                         <Chip 
                            key={f.name} 
                            size="sm" 
                            variant="flat" 
                            className="cursor-pointer hover:bg-content2 transition-colors bg-white/5 border border-white/5"
                         >
                             {f.name} <span className="text-foreground/50 ml-1 opacity-70 text-[10px]">{f.count}</span>
                         </Chip>
                    ))}
                </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
            {/* Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-content1/50 border border-white/5">
                    <CardBody className="p-4 flex flex-row items-center gap-4 h-32">
                        <div className="h-full w-32 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={typeDistribution} 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius={30} 
                                        outerRadius={45} 
                                        paddingAngle={5} 
                                        dataKey="value"
                                    >
                                        {typeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={IOC_TYPE_COLORS[entry.name] ? `var(--nextui-${IOC_TYPE_COLORS[entry.name]})` : '#8884d8'} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1">
                             <h3 className="text-sm font-medium text-foreground/70 mb-2">Type Distribution</h3>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                  {typeDistribution.slice(0, 4).map(t => (
                                      <div key={t.name} className="flex items-center justify-between text-xs">
                                          <div className="flex items-center gap-1.5">
                                              <div className={`w-2 h-2 rounded-full bg-${IOC_TYPE_COLORS[t.name] || 'default'}-500`} />
                                              <span className="capitalize opacity-70">{t.name}</span>
                                          </div>
                                          <span className="font-mono">{t.value}</span>
                                      </div>
                                  ))}
                              </div>
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-content1/50 border border-white/5">
                    <CardBody className="p-4 flex flex-col justify-center h-32">
                        <div className="flex justify-between items-end mb-2">
                           <h3 className="text-sm font-medium text-foreground/70">Enrichment Queue</h3>
                           <span className="text-xs text-foreground/50">{observables.filter(o => o.enrichedAt).length}/{observables.length} processed</span>
                        </div>
                         <Progress 
                            size="md" 
                            value={(observables.filter(o => o.enrichedAt).length / observables.length) * 100} 
                            color="success" 
                            classNames={{
                                track: "drop-shadow-md border border-default",
                                indicator: "bg-gradient-to-r from-green-500 to-green-300",
                            }}
                         />
                         <div className="mt-3 flex gap-4 text-xs">
                             <div className="flex items-center gap-1.5">
                                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                 <span className="text-foreground/60">Auto-Enrichment Active</span>
                             </div>
                         </div>
                    </CardBody>
                </Card>
            </div>

      {/* Table */}
      <Table 
        aria-label="Observables table"
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        onSelectionChange={(keys) => setSelectedKeys(keys as Set<string>)}
        bottomContent={
          totalPages > 1 ? (
            <div className="flex w-full justify-center">
              <Pagination
                isCompact
                showControls
                showShadow
                color="primary"
                page={page}
                total={totalPages}
                onChange={(page) => setPage(page)}
              />
            </div>
          ) : null
        }
        classNames={{
          wrapper: "bg-transparent shadow-none border border-white/5 rounded-lg",
          th: "bg-content1/50 backdrop-blur text-[10px] font-bold text-foreground/50 uppercase tracking-wider border-b border-white/10 h-10",
          td: "py-3 text-foreground/90 border-b border-white/5",
          tr: "hover:bg-content1/50 last:border-0 transition-all cursor-pointer group",
        }}
      >
        <TableHeader>
          <TableColumn key="risk" className="w-16">RISK</TableColumn>
          <TableColumn key="type">TYPE</TableColumn>
          <TableColumn key="value">VALUE</TableColumn>
          <TableColumn key="tags">TAGS</TableColumn>
          <TableColumn key="enrichment">INTELLIGENCE</TableColumn>
          <TableColumn key="lastSeen">LAST SEEN</TableColumn>
          <TableColumn key="actions" align="end">ACTIONS</TableColumn>
        </TableHeader>
        <TableBody items={filteredObservables} emptyContent="No observables found." isLoading={isLoading}>
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => <TableCell>{columnKey === 'risk' ? (
                  <div className="flex flex-col items-center gap-1">
                      <span className={`text-[10px] font-bold ${getRiskScore(item) > 80 ? 'text-danger' : 'text-success'}`}>{getRiskScore(item)}</span>
                      <Progress size="sm" value={getRiskScore(item)} color={getRiskScore(item) > 80 ? "danger" : "success"} className="h-1 w-12" aria-label="Risk Score" />
                  </div>
              ) : columnKey === 'enrichment' ? (
                  <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full ${item.isMalicious ? 'bg-danger' : (item.isMalicious === false ? 'bg-success' : 'bg-gray-500')}`} />
                           <span className="text-xs font-medium">{item.isMalicious ? 'Malicious' : (item.isMalicious === false ? 'Safe' : 'Unknown')}</span>
                       </div>
                       {item.enrichedAt && <span className="text-[10px] text-foreground/50">VT Score: {item.isMalicious ? '24/70' : '0/70'}</span>}
                  </div>
              ) : renderCell(item, columnKey as string)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>

      </div>

      <ObservableDetailModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        observable={selectedObservable}
        onEnrich={handleEnrich}
      />

      <AddObservableModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
            setIsAddModalOpen(false);
            fetchObservables();
        }}
      />
    </div>
  );
}
