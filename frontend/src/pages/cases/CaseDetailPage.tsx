import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Chip, Select, SelectItem, Textarea, Spinner, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Avatar, AvatarGroup, Tooltip, Tabs, Tab, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { Icon } from '../../shared/ui';
import { CasesAPI } from '../../shared/api/cases';
import { PlaybooksAPI } from '../../shared/api/playbooks';
import { useAuth } from '../../shared/store/useAuth';
import { PlaybookWidget } from '../../components/PlaybookWidget';
import { EvidenceWidget } from '../../components/EvidenceWidget';
import { EvidenceTab } from '../../components/EvidenceTab';
import { ForensicsTab } from '../../components/ForensicsTab';
import { InvestigationGraph } from '../../components/InvestigationGraph';
import { api } from '../../shared/api/api';
import { useCaseSocket } from '../../shared/hooks/useCaseSocket';
import { ActivityTimeline } from '../../components/cases/ActivityTimeline';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // ⚠️ useCaseSocket MUST be called unconditionally before any early return
  const { activeUsers, typingUsers, emitTyping } = useCaseSocket(id || '');
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [caseItem, setCaseItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [newComment, setNewComment] = useState('');

  // AI State
  const [aiResult, setAiResult] = useState<{ summary: string, verdict: string, confidence: number, evidence_analysis: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Copilot State
  const [copilotMessages, setCopilotMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);

  const fetchCase = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await CasesAPI.getById(id);
      setCaseItem(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleGenerateAI = async () => {
    if (!caseItem) return;
    try {
      setAiLoading(true);
      const [sumRes, sugRes] = await Promise.all([
        CasesAPI.summarize(caseItem.id),
        CasesAPI.suggestPlaybook(caseItem.id)
      ]);
      setAiResult(sumRes.data);
      setAiSuggestion(sugRes.data);
    } catch (e) {
      console.error('AI Error:', e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunSuggestion = async (playbookId: string) => {
      if (!caseItem) return;
      try {
          await PlaybooksAPI.run(caseItem.id, playbookId);
          fetchCase(); 
      } catch (e) {
          console.error("Run Playbook Failed", e);
      }
  };

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  // Copilot Chat Handler
  // Copilot Chat Handler
  const handleCopilotChat = async () => {
    if (!copilotQuery.trim() || !caseItem) return;
    
    const userMessage = { role: 'user' as const, content: copilotQuery };
    setCopilotMessages(prev => [...prev, userMessage]);
    
    // Add placeholder for AI response
    setCopilotMessages(prev => [...prev, { role: 'ai', content: '' }]);
    
    setCopilotQuery('');
    setCopilotLoading(true);
    
    try {
      // Build case context for AI
      const caseContext = `
Case: ${caseItem.title}
Severity: ${caseItem.severity}
Status: ${caseItem.status}
Description: ${caseItem.description || 'N/A'}
Alerts: ${caseItem.alerts?.map((a: any) => `[${a.severity}] ${a.title}`).join(', ') || 'None'}
Evidence: ${caseItem.evidence?.length || 0} items
`;
      
      const { AIAPI } = await import('../../shared/api/ai');
      
      // Use Streaming API
      AIAPI.streamChat([...copilotMessages, userMessage], caseContext, (chunk) => {
          setCopilotMessages(prev => {
              const newMessages = [...prev];
              const lastMsg = newMessages[newMessages.length - 1];
              if (lastMsg.role === 'ai') {
                  lastMsg.content += chunk;
              }
              return newMessages;
          });
          
          setCopilotLoading(false); // Stop loading indicator once streaming starts
      });

    } catch (e: any) {
      setCopilotMessages(prev => [...prev, { role: 'ai', content: `Error: ${e.message}` }]);
      setCopilotLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!caseItem) return;
    await CasesAPI.update(caseItem.id, { status: newStatus });
    fetchCase(); // Refresh to see history/updates
  };

  const handleComment = async () => {
    if (!newComment.trim() || !caseItem) return;
    await CasesAPI.addComment(caseItem.id, newComment);
    setNewComment('');
    fetchCase(); // Refresh to see comment
  };

  const handleEditComment = async (commentId: string, newContent: string) => {
    if (!caseItem) return;
    try {
      await CasesAPI.editComment(caseItem.id, commentId, newContent);
      fetchCase();
    } catch (e) {
      console.error('Failed to edit comment:', e);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!caseItem) return;
    try {
      await CasesAPI.deleteComment(caseItem.id, commentId);
      fetchCase();
    } catch (e) {
      console.error('Failed to delete comment:', e);
    }
  };

  const handleExportPDF = async () => {
    if (!caseItem) return;
    try {
      setExporting(true);
      const blob = await CasesAPI.exportPDF(caseItem.id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `case-${caseItem.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export PDF:', e);
    } finally {
      setExporting(false);
    }
  };

  const { isOpen: isGraphOpen, onOpen: onGraphOpen, onClose: onGraphClose } = useDisclosure();
  const { isOpen: isSyncOpen, onOpen: onSyncOpen, onClose: onSyncClose } = useDisclosure();
  const [syncSystem, setSyncSystem] = useState<'jira'|'servicenow'>('jira');
  const [syncing, setSyncing] = useState(false);

  const handleSyncTicket = async () => {
      if (!caseItem) return;
      try {
          setSyncing(true);
          await CasesAPI.syncToTicket(caseItem.id, syncSystem, {});
          onSyncClose();
          alert(`${syncSystem === 'jira' ? 'Jira' : 'ServiceNow'} ticket created successfully!`);
          fetchCase();
      } catch (e) {
          console.error(e);
          alert('Failed to create ticket');
      } finally {
          setSyncing(false);
      }
  };
  
  if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
  if (!caseItem) return <div className="p-10 text-center">Case not found</div>;

  // SLA Logic
  const getSLAHours = (severity: string | undefined | null) => {
    if (!severity) return 24; // Default SLA
    switch(severity.toLowerCase()) {
        case 'critical': return 4;
        case 'high': return 8;
        case 'medium': return 24;
        case 'low': return 48;
        default: return 24;
    }
  };

  // Safe date parsing
  // Safe date parsing
  const createdAt = caseItem.createdAt || caseItem.created_at;
  const createdAtDate = createdAt ? new Date(createdAt) : null;
  const isValidDate = createdAtDate && !isNaN(createdAtDate.getTime());
  
  const slaDeadline = isValidDate 
    ? new Date(createdAtDate.getTime() + getSLAHours(caseItem.severity) * 60 * 60 * 1000)
    : null;
  const now = new Date();
  const timeLeftMs = slaDeadline ? slaDeadline.getTime() - now.getTime() : 0;
  const isBreached = slaDeadline ? timeLeftMs < 0 : false;
  
  const formatTimeLeft = (ms: number) => {
      if (!isFinite(ms) || isNaN(ms)) return 'N/A';
      const absMs = Math.abs(ms);
      const h = Math.floor(absMs / (1000 * 60 * 60));
      const m = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${h}h ${m}m`;
  };

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString();
  };

  // useCaseSocket was moved to the top of the component (line 24) to fix React hooks rules

  return (
    <div className="p-6 h-full flex flex-col gap-6 w-full pb-32">
      {/* Header */}
      <div className="flex justify-between items-start w-full">
        <div className="flex flex-col gap-2 flex-1 w-full">
            <Button variant="light" size="sm" startContent={<Icon.ArrowLeft className="w-4 h-4"/>} onPress={() => navigate('/cases')} className="w-fit -ml-3">Back to Board</Button>
            <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{caseItem.title || 'Untitled Case'}</h1>
                {caseItem.severity && <Chip color={caseItem.severity === 'critical' ? 'danger' : caseItem.severity === 'high' ? 'warning' : 'primary'}>{caseItem.severity}</Chip>}
                
                {slaDeadline && caseItem.status !== 'resolved' && caseItem.status !== 'closed' && (
                    <Chip 
                        variant="flat" 
                        color={isBreached ? "danger" : (timeLeftMs < 3600000 ? "warning" : "success")}
                        startContent={<Icon.Clock className="w-3 h-3" />}
                        className="font-mono"
                    >
                        {isBreached ? `Breached by ${formatTimeLeft(timeLeftMs)}` : `${formatTimeLeft(timeLeftMs)} remaining`}
                    </Chip>
                )}
            </div>
            
            {/* Meta Row */}
            <div className="flex flex-wrap justify-between items-center w-full gap-y-2 text-gray-400 text-sm">
                <div className="flex items-center gap-4">
                    <span>Created {formatDate(createdAt)}</span>
                    {caseItem.status && <span>• Status: {caseItem.status}</span>}
                </div>
                
                {activeUsers.length > 0 && (
                     <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                        <span className="text-xs font-semibold text-success uppercase tracking-widest animate-pulse">LIVE</span>
                        <AvatarGroup isBordered max={4} size="sm">
                            {activeUsers.map(u => (
                                <Tooltip key={u.id} content={u.name}>
                                    <Avatar name={u.name} />
                                </Tooltip>
                            ))}
                        </AvatarGroup>
                     </div>
                )}
            </div>
        </div>
        <div className="flex gap-2">
             <Button color="secondary" variant="flat" startContent={<Icon.Global className="w-4 h-4" />} onPress={onGraphOpen}>
                Graph View
             </Button>
             <Button variant="bordered" startContent={<Icon.Refresh className="w-4 h-4" />} onPress={onSyncOpen}>
                Sync
             </Button>
             <Button 
                variant="flat" 
                startContent={!exporting && <Icon.Document className="w-4 h-4" />} 
                isLoading={exporting}
                onPress={handleExportPDF}
             >
                Export PDF
             </Button>
             <Select 
                aria-label="Status"
                selectedKeys={[caseItem.status]} 
                className="w-40" 
                onChange={(e) => handleStatusChange(e.target.value)}
            >
                <SelectItem key="open">Open</SelectItem>
                <SelectItem key="investigating">Investigating</SelectItem>
                <SelectItem key="resolved">Resolved</SelectItem>
                <SelectItem key="closed">Closed</SelectItem>
            </Select>
        </div>
      </div>

      {/* Graph Modal */}
      <Modal 
        isOpen={isGraphOpen} 
        onClose={onGraphClose} 
        size="full"
        classNames={{
            base: "bg-black/90 backdrop-blur-xl",
            header: "border-b border-white/10",
            body: "p-0 overflow-hidden",
        }}
      >
        <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
                Visual Investigation: {caseItem.title}
                <span className="text-xs font-normal text-white/50">Space/Scroll to Zoom • Drag to Pan</span>
            </ModalHeader>
            <ModalBody className="h-full w-full">
                {isGraphOpen && <InvestigationGraph caseId={caseItem.id} className="h-full" />}
            </ModalBody>
        </ModalContent>
      </Modal>

      {/* Sync Ticket Modal */}
      <Modal 
        isOpen={isSyncOpen} 
        onClose={onSyncClose}
      >
        <ModalContent>
          <ModalHeader>Sync to Ticket System</ModalHeader>
          <ModalBody className="gap-4">
             <Select label="System" selectedKeys={[syncSystem]} onChange={(e) => setSyncSystem(e.target.value as 'jira'|'servicenow')}>
                 <SelectItem key="jira">Jira Software</SelectItem>
                 <SelectItem key="servicenow">ServiceNow</SelectItem>
             </Select>
             
             {/* Note: Configuration should be loaded from settings, skipping manual config here for better UX */}
             <div className="p-3 bg-default-100/50 rounded-lg text-sm text-default-500">
                 Will create a new ticket in the default configured project for this tenant.
             </div>
          </ModalBody>
          <ModalFooter>
             <Button variant="light" onPress={onSyncClose}>Cancel</Button>
             <Button color="primary" onPress={handleSyncTicket} isLoading={syncing}>
                 Create Ticket
             </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
         {/* Left: Details */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Tabs aria-label="Case Options" color="primary" variant="underlined">
                <Tab key="overview" title="Overview">
                    <div className="flex flex-col gap-6 mt-4">
                        <Card className="p-4">
                            <h3 className="text-lg font-semibold mb-2">Description</h3>
                            <p className="text-gray-300 whitespace-pre-wrap">{caseItem.description || 'No description provided.'}</p>
                        </Card>

                        {/* Comments */}
                        <div className="flex flex-col gap-4">
                            <h3 className="text-lg font-semibold">Activity & Comments</h3>
                            
                            {/* Input */}
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <Textarea 
                                        placeholder="Add a note or update..." 
                                        minRows={2}
                                        value={newComment}
                                        onValueChange={setNewComment}
                                        onFocus={() => emitTyping(true)}
                                        onBlur={() => emitTyping(false)}
                                    />
                                    <Button color="primary" className="h-[64px]" onPress={handleComment} isDisabled={!newComment.trim()}>Post</Button>
                                </div>
                                {typingUsers.length > 0 && (
                                    <div className="text-xs text-foreground/60 italic animate-pulse px-1">
                                        {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                                    </div>
                                )}
                            </div>

                            {/* Timeline */}
                            <div className="mt-2">
                                <ActivityTimeline
                                    comments={caseItem.comments || []}
                                    history={caseItem.history || []}
                                    currentUserEmail={user?.email || ''}
                                    onEditComment={handleEditComment}
                                    onDeleteComment={handleDeleteComment}
                                />
                            </div>
                        </div>
                    </div>
                </Tab>

                <Tab key="audit" title="Audit Logs">
                    <div className="mt-4">
                         <Table aria-label="Audit Logs">
                            <TableHeader>
                                <TableColumn>Time</TableColumn>
                                <TableColumn>Action</TableColumn>
                                <TableColumn>Details</TableColumn>
                            </TableHeader>
                            <TableBody>
                                {caseItem.history?.map((h: any) => (
                                    <TableRow key={h.id}>
                                        <TableCell className="whitespace-nowrap text-gray-400">
                                            {new Date(h.createdAt).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="sm" variant="flat" color="secondary">{h.action}</Chip>
                                        </TableCell>
                                        <TableCell>
                                            <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto max-w-[400px]">
                                                {JSON.stringify(h.details, null, 2)}
                                            </pre>
                                        </TableCell>
                                    </TableRow>
                                )) || []}
                            </TableBody>
                         </Table>
                         {(!caseItem.history || caseItem.history.length === 0) && (
                            <div className="text-center p-8 text-gray-500">No audit logs available.</div>
                         )}
                    </div>
                </Tab>

                <Tab key="evidence" title="Evidence">
                    <div className="mt-4">
                        <EvidenceTab caseId={caseItem.id} />
                    </div>
                </Tab>

                <Tab key="forensics" title="Forensics">
                    <div className="mt-4">
                        <ForensicsTab caseId={caseItem.id} />
                    </div>
                </Tab>

                <Tab key="copilot" title="🤖 AI Copilot">
                    <div className="mt-4 flex flex-col h-[600px]">
                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-content2/30 rounded-lg border border-white/5">
                            {copilotMessages.length === 0 && (
                                <div className="text-center py-12">
                                    <Icon.Cpu className="w-12 h-12 mx-auto text-secondary/50 mb-4" />
                                    <h3 className="text-lg font-semibold text-foreground/70">Investigation Copilot</h3>
                                    <p className="text-sm text-foreground/50 mt-2 max-w-md mx-auto">
                                        Ask questions about this case. I have access to the case details, alerts, and evidence.
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center mt-6">
                                        {['What are the key IOCs?', 'Is this a true positive?', 'What should I investigate next?'].map(q => (
                                            <Button 
                                                key={q} 
                                                size="sm" 
                                                variant="flat" 
                                                color="secondary"
                                                onPress={() => { setCopilotQuery(q); }}
                                            >
                                                {q}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {copilotMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-lg ${
                                        msg.role === 'user' 
                                            ? 'bg-primary text-primary-foreground' 
                                            : 'bg-content2 border border-white/10'
                                    }`}>
                                        {msg.role === 'ai' ? (
                                            <div className="prose prose-invert prose-sm max-w-none">
                                                <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                                            </div>
                                        ) : (
                                            <p className="text-sm">{msg.content}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            {copilotLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-content2 border border-white/10 p-3 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Spinner size="sm" color="secondary" />
                                            <span className="text-sm text-foreground/70">Thinking...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Input */}
                        <div className="mt-4 flex gap-2">
                            <Textarea
                                placeholder="Ask about this case..."
                                minRows={1}
                                maxRows={3}
                                value={copilotQuery}
                                onValueChange={setCopilotQuery}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleCopilotChat();
                                    }
                                }}
                                classNames={{ inputWrapper: 'bg-content2/50' }}
                            />
                            <Button 
                                color="secondary" 
                                isIconOnly 
                                onPress={handleCopilotChat}
                                isLoading={copilotLoading}
                                isDisabled={!copilotQuery.trim()}
                            >
                                <Icon.ArrowUpRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Tab>
            </Tabs>
          </div>

         {/* Right: Meta & Evidence */}
         <div className="flex flex-col gap-4">
            
            {/* AI Investigator Widget */}
            <Card className="p-4 border border-secondary/20 bg-secondary/5">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                    <div className="flex items-center gap-2">
                        <Icon.Cpu className="w-5 h-5 text-secondary animate-pulse" />
                        <h3 className="font-bold text-secondary">AI Investigator</h3>
                    </div>
                     {!aiResult && (
                        <Button 
                            size="sm" 
                            color="secondary" 
                            variant="flat" 
                            isLoading={aiLoading}
                            onPress={handleGenerateAI}
                        >
                            Analyze Case
                        </Button>
                    )}
                </div>

                {aiLoading && (
                    <div className="space-y-2 animate-pulse">
                         <div className="h-4 bg-secondary/10 rounded w-3/4"></div>
                         <div className="h-4 bg-secondary/10 rounded w-full"></div>
                         <div className="h-4 bg-secondary/10 rounded w-5/6"></div>
                    </div>
                )}

                {aiResult && (
                    <div className="flex flex-col gap-4">
                        {/* Verdict Badge */}
                        <div className="flex justify-between items-center p-3 rounded-lg border border-white/10 bg-white/5">
                            <div>
                                <div className="text-xs text-gray-400">Verdict</div>
                                <div className={`font-bold ${
                                    (aiResult.verdict || '').toLowerCase().includes('true') ? 'text-danger' : 
                                    (aiResult.verdict || '').toLowerCase().includes('false') ? 'text-success' : 'text-warning'
                                }`}>
                                    {aiResult.verdict}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-400">Confidence</div>
                                <div className="font-bold">{aiResult.confidence}%</div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="prose prose-invert prose-sm max-w-none max-h-60 overflow-y-auto">
                             <h3 className="text-sm font-semibold text-gray-300 m-0 mb-2">Executive Summary</h3>
                             <Markdown remarkPlugins={[remarkGfm]}>{aiResult.summary}</Markdown>
                        </div>

                         {/* Evidence Analysis */}
                        {aiResult.evidence_analysis && (
                            <div className="prose prose-invert prose-sm max-w-none max-h-60 overflow-y-auto border-t border-white/10 pt-2">
                                <h3 className="text-sm font-semibold text-gray-300 m-0 mb-2">Evidence Analysis</h3>
                                <Markdown remarkPlugins={[remarkGfm]}>{aiResult.evidence_analysis}</Markdown>
                            </div>
                        )}

                        <div className="mt-2 flex justify-end">
                             <Button size="sm" variant="light" color="secondary" onPress={handleGenerateAI} isLoading={aiLoading} startContent={<Icon.Refresh className="w-3 h-3"/>}>Re-analyze</Button>
                        </div>
                    </div>
                )}

                {aiSuggestion && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                        <div className="flex items-center gap-2 mb-2">
                             <h3 className="text-sm font-semibold text-gray-300">Recommended Action</h3>
                             <Chip size="sm" color="warning" variant="flat">{aiSuggestion.confidence}% Confidence</Chip>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-primary text-sm block mb-1">{aiSuggestion.playbookTitle || 'Unknown Playbook'}</span>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">{aiSuggestion.reasoning}</p>
                            
                            {aiSuggestion.playbookId ? (
                                <Button 
                                    size="sm" 
                                    color="primary" 
                                    className="w-full"
                                    onPress={() => handleRunSuggestion(aiSuggestion.playbookId)}
                                    startContent={<Icon.Cpu className="w-3 h-3" />}
                                >
                                    Run Playbook
                                </Button>
                            ) : (
                                <p className="text-xs text-center text-gray-500 italic">No specific playbook matched.</p>
                            )}
                        </div>
                    </div>
                )}

                {!aiResult && !aiLoading && (
                    <p className="text-xs text-secondary/70">
                        Generates a comprehensive summary, including timeline analysis, severity assessment, and recommended remediation steps.
                    </p>
                )}
            </Card>

            {/* Playbooks */}
            {id && <PlaybookWidget caseId={id} />}

            {/* Evidence Board */}
            {id && <EvidenceWidget caseId={id} />}

            <Card className="p-4 flex flex-col gap-4">
                <h3 className="font-semibold border-b border-gray-700 pb-2">Case Info</h3>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Priority</span>
                    <span>{caseItem.priority}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Assignee</span>
                    <span>{caseItem.assigneeName || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Reporter</span>
                    <span>{user?.email || 'Unknown'}</span>
                </div>
            </Card>

            <Card className="p-4 flex flex-col gap-4">
                <h3 className="font-semibold border-b border-gray-700 pb-2">Attachments</h3>
                
                {/* Upload */}
                <div className="flex gap-2">
                    <input 
                        type="file" 
                        id="file-upload"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !caseItem) return;
                            
                            const formData = new FormData();
                            formData.append('file', file);
                            
                            try {
                                await api.post(`/cases/${caseItem.id}/attachments`, formData, {
                                    headers: { 'Content-Type': 'multipart/form-data' }
                                });
                                fetchCase(); // Refresh
                            } catch (err) {
                                console.error('Upload failed:', err);
                            }
                        }}
                    />
                    <Button 
                        size="sm" 
                        variant="bordered"
                        onPress={() => document.getElementById('file-upload')?.click()}
                        startContent={<Icon.Add className="w-4 h-4" />}
                    >
                        Upload File
                    </Button>
                </div>

                {/* List */}
                <div className="flex flex-col gap-2">
                    {caseItem.attachments?.map((a: any) => (
                        <div key={a.id} className="flex justify-between items-center text-xs p-2 bg-content2/30 rounded">
                            <span className="truncate">{a.fileName}</span>
                            <a 
                                href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${a.fileUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                Download
                            </a>
                        </div>
                    ))}
                    {caseItem.attachments?.length === 0 && <p className="text-gray-500 text-xs text-center py-2">No files yet.</p>}
                </div>
            </Card>
         </div>
      </div>
    </div>
  );
}
