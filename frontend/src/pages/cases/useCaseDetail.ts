import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDisclosure } from '@heroui/react';
import { CasesAPI, PlaybooksAPI, api } from '@/shared/api';
import { useCaseSocket } from '../../shared/hooks/useCaseSocket';
import { useAuth } from '../../shared/store/useAuth';

export const useCaseDetail = (caseId: string | undefined) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Socket
    const { activeUsers, typingUsers, emitTyping } = useCaseSocket(caseId || '');

    // State
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [caseItem, setCaseItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    
    // Sync Modal State
    const { isOpen: isGraphOpen, onOpen: onGraphOpen, onClose: onGraphClose } = useDisclosure();
    const { isOpen: isSyncOpen, onOpen: onSyncOpen, onClose: onSyncClose } = useDisclosure();
    const [syncSystem, setSyncSystem] = useState<'jira'|'servicenow'>('jira');
    const [syncing, setSyncing] = useState(false);

    // AI State
    const [aiResult, setAiResult] = useState<{ summary: string, verdict: string, confidence: number, evidence_analysis: string } | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [aiSuggestion, setAiSuggestion] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);

    // Copilot State
    const [copilotMessages, setCopilotMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
    const [copilotQuery, setCopilotQuery] = useState('');
    const [copilotLoading, setCopilotLoading] = useState(false);

    // Comment State
    const [newComment, setNewComment] = useState('');

    const fetchCase = useCallback(async () => {
        if (!caseId) return;
        try {
            setLoading(true);
            const data = await CasesAPI.getById(caseId);
            setCaseItem(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [caseId]);

    useEffect(() => {
        fetchCase();
    }, [fetchCase]);

    // Actions
    const handleExportPDF = async () => {
        if (!caseItem) return;
        try {
            setExporting(true);
            const blob = await CasesAPI.exportPDF(caseItem.id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `case-${caseItem.id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to export PDF:', e);
        } finally {
            setExporting(false);
        }
    };

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

    const handleStatusChange = async (newStatus: string) => {
        if (!caseItem) return;
        await CasesAPI.update(caseItem.id, { status: newStatus });
        fetchCase();
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
            fetchCase(); 
        } catch (e) {
            console.error("Run Playbook Failed", e);
        }
    };

    const handleCopilotChat = async () => {
        if (!copilotQuery.trim() || !caseItem) return;
        
        const userMessage = { role: 'user' as const, content: copilotQuery };
        setCopilotMessages(prev => [...prev, userMessage]);
        setCopilotMessages(prev => [...prev, { role: 'ai', content: '' }]); // Placeholder
        setCopilotQuery('');
        setCopilotLoading(true);
        
        try {
            const caseContext = `
Case: ${caseItem.title}
Severity: ${caseItem.severity}
Status: ${caseItem.status}
Description: ${caseItem.description || 'N/A'}
Alerts: ${caseItem.alerts?.map((a: any) => `[${a.severity}] ${a.title}`).join(', ') || 'None'}
Evidence: ${caseItem.evidence?.length || 0} items
`;
            
            const { AIAPI } = await import('../../shared/api/ai');
            AIAPI.streamChat([...copilotMessages, userMessage], caseContext, (chunk) => {
                setCopilotMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.role === 'ai') {
                        lastMsg.content += chunk;
                    }
                    return newMessages;
                });
                setCopilotLoading(false);
            });
        } catch (e: any) {
            setCopilotMessages(prev => [...prev, { role: 'ai', content: `Error: ${e.message}` }]);
            setCopilotLoading(false);
        }
    };

    const handleComment = async (content: string) => {
        if (!caseItem) return;
        await CasesAPI.addComment(caseItem.id, content);
        fetchCase();
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

    const handleUploadAttachment = async (file: File) => {
        if (!caseItem) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            await api.post(`/cases/${caseItem.id}/attachments`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchCase();
        } catch (err) {
            console.error('Upload failed:', err);
        }
    };

    return {
        // Data
        caseItem,
        loading,
        user,
        activeUsers,
        typingUsers,
        
        // UI State
        exporting,
        isGraphOpen,
        onGraphOpen,
        onGraphClose,
        isSyncOpen,
        onSyncOpen,
        onSyncClose,
        syncSystem,
        setSyncSystem,
        syncing,

        // AI State
        aiResult,
        aiSuggestion,
        aiLoading,
        copilotMessages,
        copilotQuery,
        setCopilotQuery,
        copilotLoading,

        // Handlers
        navigate,
        emitTyping,
        fetchCase,
        handleExportPDF,
        handleSyncTicket,
        handleStatusChange,
        handleGenerateAI,
        handleRunSuggestion,
        handleCopilotChat,
        handleComment,
        handleEditComment,
        handleDeleteComment,
        handleUploadAttachment,
        newComment,
        setNewComment
    };
};
