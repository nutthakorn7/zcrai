import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Chip,
  Spinner,
  ScrollShadow
} from '@heroui/react';
import { Alert, AlertCorrelation, AlertsAPI } from '../../shared/api/alerts';
import { CorrelationCard } from './CorrelationCard';
import { Icon } from '../../shared/ui';

interface AlertDetailDrawerProps {
  alert: Alert | null;
  isOpen: boolean;
  onClose: () => void;
  onPromote?: (alert: Alert) => void;
  onDismiss?: (alert: Alert) => void;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'danger';
    case 'high': return 'warning';
    case 'medium': return 'primary';
    case 'low': return 'success';
    default: return 'default';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'new': return 'primary';
    case 'investigating': return 'warning';
    case 'resolved': return 'success';
    case 'dismissed': return 'default';
    default: return 'default';
  }
};

export function AlertDetailDrawer({ alert, isOpen, onClose, onPromote, onDismiss }: AlertDetailDrawerProps) {
  const [correlations, setCorrelations] = useState<AlertCorrelation[]>([]);
  const [isLoadingCorrelations, setIsLoadingCorrelations] = useState(false);

  useEffect(() => {
    if (alert && isOpen) {
        setCorrelations([]); // Reset previous
        loadCorrelations();
    }
  }, [alert, isOpen]);

  const loadCorrelations = async () => {
    if (!alert) return;
    
    try {
      setIsLoadingCorrelations(true);
      const data = await AlertsAPI.getCorrelations(alert.id);
      setCorrelations(data);
    } catch (error) {
      console.error('Failed to load correlations:', error);
    } finally {
      setIsLoadingCorrelations(false);
    }
  };

  const handleViewRelatedAlert = (alertId: string) => {
    window.open(`/detections?id=${alertId}`, '_blank');
  };

  // Drawer Animation Classes
  const drawerClasses = `fixed inset-y-0 right-0 w-[600px] bg-[#121417]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;
  const backdropClasses = `fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 z-40 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

  if (!alert && !isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className={backdropClasses} onClick={onClose} />

      {/* Drawer */}
      <div className={drawerClasses}>
        {alert && (
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-start justify-between bg-white/5">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                             <Chip size="sm" variant="dot" color={getSeverityColor(alert.severity) as any} className="uppercase font-bold tracking-wider text-[10px]">
                                {alert.severity}
                             </Chip>
                             <Chip size="sm" variant="flat" color={getStatusColor(alert.status) as any} className="capitalize">
                                {alert.status}
                             </Chip>
                             <span className="text-xs text-foreground/40 font-mono">ID: {alert.id.substring(0, 8)}</span>
                        </div>
                        <h2 className="text-lg font-bold text-foreground leading-tight px-1">{alert.title}</h2>
                    </div>
                    <Button isIconOnly variant="light" onPress={onClose} className="text-foreground/50 hover:text-foreground">
                        <Icon.Close className="w-5 h-5" />
                    </Button>
                </div>

                {/* Body (Scrollable) */}
                <ScrollShadow className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Action Bar */}
                    <div className="flex gap-3 mb-2">
                        {onPromote && (
                            <Button 
                                color="primary" 
                                className="flex-1 font-medium shadow-lg shadow-primary/20" 
                                onPress={() => onPromote(alert)}
                                startContent={<Icon.ShieldAlert className="w-4 h-4" />}
                            >
                                Promote to Case
                            </Button>
                        )}
                        {onDismiss && (
                             <Button 
                                color="danger" 
                                variant="flat" 
                                className="flex-1 font-medium" 
                                onPress={() => onDismiss(alert)}
                                startContent={<Icon.Close className="w-4 h-4" />}
                            >
                                Dismiss
                            </Button>
                        )}
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm bg-content2/30 p-4 rounded-xl border border-white/5">
                        <div>
                            <span className="text-foreground/40 block text-xs uppercase tracking-wider mb-1">Source</span>
                            <div className="flex items-center gap-2 font-medium">
                                <Icon.Database className="w-4 h-4 text-primary" />
                                {alert.source}
                            </div>
                        </div>
                        <div>
                            <span className="text-foreground/40 block text-xs uppercase tracking-wider mb-1">Detected At</span>
                            <div className="font-medium">
                                {new Date(alert.createdAt).toLocaleString()}
                            </div>
                        </div>
                         {alert.lastSeenAt && (
                            <div className="col-span-2">
                                <span className="text-foreground/40 block text-xs uppercase tracking-wider mb-1">Last Seen</span>
                                <div className="font-medium">
                                    {new Date(alert.lastSeenAt).toLocaleString()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Icon.FileText className="w-4 h-4 text-foreground/50" /> Description
                        </h3>
                        <p className="text-sm text-foreground/80 leading-relaxed bg-content2/20 p-4 rounded-lg border border-white/5">
                            {alert.description}
                        </p>
                    </div>

                    {/* AI Investigation */}
                     {alert.aiAnalysis?.investigationReport && (
                        <div>
                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-purple-400">
                                <Icon.Cpu className="w-4 h-4" /> AI Analysis
                            </h3>
                            <Card className="bg-purple-900/10 border border-purple-500/20">
                                <CardBody className="p-4">
                                     <div className="prose prose-sm prose-invert max-w-none">
                                        <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90">
                                            {alert.aiAnalysis.investigationReport}
                                        </pre>
                                     </div>
                                </CardBody>
                            </Card>
                        </div>
                     )}

                     {/* Observables (Placeholder for now, assuming rawData might have it) */}
                    {alert.rawData && (
                        <div>
                             <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Icon.Terminal className="w-4 h-4 text-foreground/50" /> Raw Data / Evidence
                            </h3>
                            <div className="bg-[#0D0E11] p-4 rounded-lg border border-white/10 overflow-x-auto">
                                <pre className="text-xs text-green-400 font-mono">
                                    {JSON.stringify(alert.rawData, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Correlations */}
                    <div>
                         <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Icon.Signal className="w-4 h-4 text-warning" /> 
                            Correlated Events
                            {correlations.length > 0 && <Chip size="sm" variant="flat" color="warning" className="ml-auto">{correlations.length}</Chip>}
                        </h3>
                        {isLoadingCorrelations ? (
                            <div className="flex justify-center py-8">
                                <Spinner size="sm" color="warning" />
                            </div>
                        ) : correlations.length > 0 ? (
                             <div className="space-y-3">
                                {correlations.map((correlation) => (
                                    <CorrelationCard
                                        key={correlation.id}
                                        correlation={correlation}
                                        onViewAlert={handleViewRelatedAlert}
                                    />
                                ))}
                            </div>
                        ) : (
                             <div className="text-center py-6 bg-content2/20 rounded-lg border border-white/5 border-dashed">
                                <p className="text-xs text-foreground/40">No correlations found in this time window</p>
                            </div>
                        )}
                    </div>

                    <div className="h-12" /> {/* Bottom Spacer */}
                </ScrollShadow>
            </div>
        )}
      </div>
    </>
  );
}
