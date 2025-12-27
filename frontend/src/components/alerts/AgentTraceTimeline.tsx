import { useState, useEffect } from 'react';
import { Spinner, Chip, Accordion, AccordionItem } from '@heroui/react';
import { api } from '../../shared/api';
import { BrainCircuit, Search, Database } from 'lucide-react';

interface AgentTrace {
  id: string;
  agentName: string;
  thought?: string;
  action?: any;
  observation?: any;
  createdAt: string;
}

interface AgentTraceTimelineProps {
  alertId: string;
}

export function AgentTraceTimeline({ alertId }: AgentTraceTimelineProps) {
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTraces();
  }, [alertId]);

  const fetchTraces = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/ai/traces/alert/${alertId}`);
      setTraces(response.data.data);
    } catch (error) {
      console.error('Failed to fetch AI traces:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Spinner size="sm" color="primary" />
        <p className="text-xs text-foreground/40 font-mono">Retrieving agent thought process...</p>
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="text-center py-8 bg-black/20 rounded-xl border border-white/5 border-dashed">
        <p className="text-xs text-foreground/40 italic">No reasoning traces found for this investigation yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
      {traces.map((trace, idx) => {
        const isManager = trace.agentName === 'Manager';
        const isThought = !!trace.thought;

        return (
          <div key={trace.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
            {/* Dot */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-content1 shadow-lg z-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              {isThought ? (
                <BrainCircuit className={`w-5 h-5 ${isManager ? 'text-primary' : 'text-purple-400'}`} />
              ) : (
                <Search className="w-5 h-5 text-indigo-400" />
              )}
            </div>

            {/* Content */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl bg-content2/30 border border-white/5 group-hover:border-white/10 transition-all shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{trace.agentName}</span>
                  <Chip size="sm" variant="flat" color={isThought ? 'primary' : 'secondary'} className="h-4 text-[9px] uppercase font-bold">
                    {isThought ? 'Thinking' : 'Observation'}
                  </Chip>
                </div>
                <time className="text-[9px] font-mono text-foreground/30">{new Date(trace.createdAt).toLocaleTimeString()}</time>
              </div>

              {trace.thought && (
                <p className="text-xs text-foreground/90 leading-relaxed italic mb-2">
                   "{trace.thought}"
                </p>
              )}

              {trace.action && (
                <div className="mt-3 p-2 bg-black/40 rounded border border-white/5">
                   <p className="text-[10px] text-primary/70 font-bold mb-1 uppercase tracking-tighter">Tools Dispatched:</p>
                   <div className="flex flex-wrap gap-1">
                      {Array.isArray(trace.action) ? trace.action.map((a: any, i: number) => (
                        <Chip key={i} size="sm" variant="dot" className="bg-transparent border-white/10 text-[9px] h-5">{a.tool || a.agent}</Chip>
                      )) : <Chip size="sm" variant="dot" className="bg-transparent border-white/10 text-[9px] h-5">{trace.action.tool}</Chip>}
                   </div>
                </div>
              )}

              {trace.observation && (
                <Accordion className="px-0" variant="splitted" itemClasses={{
                  base: "bg-transparent border-none shadow-none mt-2",
                  trigger: "py-0 px-2 h-6 hover:bg-white/5 rounded transition-colors",
                  title: "text-[10px] font-bold text-foreground/50",
                  content: "px-0 pb-0"
                }}>
                  <AccordionItem 
                    key="obs" 
                    aria-label="View Details" 
                    title="VIEW FINDINGS"
                    startContent={<Database className="w-3 h-3 text-indigo-400" />}
                  >
                    <div className="bg-[#0D0E11] p-3 rounded border border-white/10 mt-1 max-h-48 overflow-y-auto">
                      <pre className="text-[9px] text-green-400 font-mono leading-tight whitespace-pre-wrap">
                        {JSON.stringify(trace.observation, null, 2)}
                      </pre>
                    </div>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
