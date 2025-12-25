// @ts-nocheck - react components with dynamic form
import { useState, useEffect } from 'react';
import { 
  Button, Card, CardBody, Input, Select, SelectItem, 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
  Chip, Tabs, Tab
} from "@heroui/react";
import { api } from '../../shared/api';
import { Icon } from '../../shared/ui';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

const CHART_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

interface WidgetConfig {
  metric: 'events' | 'alerts';
  aggregation: 'count' | 'unique';
  groupBy: 'severity' | 'source' | 'host' | 'user' | 'day';
  timeRange: '1d' | '7d' | '30d' | '90d';
}

interface CustomWidgetCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (widget: any) => void;
}

export default function CustomWidgetCreator({ isOpen, onClose, onSave }: CustomWidgetCreatorProps) {
  // Form state
  const [name, setName] = useState('My Widget');
  const [description, setDescription] = useState('');
  const [metric, setMetric] = useState<'events' | 'alerts'>('events');
  const [groupBy, setGroupBy] = useState<'severity' | 'source' | 'host' | 'user' | 'day'>('severity');
  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d' | '90d'>('7d');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'donut' | 'table'>('bar');
  
  // Preview state
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch preview when config changes
  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    }
  }, [isOpen, metric, groupBy, timeRange]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const config: WidgetConfig = {
        metric,
        aggregation: 'count',
        groupBy,
        timeRange
      };
      const res = await api.post('/widgets/query', config);
      setPreviewData(res.data.data || []);
    } catch (e) {
      console.error('Preview failed:', e);
      setPreviewData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post('/widgets', {
        name,
        description,
        config: { metric, aggregation: 'count', groupBy, timeRange },
        chartType
      });
      onSave?.(res.data.data);
      onClose();
    } catch (e) {
      console.error('Save failed:', e);
      alert('Failed to save widget');
    } finally {
      setSaving(false);
    }
  };

  const renderChart = () => {
    if (loading) {
      return (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      );
    }

    if (previewData.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center text-default-500">
          No data available
        </div>
      );
    }

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={previewData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={previewData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={previewData}
                cx="50%"
                cy="50%"
                innerRadius={chartType === 'donut' ? 40 : 0}
                outerRadius={70}
                dataKey="value"
                label={({ name }) => name}
              >
                {previewData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      
      case 'table':
        return (
          <div className="max-h-48 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-content2">
                <tr>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2 text-right font-mono">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="3xl">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-3">
              <Icon.Chart className="w-5 h-5 text-primary" />
              <span>Create Custom Widget</span>
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-6">
                {/* Left: Configuration */}
                <div className="space-y-4">
                  <Input
                    label="Widget Name"
                    value={name}
                    onValueChange={setName}
                    variant="bordered"
                  />
                  
                  <Input
                    label="Description"
                    value={description}
                    onValueChange={setDescription}
                    variant="bordered"
                  />
                  
                  <Select
                    label="Data Source"
                    selectedKeys={[metric]}
                    onChange={(e) => setMetric(e.target.value as any)}
                    variant="bordered"
                  >
                    <SelectItem key="events">Security Events</SelectItem>
                    <SelectItem key="alerts">Alerts</SelectItem>
                  </Select>
                  
                  <Select
                    label="Group By"
                    selectedKeys={[groupBy]}
                    onChange={(e) => setGroupBy(e.target.value as any)}
                    variant="bordered"
                  >
                    <SelectItem key="severity">Severity</SelectItem>
                    <SelectItem key="source">Source/Provider</SelectItem>
                    <SelectItem key="host">Host</SelectItem>
                    <SelectItem key="user">User</SelectItem>
                    <SelectItem key="day">Day</SelectItem>
                  </Select>
                  
                  <Select
                    label="Time Range"
                    selectedKeys={[timeRange]}
                    onChange={(e) => setTimeRange(e.target.value as any)}
                    variant="bordered"
                  >
                    <SelectItem key="1d">Last 24 Hours</SelectItem>
                    <SelectItem key="7d">Last 7 Days</SelectItem>
                    <SelectItem key="30d">Last 30 Days</SelectItem>
                    <SelectItem key="90d">Last 90 Days</SelectItem>
                  </Select>
                  
                  <div>
                    <label className="text-sm text-default-500 mb-2 block">Chart Type</label>
                    <div className="flex gap-2 flex-wrap">
                      {(['bar', 'line', 'pie', 'donut', 'table'] as const).map((type) => (
                        <Button
                          key={type}
                          size="sm"
                          variant={chartType === type ? 'solid' : 'flat'}
                          color={chartType === type ? 'primary' : 'default'}
                          onPress={() => setChartType(type)}
                          className="capitalize"
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Right: Preview */}
                <div>
                  <Card className="h-full bg-content1/50 border border-white/10">
                    <CardBody>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold">Preview</h3>
                        <Chip size="sm" variant="flat" color="secondary">
                          {previewData.length} items
                        </Chip>
                      </div>
                      {renderChart()}
                    </CardBody>
                  </Card>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Button 
                color="primary" 
                onPress={handleSave}
                isLoading={saving}
                startContent={<Icon.Add className="w-4 h-4" />}
              >
                Save Widget
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
