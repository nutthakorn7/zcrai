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
import { Alert, AlertCorrelation, AlertsAPI } from '../../shared/api';
import { CorrelationCard } from './CorrelationCard';
import { AlertTriangle, CheckCircle, Activity, ShieldCheck, BookOpen, ThumbsUp, ThumbsDown, Share2, FileText, BrainCircuit } from 'lucide-react';
import { Icon } from '../../shared/ui';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea, useDisclosure, RadioGroup, Radio } from "@heroui/react";
import { InvestigationGraphWidget } from '../../pages/dashboard/widgets/InvestigationGraphWidget';
import { AlertTimelineWidget } from '../../pages/dashboard/widgets/AlertTimelineWidget';
import { AgentTraceTimeline } from './AgentTraceTimeline';
import { ObservablesAPI, Observable } from '../../shared/api/observables';
import { Zap, RefreshCw, ExternalLink, Copy, Shield, ShieldAlert, Lock, Terminal as TerminalIcon } from 'lucide-react';
import { SOARAPI } from '../../shared/api';
import toast from 'react-hot-toast';

interface AlertDetailDrawerProps {
  alert: Alert | null;
  isOpen: boolean;
  onClose: () => void;
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

export function AlertDetailDrawer({ alert, isOpen, onClose }: AlertDetailDrawerProps) {
  const [correlations, setCorrelations] = useState<AlertCorrelation[]>([]);
  const [isLoadingCorrelations, setIsLoadingCorrelations] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [observables, setObservables] = useState<Observable[]>([]);
  const [isLoadingObservables, setIsLoadingObservables] = useState(false);
  
  // Feedback State
  const {isOpen: isFeedbackOpen, onOpen: onFeedbackOpen, onOpenChange: onFeedbackOpenChange, onClose: onFeedbackClose} = useDisclosure();
  // State removed: feedbackType (unused)
  const [feedbackReason, setFeedbackReason] = useState('');
  const [shouldReopen, setShouldReopen] = useState(true);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState<string | null>(null);

  useEffect(() => {
    if (alert && isOpen) {
        setCorrelations([]); // Reset previous
        setSuggestions([]); 
        loadCorrelations();
        loadSuggestions();
        loadObservables();
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

  const loadSuggestions = async () => {
    if (!alert) return;
    try {
        setIsLoadingSuggestions(true);
        // Assuming AlertsAPI has been updated or we call api directly
        const { api } = await import('../../shared/api');
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

  const loadObservables = async () => {
    if (!alert) return;
    try {
      setIsLoadingObservables(true);
      const data = await ObservablesAPI.list({ alertId: alert.id });
      setObservables(data);
    } catch (error) {
      console.error('Failed to load observables:', error);
    } finally {
      setIsLoadingObservables(false);
    }
  };

  const handleEnrich = async (obsId: string) => {
    try {
      await ObservablesAPI.enrich(obsId);
      // Wait a bit or re-poll? For now just refresh
      setTimeout(loadObservables, 1000);
    } catch (error) {
      console.error('Failed to trigger enrichment:', error);
    }
  };

  const handleViewRelatedAlert = (alertId: string) => {
    window.open(`/detections?id=${alertId}`, '_blank');
  };

  const onFeedbackClick = (type: 'correct' | 'incorrect') => {
      // setFeedbackType(type);
      if (type === 'correct') {
          // Immediate submit for correct
          submitFeedback('correct');
      } else {
          // Open modal for incorrect
          setFeedbackReason('');
          setShouldReopen(true);
          onFeedbackOpen();
      }
  };

  const submitFeedback = async (type: 'correct' | 'incorrect', reason?: string, reopen?: boolean) => {
      if (!alert) return;
      try {
          setIsSubmittingFeedback(true);
          await AlertsAPI.feedback(alert.id, {
              feedback: type,
              reason: reason,
              shouldReopen: reopen
          });
          onFeedbackClose();
      } catch (error) {
          console.error('Failed to submit feedback:', error);
      } finally {
          setIsSubmittingFeedback(false);
      }
  };

  const handleExportReport = async () => {
    if (!alert) return;
    try {
      setIsExporting(true);
      const blob = await AlertsAPI.exportReport(alert.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Investigation_Report_${alert.id.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export report:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExecuteSOARAction = async (actionType: any, provider: string, target: string) => {
    try {
      setIsExecutingAction(actionType);
      const res = await SOARAPI.executeAction({
        alertId: alert?.id,
        actionType,
        provider,
        target
      });
      if (res.success) {
        toast.success(`Action ${actionType} initiated on ${target}`);
      } else {
        toast.error(`Action failed: ${res.error}`);
      }
    } catch (error) {
      toast.error('Failed to execute SOAR action');
    } finally {
      setIsExecutingAction(null);
    }
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
                    

                    {/* AI handles all actions automatically - no manual buttons needed */}

                     {/* AI Analyst Verdict (Top Priority) */}
                    {alert.aiAnalysis && (alert.aiAnalysis.classification || alert.aiAnalysis.reasoning) && (
                        <div className="mb-6">
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
                                            {alert.userFeedback ? (
                                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${alert.userFeedback === 'correct' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                                    {alert.userFeedback === 'correct' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                                                    {alert.userFeedback === 'correct' ? 'Verified Correct' : 'Marked Incorrect'}
                                                </div>
                                            ) : (
                                                <>
                                                    <Button 
                                                        size="sm" 
                                                        isIconOnly 
                                                        variant="ghost" 
                                                        className="text-white/40 hover:text-green-400 hover:bg-green-500/10"
                                                        onPress={() => onFeedbackClick('correct')}
                                                    >
                                                        <ThumbsUp className="w-4 h-4" />
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        isIconOnly 
                                                        variant="ghost" 
                                                        className="text-white/40 hover:text-red-400 hover:bg-red-500/10"
                                                        onPress={() => onFeedbackClick('incorrect')}
                                                    >
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
                                                    {alert.aiAnalysis.actionTaken.type === 'MULTI_ACTION' ? 'Multiple Actions Executed' : 'Autonomous Response Executed'}
                                                </div>
                                                <span className="text-[10px] text-green-400/60 font-mono">
                                                    {new Date(alert.aiAnalysis.actionTaken.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            
                                            {alert.aiAnalysis.actionTaken.type === 'MULTI_ACTION' && alert.aiAnalysis.actionTaken.multipleActions ? (
                                                <div className="space-y-3">
                                                    {alert.aiAnalysis.actionTaken.multipleActions.map((action: any, i: number) => (
                                                        <div key={i} className="border-l-2 border-green-500/20 pl-3">
                                                            <div className="flex items-center gap-2 text-sm text-foreground/90">
                                                                <span className="font-mono bg-black/40 px-2 py-0.5 rounded text-green-300 text-xs">
                                                                    {action.type}
                                                                </span>
                                                                <span className="text-foreground/60 text-xs truncate max-w-[200px]">
                                                                    {action.target}
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-foreground/50 mt-0.5">
                                                                {action.details}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <>
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
                                                </>
                                            )}
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {/* AI Swarm Activity (Option B) - Moved Up */}
                    {alert.aiAnalysis?.swarmFindings && alert.aiAnalysis.swarmFindings.length > 0 && (
                        <div className="mb-6">
                             <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-cyan-400">
                                <Icon.Zap className="w-4 h-4" /> 
                                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-bold">
                                    Agent Swarm Activity
                                </span>
                            </h3>
                            <div className="grid gap-3 mb-6">
                                {alert.aiAnalysis.swarmFindings.map((finding: any, idx: number) => (
                                    <div key={idx} className="bg-cyan-950/10 border border-cyan-500/20 rounded-lg p-3 flex items-start gap-3">
                                        <div className="mt-0.5 p-1.5 bg-cyan-500/10 rounded-full">
                                            {finding.agent === 'Network' && <Icon.Globe className="w-4 h-4 text-cyan-400" />}
                                            {finding.agent === 'File' && <Icon.FileCode className="w-4 h-4 text-purple-400" />}
                                            {finding.agent === 'User' && <Icon.User className="w-4 h-4 text-orange-400" />}
                                            {finding.agent === 'Manager' && <Icon.Cpu className="w-4 h-4 text-primary" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-cyan-200 uppercase tracking-wider">
                                                    {finding.agent} Agent
                                                </span>
                                                {finding.status === 'success' ? (
                                                    <Icon.CheckCircle className="w-3 h-3 text-green-500" />
                                                ) : (
                                                    <AlertTriangle className="w-3 h-3 text-red-500" />
                                                )}
                                            </div>
                                            <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                                                {finding.summary}
                                            </p>
                                            {finding.data && (
                                                <div className="mt-2 text-xs text-foreground/50 font-mono bg-black/20 p-2 rounded border border-white/5 overflow-x-auto">
                                                    {JSON.stringify(finding.data, null, 2)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata Grid (Demoted) */}
                    <div className="grid grid-cols-2 gap-4 text-sm bg-content2/30 p-4 rounded-xl border border-white/5 mb-6 opacity-80 hover:opacity-100 transition-opacity">
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
                         <div className="col-span-2 pt-2 border-t border-white/5 mt-2">
                             <span className="text-foreground/50 block text-xs uppercase tracking-wider mb-1">Original Description</span>
                             <p className="text-xs text-foreground/70 leading-relaxed">
                                {alert.description}
                             </p>
                         </div>
                    </div>

                    {/* AI Verdict - Moved to Top */}

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
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-bold text-blue-100">{param.title}</h3>
                                                        <Chip size="sm" variant="flat" color="success" className="h-5 text-[10px]">
                                                            🤖 Auto-Executed
                                                        </Chip>
                                                    </div>
                                                    <p className="text-xs text-blue-200/70">{param.reasoning}</p>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* AI Swarm Activity - Moved to Top */}

                    {/* AI Investigation */}
                     {alert.aiAnalysis?.investigationReport && (
                        <div>
                            <h3 className="text-sm font-semibold mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-purple-400">
                                    <Icon.Cpu className="w-4 h-4" /> 
                                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-bold">
                                        AI Investigation Report
                                    </span>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="flat" 
                                    color="secondary" 
                                    className="h-7 text-[10px] font-bold"
                                    startContent={<FileText className="w-3 h-3" />}
                                    onPress={handleExportReport}
                                    isLoading={isExporting}
                                >
                                    Export PDF
                                </Button>
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

                    {/* Response Actions (SOAR) */}
                    <div>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-danger uppercase tracking-wider">
                            <Shield className="w-4 h-4" /> 
                            Active Response Actions
                        </h3>
                        <Card className="bg-danger/5 border border-danger/20 shadow-lg shadow-danger/5">
                            <CardBody className="p-4">
                                <p className="text-[10px] text-foreground/40 uppercase font-black tracking-widest mb-3">Available Remediation</p>
                                <div className="flex flex-wrap gap-2">
                                    <Button 
                                        size="sm" 
                                        color="danger" 
                                        variant="flat"
                                        startContent={<ShieldAlert className="w-3 h-3" />}
                                        onPress={() => handleExecuteSOARAction('ISOLATE_HOST', 'sentinelone', 'host-zcr-01')}
                                        isLoading={isExecutingAction === 'ISOLATE_HOST'}
                                        className="font-bold h-8"
                                    >
                                        Isolate Host
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        color="warning" 
                                        variant="flat"
                                        startContent={<Lock className="w-3 h-3" />}
                                        onPress={() => handleExecuteSOARAction('BLOCK_IP', 'fortigate', '185.220.101.5')}
                                        isLoading={isExecutingAction === 'BLOCK_IP'}
                                        className="font-bold h-8"
                                    >
                                        Block IP
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        color="secondary" 
                                        variant="flat"
                                        startContent={<TerminalIcon className="w-3 h-3" />}
                                        onPress={() => handleExecuteSOARAction('KILL_PROCESS', 'crowdstrike', 'powershell.exe')}
                                        isLoading={isExecutingAction === 'KILL_PROCESS'}
                                        className="font-bold h-8"
                                    >
                                        Kill Process
                                    </Button>
                                </div>
                                <div className="mt-4 p-3 bg-black/40 rounded-lg border border-white/5 flex items-start gap-2">
                                    <TerminalIcon className="w-3 h-3 text-foreground/30 mt-0.5" />
                                    <p className="text-[9px] text-foreground/50 leading-relaxed font-mono">
                                        Commands are dispatched to the <span className="text-primary hover:underline cursor-pointer">Secrets Vault</span> service. All actions require SOC Level 1+ permissions and are logged for immutable audit.
                                    </p>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    {/* AI Reasoning Trace */}
                    <div>
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-indigo-400 uppercase tracking-wider">
                            <BrainCircuit className="w-4 h-4" /> 
                            AI Investigation Trace
                        </h3>
                        <AgentTraceTimeline alertId={alert.id} />
                    </div>

                    {/* Observables & Enrichment */}
                    <div>
                         <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
                            <Zap className="w-4 h-4" /> 
                            Observables & Enrichment
                            {observables.length > 0 && <Chip size="sm" variant="flat" color="primary" className="ml-auto">{observables.length}</Chip>}
                        </h3>
                        
                        {isLoadingObservables ? (
                            <div className="flex justify-center py-6">
                                <Spinner size="sm" color="primary" />
                            </div>
                        ) : observables.length > 0 ? (
                            <div className="space-y-3">
                                {observables.map((obs) => {
                                    const enrichment = obs.enrichmentData || {};
                                    const vt = enrichment.virustotal;
                                    const abuse = enrichment.abuseipdb;
                                    const otx = enrichment.alienvault;
                                    const urlscan = enrichment.urlscan;

                                    return (
                                        <Card key={obs.id} className="bg-content2/30 border border-white/5 hover:border-primary/20 transition-all">
                                            <CardBody className="p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Chip size="sm" variant="flat" className="capitalize text-[10px] h-5">{obs.type}</Chip>
                                                        <span className="text-sm font-mono text-foreground/90">{obs.value}</span>
                                                        <Button 
                                                            isIconOnly 
                                                            size="sm" 
                                                            variant="light" 
                                                            className="min-w-6 w-6 h-6 text-foreground/40"
                                                            onPress={() => {
                                                                navigator.clipboard.writeText(obs.value);
                                                            }}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {obs.isMalicious && (
                                                            <Chip size="sm" color="danger" variant="flat" className="h-5 text-[10px]">Malicious</Chip>
                                                        )}
                                                        <Button 
                                                            isIconOnly 
                                                            size="sm" 
                                                            variant="light" 
                                                            className="min-w-6 w-6 h-6 text-foreground/40 hover:text-primary"
                                                            onPress={() => handleEnrich(obs.id)}
                                                        >
                                                            <RefreshCw className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    {/* VT */}
                                                    <div className={`text-[10px] p-1.5 rounded border border-white/5 ${vt ? (vt.malicious_count > 0 ? 'bg-danger/5 border-danger/10' : 'bg-success/5 border-success/10') : 'bg-white/5 opacity-50'}`}>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-foreground/50">VirusTotal</span>
                                                            {vt ? (
                                                                <span className={vt.malicious_count > 0 ? 'text-danger font-bold' : 'text-success'}>
                                                                    {vt.malicious_count}/{vt.total_engines || 0}
                                                                </span>
                                                            ) : 'PENDING'}
                                                        </div>
                                                    </div>

                                                    {/* AbuseIPDB */}
                                                    {obs.type === 'ip' && (
                                                        <div className={`text-[10px] p-1.5 rounded border border-white/5 ${abuse ? (abuse.abuseConfidenceScore > 50 ? 'bg-danger/5 border-danger/10' : 'bg-success/5 border-success/10') : 'bg-white/5 opacity-50'}`}>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-foreground/50">AbuseIPDB</span>
                                                                {abuse ? (
                                                                    <span className={abuse.abuseConfidenceScore > 50 ? 'text-danger font-bold' : 'text-success'}>
                                                                        Score: {abuse.abuseConfidenceScore}%
                                                                    </span>
                                                                ) : 'PENDING'}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* OTX */}
                                                    <div className={`text-[10px] p-1.5 rounded border border-white/5 ${otx ? (otx.details?.pulseCount > 0 ? 'bg-warning/5 border-warning/10' : 'bg-success/5 border-success/10') : 'bg-white/5 opacity-50'}`}>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-foreground/50">AlienVault OTX</span>
                                                            {otx ? (
                                                                <span className={otx.details?.pulseCount > 0 ? 'text-warning font-bold' : 'text-success'}>
                                                                    {otx.details?.pulseCount || 0} Pulses
                                                                </span>
                                                            ) : 'PENDING'}
                                                        </div>
                                                    </div>

                                                    {/* URLScan */}
                                                    {(obs.type === 'url' || obs.type === 'domain') && (
                                                        <div className={`text-[10px] p-1.5 rounded border border-white/5 ${urlscan ? (urlscan.isMalicious ? 'bg-danger/5 border-danger/10' : 'bg-success/5 border-success/10') : 'bg-white/5 opacity-50'}`}>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-foreground/50">URLScan.io</span>
                                                                {urlscan ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className={urlscan.isMalicious ? 'text-danger font-bold' : 'text-success'}>
                                                                            Score: {urlscan.score}
                                                                        </span>
                                                                        {urlscan.details?.urlscanUrl && (
                                                                            <a href={urlscan.details.urlscanUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                                                                <ExternalLink className="w-2 h-2" />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                ) : 'PENDING'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardBody>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-content2/20 rounded-lg border border-white/5 border-dashed">
                                <p className="text-xs text-foreground/50">No observables found for this alert</p>
                            </div>
                        )}
                    </div>

                    {/* Raw Data (Moved to bottom) */}
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

                    {/* Investigation Graph */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-indigo-400">
                            <Share2 className="w-4 h-4" /> 
                            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent font-bold">
                                Entity Graph
                            </span>
                        </h3>
                        <InvestigationGraphWidget alertId={alert.id} className="h-[400px]" />
                    </div>

                    {/* Attack Timeline */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-cyan-400">
                            <Icon.Clock className="w-4 h-4" /> 
                            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent font-bold">
                                Attack Timeline
                            </span>
                        </h3>
                        <AlertTimelineWidget alertId={alert.id} />
                    </div>

                    <div className="h-12" /> {/* Bottom Spacer */}
                </ScrollShadow>
            </div>
        )}
      </div>

      {/* Feedback Modal */}
      <Modal isOpen={isFeedbackOpen} onOpenChange={onFeedbackOpenChange} placement="center">
        <ModalContent className="bg-[#18181b] border border-white/10">
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                    <ThumbsDown className="w-5 h-5" />
                    Report Incorrect Verdict
                </h3>
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-foreground/70 mb-2">
                    Start training the AI by providing the correct context. Why is this verdict incorrect?
                </p>
                <Textarea
                    placeholder="E.g., This is a known internal tool running nightly backups..."
                    minRows={3}
                    value={feedbackReason}
                    onValueChange={setFeedbackReason}
                    classNames={{
                        input: "bg-white/5 border-white/10 group-data-[focus=true]:border-red-500/50"
                    }}
                />
                
                <div className="mt-2 bg-white/5 p-3 rounded-lg">
                    <RadioGroup 
                        label="Action Requirement" 
                        size="sm"
                        value={shouldReopen ? 'reopen' : 'info'}
                        onValueChange={(v) => setShouldReopen(v === 'reopen')}
                        color="danger"
                    >
                        <Radio value="reopen" description="This alert needs further investigation">Reopen Alert</Radio>
                        <Radio value="info" description="Just logging feedback for training">Log Feedback Only</Radio>
                    </RadioGroup>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button 
                    color="danger" 
                    onPress={() => submitFeedback('incorrect', feedbackReason, shouldReopen)}
                    isLoading={isSubmittingFeedback}
                >
                  Submit Correction
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
