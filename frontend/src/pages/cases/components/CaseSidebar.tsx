import { Card, Button, Chip } from "@heroui/react";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PlaybookWidget } from '../../../components/PlaybookWidget';
import { EvidenceWidget } from '../../../components/EvidenceWidget';
import { Icon as UiIcon } from '../../../shared/ui';

interface CaseSidebarProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    caseItem: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aiResult: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aiSuggestion: any;
    aiLoading: boolean;
    onGenerateAI: () => void;
    onRunPlaybook: (id: string) => void;
    onUploadAttachment: (file: File) => void;
}

export const CaseSidebar = ({
    caseItem,
    user,
    aiResult,
    aiSuggestion,
    aiLoading,
    onGenerateAI,
    onRunPlaybook,
    onUploadAttachment
}: CaseSidebarProps) => {

    return (
        <div className="flex flex-col gap-4">
             {/* AI Investigator Widget */}
             <Card className="p-4 border border-secondary/20 bg-secondary/5">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                    <div className="flex items-center gap-2">
                        <UiIcon.Cpu className="w-5 h-5 text-secondary animate-pulse" />
                        <h3 className="text-sm font-bold font-display text-secondary uppercase tracking-wider">AI Investigator</h3>
                    </div>
                     {!aiResult && (
                        <Button 
                            size="sm" 
                            color="secondary" 
                            variant="flat" 
                            isLoading={aiLoading}
                            onPress={onGenerateAI}
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
                                <div className="text-xs text-foreground/60">Verdict</div>
                                <div className={`font-bold ${
                                    (aiResult.verdict || '').toLowerCase().includes('true') ? 'text-danger' : 
                                    (aiResult.verdict || '').toLowerCase().includes('false') ? 'text-success' : 'text-warning'
                                }`}>
                                    {aiResult.verdict}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-foreground/60">Confidence</div>
                                <div className="font-bold">{aiResult.confidence}%</div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="prose prose-invert prose-sm max-w-none max-h-60 overflow-y-auto">
                             <h3 className="text-sm font-semibold text-foreground/70 m-0 mb-2">Executive Summary</h3>
                             <Markdown remarkPlugins={[remarkGfm]}>{aiResult.summary}</Markdown>
                        </div>

                         {/* Evidence Analysis */}
                        {aiResult.evidence_analysis && (
                            <div className="prose prose-invert prose-sm max-w-none max-h-60 overflow-y-auto border-t border-white/10 pt-2">
                                <h3 className="text-sm font-semibold text-foreground/70 m-0 mb-2">Evidence Analysis</h3>
                                <Markdown remarkPlugins={[remarkGfm]}>{aiResult.evidence_analysis}</Markdown>
                            </div>
                        )}

                        <div className="mt-2 flex justify-end">
                             <Button size="sm" variant="light" color="secondary" onPress={onGenerateAI} isLoading={aiLoading} startContent={<UiIcon.Refresh className="w-3 h-3"/>}>Re-analyze</Button>
                        </div>
                    </div>
                )}

                {aiSuggestion && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                        <div className="flex items-center gap-2 mb-2">
                             <h3 className="text-sm font-semibold text-foreground/70">Recommended Action</h3>
                             <Chip size="sm" color="warning" variant="flat">{aiSuggestion.confidence}% Confidence</Chip>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-primary text-sm block mb-1">{aiSuggestion.playbookTitle || 'Unknown Playbook'}</span>
                            </div>
                            <p className="text-xs text-foreground/60 mb-3">{aiSuggestion.reasoning}</p>
                            
                            {aiSuggestion.playbookId ? (
                                <Button 
                                    size="sm" 
                                    color="primary" 
                                    className="w-full"
                                    onPress={() => onRunPlaybook(aiSuggestion.playbookId)}
                                    startContent={<UiIcon.Cpu className="w-3 h-3" />}
                                >
                                    Run Playbook
                                </Button>
                            ) : (
                                <p className="text-xs text-center text-foreground/50 italic">No specific playbook matched.</p>
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
            <PlaybookWidget caseId={caseItem.id} />

            {/* Evidence Board */}
            <EvidenceWidget caseId={caseItem.id} />

            <Card className="p-4 flex flex-col gap-4">
                <h3 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2">Case Info</h3>
                <div className="flex justify-between text-sm">
                    <span className="text-foreground/60">Priority</span>
                    <span>{caseItem.priority}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-foreground/60">Assignee</span>
                    <span>{caseItem.assigneeName || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-foreground/60">Reporter</span>
                    <span>{user?.email || 'Unknown'}</span>
                </div>
            </Card>

            <Card className="p-4 flex flex-col gap-4">
                <h3 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] border-b border-white/5 pb-2">Attachments</h3>
                
                {/* Upload */}
                <div className="flex gap-2">
                    <input 
                        type="file" 
                        id="file-upload"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUploadAttachment(file);
                        }}
                    />
                    <Button 
                        size="sm" 
                        variant="bordered"
                        onPress={() => document.getElementById('file-upload')?.click()}
                        startContent={<UiIcon.Add className="w-4 h-4" />}
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
                    {caseItem.attachments?.length === 0 && <p className="text-foreground/50 text-xs text-center py-2">No files yet.</p>}
                </div>
            </Card>
        </div>
    );
};
