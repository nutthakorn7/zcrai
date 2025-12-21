import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Chip, Select, SelectItem, Textarea, Spinner, Modal, ModalContent, ModalHeader, ModalBody, useDisclosure, Avatar, AvatarGroup, Tooltip, Tabs, Tab, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { Icon } from '../../shared/ui';
import { CasesAPI } from '../../shared/api/cases';
import { PlaybooksAPI } from '../../shared/api/playbooks';
import { useAuth } from '../../shared/store/useAuth';
import { PlaybookWidget } from '../../components/PlaybookWidget';
import { EvidenceWidget } from '../../components/EvidenceWidget';
import { EvidenceTab } from '../../components/EvidenceTab';
import { ForensicsTab } from '../../components/ForensicsTab';
import { InvestigationGraph } from '../../components/InvestigationGraph';
import { useCaseSocket } from '../../shared/hooks/useCaseSocket';
import { ActivityTimeline } from '../../components/cases/ActivityTimeline';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [caseItem, setCaseItem] = useState<any>(null); // Use any for now because fetch returns & { comments: ... }
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [newComment, setNewComment] = useState('');

  // AI State
  const [aiResult, setAiResult] = useState<{ summary: string, verdict: string, confidence: number, evidence_analysis: string } | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchCase = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await CasesAPI.getById(id);
      setCaseItem(data);
    } catch (e) {
      console.error(e);
      // navigate('/cases');
    } finally {
      setLoading(false);
    }
  };

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
          // Refresh? Or show success toast?
          fetchCase(); 
      } catch (e) {
          console.error("Run Playbook Failed", e);
      }
  };

  useEffect(() => {
    fetchCase();
  }, [id]);

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
  
  if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
  if (!caseItem) return <div className="p-10 text-center">Case not found</div>;

  // SLA Logic
  const getSLAHours = (severity: string) => {
    switch(severity.toLowerCase()) {
        case 'critical': return 4;
        case 'high': return 8;
        case 'medium': return 24;
        case 'low': return 48;
        default: return 24;
    }
  };

  const slaDeadline = new Date(new Date(caseItem.createdAt).getTime() + getSLAHours(caseItem.severity) * 60 * 60 * 1000);
  const now = new Date();
  const timeLeftMs = slaDeadline.getTime() - now.getTime();
  const isBreached = timeLeftMs < 0;
  
  const formatTimeLeft = (ms: number) => {
      const absMs = Math.abs(ms);
      const h = Math.floor(absMs / (1000 * 60 * 60));
      const m = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${h}h ${m}m`;
  };

  const { activeUsers, typingUsers, emitTyping } = useCaseSocket(id || '');

  return (
    <div className="p-6 h-full flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
            <Button variant="light" size="sm" startContent={<Icon.ArrowLeft className="w-4 h-4"/>} onPress={() => navigate('/cases')} className="w-fit -ml-3">Back to Board</Button>
            <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{caseItem.title}</h1>
                <Chip color={caseItem.severity === 'critical' ? 'danger' : 'primary'}>{caseItem.severity}</Chip>
                
                {caseItem.status !== 'resolved' && caseItem.status !== 'closed' && (
                    <Chip 
                        variant="flat" 
                        color={isBreached ? "danger" : (timeLeftMs < 3600000 ? "warning" : "success")} // Warning if < 1h
                        startContent={<Icon.Clock className="w-3 h-3" />}
                        className="font-mono"
                    >
                        {isBreached ? `Breached by ${formatTimeLeft(timeLeftMs)}` : `${formatTimeLeft(timeLeftMs)} remaining`}
                    </Chip>
                )}
            </div>
            
            {/* Presence Bar & Meta */}
            <div className="flex items-center gap-4 text-gray-400 text-sm">
                <span>Created by User on {new Date(caseItem.createdAt).toLocaleString()}</span>
                
                {activeUsers.length > 0 && (
                     <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                        <span className="text-xs font-semibold text-primary uppercase tracking-widest">LIVE</span>
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
            </Tabs>
          </div>

         {/* Right: Meta & Evidence */}
         <div className="flex flex-col gap-4">
            
            {/* AI Investigator Widget */}
            <Card className="p-4 border border-secondary/20 bg-secondary/5">
                <div className="flex justify-between items-center mb-4">
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
                             <h4 className="text-sm font-semibold text-gray-300 m-0 mb-2">Executive Summary</h4>
                             <Markdown remarkPlugins={[remarkGfm]}>{aiResult.summary}</Markdown>
                        </div>

                         {/* Evidence Analysis */}
                        {aiResult.evidence_analysis && (
                            <div className="prose prose-invert prose-sm max-w-none max-h-60 overflow-y-auto border-t border-white/10 pt-2">
                                <h4 className="text-sm font-semibold text-gray-300 m-0 mb-2">Evidence Analysis</h4>
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
                             <h4 className="text-sm font-semibold text-gray-300">Recommended Action</h4>
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
                                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/cases/${caseItem.id}/attachments`, {
                                    method: 'POST',
                                    body: formData,
                                    credentials: 'include'
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
