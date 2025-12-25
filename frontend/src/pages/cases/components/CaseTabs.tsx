import { Card, Button, Textarea, Spinner, Tabs, Tab, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip } from "@heroui/react";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from '../../../shared/ui';
import { ActivityTimeline } from '../../../components/cases/ActivityTimeline';
import { EvidenceTab } from '../../../components/EvidenceTab';
import { ForensicsTab } from '../../../components/ForensicsTab';

interface CaseTabsProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    caseItem: any;
    currentUserEmail: string;
    newComment: string;
    setNewComment: (val: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typingUsers: any[];
    onEmitTyping: (isTyping: boolean) => void;
    onComment: () => void;
    onEditComment: (id: string, content: string) => Promise<void>;
    onDeleteComment: (id: string) => Promise<void>;
    
    // Copilot Props
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    copilotMessages: any[];
    copilotQuery: string;
    setCopilotQuery: (val: string) => void;
    copilotLoading: boolean;
    onCopilotChat: () => void;
}

export const CaseTabs = ({
    caseItem,
    currentUserEmail,
    newComment,
    setNewComment,
    typingUsers,
    onEmitTyping,
    onComment,
    onEditComment,
    onDeleteComment,
    copilotMessages,
    copilotQuery,
    setCopilotQuery,
    copilotLoading,
    onCopilotChat
}: CaseTabsProps) => {

    return (
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
                                    onFocus={() => onEmitTyping(true)}
                                    onBlur={() => onEmitTyping(false)}
                                />
                                <Button color="primary" className="h-[64px]" onPress={onComment} isDisabled={!newComment.trim()}>Post</Button>
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
                                currentUserEmail={currentUserEmail}
                                onEditComment={onEditComment}
                                onDeleteComment={onDeleteComment}
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
                                    onCopilotChat();
                                }
                            }}
                            classNames={{ inputWrapper: 'bg-content2/50' }}
                        />
                        <Button 
                            color="secondary" 
                            isIconOnly 
                            onPress={onCopilotChat}
                            isLoading={copilotLoading}
                            isDisabled={!copilotQuery.trim()}
                        >
                            <Icon.ArrowUpRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Tab>
        </Tabs>
    );
};
