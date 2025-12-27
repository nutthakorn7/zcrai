// @ts-nocheck - react-grid-layout types are incomplete
import { useState, useEffect, useCallback } from 'react';
// @ts-ignore - react-grid-layout types are incomplete
import GridLayout from 'react-grid-layout';
import { Button, Card, CardBody, Modal, ModalContent, ModalHeader, ModalBody, useDisclosure, Chip } from "@heroui/react";
import { api } from '../../shared/api';
import { Icon } from '../../shared/ui';
import { WidgetRenderer } from './widgets';
import CustomWidgetCreator from './CustomWidgetCreator';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Widget definitions
const WIDGET_LIBRARY = [
  { id: 'stats', name: 'Overview Stats', description: 'Summary cards with total counts', defaultW: 12, defaultH: 4 },
  { id: 'timeline', name: 'Timeline Chart', description: 'Events over time', defaultW: 8, defaultH: 6 },
  { id: 'severity-pie', name: 'Severity Breakdown', description: 'Alerts by severity', defaultW: 4, defaultH: 6 },
  { id: 'alerts-feed', name: 'Recent Alerts', description: 'Live alert feed', defaultW: 6, defaultH: 8 },
  { id: 'top-hosts', name: 'Top Hosts', description: 'Most active hosts', defaultW: 6, defaultH: 6 },
  { id: 'sources-donut', name: 'Sources Donut', description: 'Events by source', defaultW: 4, defaultH: 6 },
  { id: 'ai-workforce', name: 'AI Workforce Value', description: 'ROI & Efficiency Stats', defaultW: 8, defaultH: 5 },
];

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
}

interface DashboardBuilderProps {
  onClose?: () => void;
  onSave?: (layout: LayoutItem[]) => void;
}

