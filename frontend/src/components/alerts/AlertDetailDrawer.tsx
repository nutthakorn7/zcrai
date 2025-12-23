import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
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
import { AlertTriangle, CheckCircle, Activity, ShieldCheck, BookOpen, ThumbsUp, ThumbsDown } from 'lucide-react';
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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    if (alert && isOpen) {
        setCorrelations([]); // Reset previous
        setSuggestions([]); 
        loadCorrelations();
        loadSuggestions();
    }
  }, [alert, isOpen]);

  const [feedbackStatus, setFeedbackStatus] = useState<'none' | 'sent'>('none');

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

  const handleFeedback = async (rating: number) => {
      if (!alert) return;
      try {
          const { api } = await import('../../shared/api/api');
          await api.post(`/feedback/${alert.id}`, { rating });
          setFeedbackStatus('sent');
      } catch (error) {
          console.error('Feedback failed:', error);
      }
  };

  const loadSuggestions = async () => {
    if (!alert) return;
    try {
        setIsLoadingSuggestions(true);
        // Assuming AlertsAPI has been updated or we call api directly
        const { api } = await import('../../shared/api/api');
        const res = await api.get(`/playbooks/suggestions?alertId=${alert.id}`);
        if(res.data.success) {
            setSuggestions(res.data.data.suggestions);
        }
    } catch (error) {
        console.warn('Failed to load playbook suggestions', error);
    } finally {
        setIsLoadingSuggestions(false);
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
                             <span className="text-xs text-foreground/50 font-mono">ID: {alert.id.substring(0, 8)}</span>
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
                            <span className="text-foreground/50 block text-xs uppercase tracking-wider mb-1">Source</span>
                            <div className="flex items-center gap-2 font-medium">
                                <Icon.Database className="w-4 h-4 text-primary" />
                                {alert.source}
                            </div>
                        </div>
                        <div>
                            <span className="text-foreground/50 block text-xs uppercase tracking-wider mb-1">Detected At</span>
                            <div className="font-medium">
                                {new Date(alert.createdAt).toLocaleString()}
                            </div>
                        </div>
                         {alert.lastSeenAt && (
                            <div className="col-span-2">
                                <span className="text-foreground/50 block text-xs uppercase tracking-wider mb-1">Last Seen</span>
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

                    {/* AI Triage Card (Phase 1) */}
                    {alert.aiAnalysis && (alert.aiAnalysis.classification || alert.aiAnalysis.reasoning) && (
                        <div>
                             <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Icon.Cpu className="w-4 h-4 text-purple-400" /> 
                                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-bold">
                                    AI Analyst Verdict
                                </span>
                            </h3>
                            <Card className="bg-[#18181b] border border-white/10 shadow-lg">
                                <CardBody className="p-4 space-y-4">
                                    {/* Verdict Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Chip 
                                                color={alert.aiAnalysis.classification === 'TRUE_POSITIVE' ? 'danger' : 'success'} 
                                                variant="flat"
                                                className="uppercase font-bold tracking-wider"
                                                startContent={
                                                    alert.aiAnalysis.classification === 'TRUE_POSITIVE' 
                                                    ? <AlertTriangle className="w-4 h-4" /> 
                                                    : <CheckCircle className="w-4 h-4" />
                                                }
                                            >
                                                {alert.aiAnalysis.classification?.replace('_', ' ') || 'ANALYZED'}
                                            </Chip>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase text-foreground/50 font-bold tracking-wider">Confidence</span>
                                                <span className={`text-sm font-bold ${Number(alert.aiAnalysis.confidence) > 80 ? 'text-green-400' : 'text-warning'}`}>
                                                    {alert.aiAnalysis.confidence}%
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Feedback Buttons */}
                                        <div className="flex items-center gap-1">
                                            {feedbackStatus === 'sent' ? (
                                                <span className="text-[10px] text-green-400 font-medium animate-pulse">Thanks for feedback!</span>
                                            ) : (
                                                <>
                                                    <Button isIconOnly size="sm" variant="light" className="text-foreground/30 hover:text-green-400" onPress={() => handleFeedback(1)}>
                                                        <ThumbsUp className="w-4 h-4" />
                                                    </Button>
                                                    <Button isIconOnly size="sm" variant="light" className="text-foreground/30 hover:text-red-400" onPress={() => handleFeedback(-1)}>
                                                        <ThumbsDown className="w-4 h-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reasoning */}
                                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                        <p className="text-sm text-foreground/90 leading-relaxed font-sans">
                                            {alert.aiAnalysis.reasoning}
                                        </p>
                                    </div>

                                    {/* Suggested Action */}
                                    {alert.aiAnalysis.suggested_action && (
                                        <div className="flex items-center gap-2 text-xs text-foreground/60 bg-white/5 p-2 rounded border border-white/5 border-dashed">
                                            <Activity className="w-3 h-3 text-primary" />
                                            <span className="uppercase font-bold tracking-wider text-foreground/50">Suggestion:</span>
                                            <span className="text-foreground/80 font-medium">{alert.aiAnalysis.suggested_action}</span>
                                        </div>
                                    )}

                                    {/* Phase 2: Autonomous Response Status */}
                                    {alert.aiAnalysis.actionTaken && (
                                        <div className="bg-green-500/10 border border-green-500/20 rounded p-3 mt-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-green-400 font-bold uppercase text-xs tracking-wider">
                                                    <ShieldCheck className="w-4 h-4" />
                                                    Autonomous Response Executed
                                                </div>
                                                <span className="text-[10px] text-green-400/60 font-mono">
                                                    {new Date(alert.aiAnalysis.actionTaken.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-foreground/90">
                                                <span className="font-mono bg-black/40 px-2 py-0.5 rounded text-green-300">
                                                    {alert.aiAnalysis.actionTaken.type}
                                                </span>
                                                <span className="text-foreground/60">
                                                    {alert.aiAnalysis.actionTaken.target}
                                                </span>
                                            </div>
                                            <div className="text-xs text-foreground/50 mt-1 pl-1 border-l-2 border-green-500/20">
                                                {alert.aiAnalysis.actionTaken.details}
                                            </div>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {/* AI Playbook Suggestions */}
                    {(suggestions.length > 0 || isLoadingSuggestions) && (
                        <div>
                             <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-blue-400">
                                <BookOpen className="w-4 h-4" /> 
                                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent font-bold">
                                    Recommended Playbooks
                                </span>
                            </h3>
                            {isLoadingSuggestions ? (
                                <div className="p-4 border border-blue-500/20 rounded bg-blue-500/5 animate-pulse">
                                    <div className="h-4 w-1/3 bg-blue-500/20 rounded mb-2"></div>
                                    <div className="h-3 w-1/2 bg-blue-500/10 rounded"></div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {suggestions.map((param: any, idx: number) => (
                                        <Card key={idx} className="bg-blue-900/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors">
                                            <CardBody className="p-3">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-blue-100">{param.title}</h4>
                                                            <Chip size="sm" variant="flat" color="primary" className="h-5 text-[10px]">
                                                                {param.matchScore}% MATCH
                                                            </Chip>
                                                        </div>
                                                        <p className="text-xs text-blue-200/70 mt-1">{param.reasoning}</p>
                                                    </div>
                                                    <Button 
                                                        size="sm" 
                                                        color="primary" 
                                                        variant="shadow"
                                                        className="font-medium"
                                                        onPress={() => window.open(`/playbooks/${param.playbookId}`, '_blank')}
                                                    >
                                                        Run
                                                    </Button>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* AI Investigation */}
                     {alert.aiAnalysis?.investigationReport && (
                        <div>
                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-purple-400">
                                <Icon.Cpu className="w-4 h-4" /> 
                                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-bold">
                                    AI Investigation Report
                                </span>
                            </h3>
                            <Card className="bg-purple-900/10 border border-purple-500/20">
                                <CardBody className="p-4">
                                     <div className="prose prose-sm prose-invert max-w-none
                                         prose-headings:text-purple-300 prose-headings:font-bold
                                         prose-p:text-foreground/90 prose-p:leading-relaxed
                                         prose-strong:text-purple-200
                                         prose-ul:text-foreground/80
                                         prose-code:bg-black/40 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-purple-300">
                                        <ReactMarkdown>{alert.aiAnalysis.investigationReport}</ReactMarkdown>
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
                                <p className="text-xs text-foreground/50">No correlations found in this time window</p>
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
