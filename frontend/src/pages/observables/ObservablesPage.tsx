import { useEffect, useState, useMemo } from 'react';
import { Button, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Select, SelectItem, Card, CardBody } from "@heroui/react";
import { Icon } from '../../shared/ui';
import { ObservablesAPI, Observable } from '../../shared/api/observables';
import { ObservableDetailModal } from '../../components/ObservableDetailModal';

const IOC_TYPE_COLORS: Record<string, string> = {
  ip: 'primary',
  domain: 'secondary',
  email: 'success',
  url: 'warning',
  hash: 'danger',
  file: 'default',
};

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

  // Modal State
  const [selectedObservable, setSelectedObservable] = useState<Observable | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchObservables = async () => {
    try {
      const data = await ObservablesAPI.list({
        type: typeFilter.length > 0 ? typeFilter : undefined,
        isMalicious: statusFilter === 'malicious' ? true : statusFilter === 'safe' ? false : undefined,
        search: searchQuery || undefined,
      });
      setObservables(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchObservables();
  }, []);

  useEffect(() => {
    fetchObservables();
  }, [typeFilter, statusFilter, searchQuery]);

  const filteredObservables = useMemo(() => {
    return observables;
  }, [observables]);

  const handleOpenDetail = (observable: Observable) => {
    setSelectedObservable(observable);
    setIsModalOpen(true);
  };

  const handleEnrich = async (id: string) => {
    // Call API to trigger enrichment (future implementation)
    console.log("Trigger enrichment for", id);
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
            <Chip size="sm" color={IOC_TYPE_COLORS[observable.type] as any} variant="flat" className="capitalize">
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
    <div className="p-6 h-full flex flex-col bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Observables / IOCs</h1>
          <p className="text-gray-400">{filteredObservables.length} indicators</p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { 
            label: 'Total IOCs', 
            count: observables.length, 
            color: 'default' 
          },
          { 
            label: 'Malicious', 
            count: observables.filter(o => o.isMalicious).length, 
            color: 'danger' 
          },
          { 
            label: 'Safe', 
            count: observables.filter(o => o.isMalicious === false).length, 
            color: 'success' 
          },
          { 
            label: 'Pending', 
            count: observables.filter(o => o.enrichedAt === null).length, 
            color: 'warning' 
          }
        ].map((item) => (
          <Card 
            key={item.label}
            className="bg-content1/50 border border-white/5 hover:border-white/10 transition-all"
          >
            <CardBody className="p-4 overflow-hidden">
              <p className="text-sm font-medium text-foreground/50 mb-2">
                {item.label}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-foreground">
                  {item.count.toLocaleString()}
                </span>
                {item.color !== 'default' && (
                   <Chip size="sm" color={item.color as any} variant="dot" classNames={{ base: "border-0" }}>
                     {((item.count / (observables.length || 1)) * 100).toFixed(0)}%
                   </Chip>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-content1 border border-white/5 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select
            label="Type"
            placeholder="All Types"
            size="sm"
            selectionMode="multiple"
            selectedKeys={typeFilter}
            onSelectionChange={(keys) => setTypeFilter(Array.from(keys) as string[])}
            classNames={{
              label: "text-xs text-gray-400",
              trigger: "bg-content2"
            }}
          >
            <SelectItem key="ip">IP Address</SelectItem>
            <SelectItem key="domain">Domain</SelectItem>
            <SelectItem key="email">Email</SelectItem>
            <SelectItem key="url">URL</SelectItem>
            <SelectItem key="hash">Hash</SelectItem>
          </Select>

          <Select
            label="Status"
            placeholder="All"
            size="sm"
            selectedKeys={statusFilter ? [statusFilter] : []}
            onChange={(e) => setStatusFilter(e.target.value)}
            classNames={{
              label: "text-xs text-gray-400",
              trigger: "bg-content2"
            }}
          >
            <SelectItem key="malicious">Malicious</SelectItem>
            <SelectItem key="safe">Safe</SelectItem>
            <SelectItem key="unknown">Unknown</SelectItem>
          </Select>

          <div className="md:col-span-2">
            <Input
              label="Search"
              placeholder="Search IOC value..."
              size="sm"
              value={searchQuery}
              onValueChange={setSearchQuery}
              startContent={<Icon.Search className="w-4 h-4 text-gray-400" />}
              classNames={{
                label: "text-xs text-gray-400",
                inputWrapper: "bg-content2"
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <Table 
        aria-label="Observables table"
        classNames={{
          wrapper: "bg-content1 shadow-none border border-white/5 rounded-lg",
          th: "bg-content2 text-xs font-bold text-foreground/60 uppercase tracking-wider border-b border-white/10",
          td: "py-3 text-foreground/90",
          tr: "hover:bg-content2/50 border-b border-white/5 last:border-0 transition-all",
        }}
      >
        <TableHeader>
          <TableColumn key="type">TYPE</TableColumn>
          <TableColumn key="value">VALUE</TableColumn>
          <TableColumn key="status">STATUS</TableColumn>
          <TableColumn key="sightings">SIGHTINGS</TableColumn>
          <TableColumn key="tags">TAGS</TableColumn>
          <TableColumn key="lastSeen">LAST SEEN</TableColumn>
          <TableColumn key="enriched">ENRICHMENT</TableColumn>
          <TableColumn key="actions">ACTIONS</TableColumn>
        </TableHeader>
        <TableBody items={filteredObservables} emptyContent="No observables found.">
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => <TableCell>{renderCell(item, columnKey as string)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ObservableDetailModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        observable={selectedObservable}
        onEnrich={handleEnrich}
      />
    </div>
  );
}