export default function DashboardBuilder({ onClose, onSave }: DashboardBuilderProps) {
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  // Load saved layout
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const res = await api.get('/dashboard/layout');
        if (res.data?.layout) {
          setLayout(res.data.layout);
        }
      } catch (e) {
        console.error('Failed to load layout:', e);
        // Use default
        setLayout([
          { i: 'stats-1', x: 0, y: 0, w: 12, h: 4, type: 'stats' },
          { i: 'timeline-1', x: 0, y: 4, w: 8, h: 6, type: 'timeline' },
          { i: 'severity-1', x: 8, y: 4, w: 4, h: 6, type: 'severity-pie' },
        ]);
      }
    };
    loadLayout();
  }, []);

  const handleLayoutChange = useCallback((newLayout: any[]) => {
    setLayout(prev => 
      prev.map(item => {
        const updated = newLayout.find((l: any) => l.i === item.i);
        if (updated) {
          return { ...item, x: updated.x, y: updated.y, w: updated.w, h: updated.h };
        }
        return item;
      })
    );
  }, []);

  const addWidget = (widgetType: string) => {
    const widget = WIDGET_LIBRARY.find(w => w.id === widgetType);
    if (!widget) return;
    
    const newId = `${widgetType}-${Date.now()}`;
    const newItem: LayoutItem = {
      i: newId,
      x: 0,
      y: Infinity, // Place at bottom
      w: widget.defaultW,
      h: widget.defaultH,
      type: widgetType,
    };
    setLayout(prev => [...prev, newItem]);
    setIsWidgetOpen(false); // Close modal after adding
  };

  const removeWidget = (id: string) => {
    setLayout(prev => prev.filter(item => item.i !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/dashboard/layout', { layout });
      onSave?.(layout);
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to save layout:', e);
      alert('Failed to save layout');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset to default layout? This cannot be undone.')) return;
    try {
      const res = await api.delete('/dashboard/layout');
      if (res.data?.layout) {
        setLayout(res.data.layout);
      }
    } catch (e) {
      console.error('Failed to reset:', e);
    }
  };

  const getWidgetName = (type: string) => {
    return WIDGET_LIBRARY.find(w => w.id === type)?.name || type;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-content1/50 rounded-xl border border-white/5">
        <div className="flex items-center gap-3">
          <Icon.Dashboard className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Dashboard Builder</h2>
          <Chip size="sm" variant="flat" color={isEditing ? 'warning' : 'default'}>
            {isEditing ? 'Editing' : 'View Mode'}
          </Chip>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button size="sm" variant="flat" onPress={() => setIsWidgetOpen(true)} startContent={<Icon.Add className="w-4 h-4" />}>
                Add Widget
              </Button>
              <Button size="sm" variant="ghost" color="secondary" onPress={() => setIsCustomOpen(true)} startContent={<Icon.Chart className="w-4 h-4" />}>
                Create Custom
              </Button>
              <Button size="sm" variant="flat" color="danger" onPress={handleReset}>
                Reset
              </Button>
              <Button size="sm" variant="flat" onPress={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" color="primary" isLoading={isSaving} onPress={handleSave}>
                Save Layout
              </Button>
            </>
          ) : (
            <Button size="sm" color="primary" variant="flat" onPress={() => setIsEditing(true)} startContent={<Icon.Edit className="w-4 h-4" />}>
              Edit Layout
            </Button>
          )}
          {onClose && (
            <Button size="sm" variant="flat" isIconOnly onPress={onClose}>
              <Icon.Close className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Grid Layout */}
      <div className={`rounded-xl border ${isEditing ? 'border-primary/30 bg-primary/5' : 'border-white/5'} p-4 transition-all`}>
        {/* @ts-ignore - react-grid-layout types are incomplete */}
        <GridLayout
          className="layout"
          layout={layout as any}
          cols={12}
          rowHeight={40}
          width={1200}
          isDraggable={isEditing}
          isResizable={isEditing}
          onLayoutChange={handleLayoutChange as any}
          draggableHandle=".drag-handle"
        >
          {layout.map(item => (
            <div key={item.i} className="relative">
              <Card className="w-full h-full bg-content1/80 border border-white/10">
                <CardBody className="p-4">
                  {isEditing && (
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                      <Button size="sm" isIconOnly variant="flat" className="drag-handle cursor-move">
                        <Icon.Refresh className="w-4 h-4" />
                      </Button>
                      <Button size="sm" isIconOnly variant="flat" color="danger" onPress={() => removeWidget(item.i)}>
                        <Icon.Delete className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {!isEditing && (
                    <div className="flex items-center gap-2 mb-2">
                      <Chip size="sm" variant="flat" color="secondary">{getWidgetName(item.type)}</Chip>
                    </div>
                  )}
                  {/* Render actual widget content */}
                  <div className="h-[calc(100%-3rem)] overflow-hidden">
                    <WidgetRenderer type={item.type} />
                  </div>
                </CardBody>
              </Card>
            </div>
          ))}
        </GridLayout>
      </div>

      {/* Widget Library Modal */}
      <Modal isOpen={isWidgetOpen} onClose={() => setIsWidgetOpen(false)} size="2xl">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                <h3 className="text-lg font-bold">Widget Library</h3>
              </ModalHeader>
              <ModalBody className="pb-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {WIDGET_LIBRARY.map(widget => (
                    <button
                      key={widget.id}
                      onClick={() => addWidget(widget.id)}
                      className="p-4 rounded-xl border border-white/10 bg-content1/50 hover:bg-content1 hover:border-primary/30 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Icon.Chart className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{widget.name}</h3>
                          <p className="text-xs text-default-400">{widget.defaultW}x{widget.defaultH}</p>
                        </div>
                      </div>
                      <p className="text-xs text-default-500">{widget.description}</p>
                    </button>
                  ))}
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Custom Widget Creator Modal */}
      <CustomWidgetCreator 
        isOpen={isCustomOpen} 
        onClose={() => setIsCustomOpen(false)}
        onSave={(widget) => {
          // Add custom widget to layout
          const newItem: LayoutItem = {
            i: `custom-${widget.id}`,
            x: 0,
            y: Infinity,
            w: 6,
            h: 6,
            type: `custom-${widget.id}`
          };
          setLayout(prev => [...prev, newItem]);
          setIsCustomOpen(false); // Close modal after adding
        }}
      />
    </div>
  );
}
