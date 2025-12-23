import React, { useState, useEffect } from 'react';
import { Card, Chip, Tooltip } from '@heroui/react';
import { Icon } from '../../shared/ui';
import { api } from '../../shared/api/api';

// --- TYPES ---
interface AutopilotAction {
  id: string;
  actionType: string;
  target: string;
  status: string;
  triggeredBy: string;
  createdAt: string;
  alertTitle: string;
  alertSeverity: string;
  aiAnalysis: {
    classification: string;
    confidence: number;
    reasoning: string;
  };
  result?: any;
}

interface AutopilotStats {
  totalRemediations: number;
  timeSavedMinutes: number;
  threatsBlocked: number;
}

// --- RADIANT SECURITY STYLE UI ---
const AutopilotPage: React.FC = () => {
  const [actions, setActions] = useState<AutopilotAction[]>([]);
  const [stats, setStats] = useState<AutopilotStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAutopilotData = async () => {
    try {
      const [actionsRes, statsRes] = await Promise.all([
        api.get('/automation/stream'),
        api.get('/automation/stats')
      ]);
      if (actionsRes.data.success) setActions(actionsRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch autopilot data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAutopilotData();
    const interval = setInterval(fetchAutopilotData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      {/* Radiant Header */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="flex justify-between items-end border-b border-white/10 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Autopilot Active</span>
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight">AI Remediations</h1>
          </div>
          <div className="text-right">
            <p className="text-foreground/40 text-sm mb-1 uppercase tracking-widest font-semibold">Total Impact</p>
            <p className="text-4xl font-mono font-bold text-primary">+{stats?.totalRemediations || 0}</p>
          </div>
        </div>
      </div>

      {/* High-Impact Stat Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
         <Card className="bg-[#0A0A0A] border-white/5 rounded-none p-8 flex flex-col gap-2">
            <span className="text-xs font-bold text-foreground/40 tracking-widest uppercase italic">Threats Quarantined</span>
            <span className="text-5xl font-mono text-white leading-tight">{stats?.threatsBlocked || 0}</span>
         </Card>
         <Card className="bg-[#0A0A0A] border-white/5 rounded-none p-8 flex flex-col gap-2 border-l-primary border-l-4">
            <span className="text-xs font-bold text-primary tracking-widest uppercase italic">Analyst Time Saved</span>
            <span className="text-5xl font-mono text-white leading-tight">{Math.floor((stats?.timeSavedMinutes || 0) / 60)}h {(stats?.timeSavedMinutes || 0) % 60}m</span>
         </Card>
         <Card className="bg-[#0A0A0A] border-white/5 rounded-none p-8 flex flex-col gap-2">
            <span className="text-xs font-bold text-foreground/40 tracking-widest uppercase italic">Avg. Response Time</span>
            <span className="text-5xl font-mono text-white leading-tight">1.2s</span>
         </Card>
      </div>

      {/* Incident Cards / AI Journeys */}
      <div className="max-w-6xl mx-auto space-y-12">
        <h2 className="text-sm font-bold tracking-[0.3em] text-foreground/40 uppercase mb-8">Recent Autonomous Journeys</h2>
        
        {actions.map((action) => (
          <div key={action.id} className="relative group">
            {/* Connection Line */}
            <div className="absolute left-[39px] top-20 bottom-0 w-[2px] bg-white/5 group-last:hidden" />
            
            <div className="flex gap-10">
              {/* Outcome Circle */}
              <div className="relative z-10">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 border-[#1A1A1A] bg-[#050505] transition-all duration-500 group-hover:border-primary/50 group-hover:scale-110 shadow-lg ${
                    action.status === 'completed' ? 'text-primary' : 'text-red-500'
                }`}>
                   <Icon.Shield className="w-8 h-8" />
                </div>
              </div>

              {/* Journey Content */}
              <div className="flex-1 pb-16">
                <Card className="bg-[#0A0A0A] border-none rounded-none p-10 hover:bg-[#0D0D0D] transition-colors shadow-2xl">
                  <div className="flex justify-between items-start mb-8">
                     <div>
                        <div className="flex items-center gap-3 mb-2">
                           <Chip className="bg-primary/10 text-primary border-none rounded-none font-bold text-[10px] tracking-widest uppercase">
                              {action.actionType}
                           </Chip>
                           <span className="text-foreground/40 text-xs font-mono">{new Date(action.createdAt).toLocaleTimeString()} • {new Date(action.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-3xl font-bold tracking-tight mb-2">{action.alertTitle}</h3>
                        <p className="text-foreground/60 text-lg flex items-center gap-2">
                           Target Secured: <span className="font-mono text-white">{action.target}</span>
                        </p>
                     </div>
                     <div className="text-right">
                        <Tooltip content="AI Confidence Score">
                           <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest italic">Confidence</span>
                              <span className="text-3xl font-bold font-mono text-primary">{action.aiAnalysis?.confidence || 0}%</span>
                           </div>
                        </Tooltip>
                     </div>
                  </div>

                  {/* AI Reasoning Block */}
                  <div className="bg-[#050505] border border-white/5 p-8 mb-8">
                     <div className="flex items-center gap-3 mb-4">
                        <Icon.Lock className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-primary tracking-widest uppercase italic">Autonomous Reasoning</span>
                     </div>
                     <p className="text-foreground/80 text-xl leading-relaxed italic font-light">
                        "{action.aiAnalysis?.reasoning}"
                     </p>
                  </div>

                  {/* Metadata / Outcome Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                     <div className="border-t border-white/5 pt-4">
                        <p className="text-foreground/40 mb-1 uppercase tracking-widest font-bold text-[10px]">Threat Classification</p>
                        <p className="text-white font-semibold flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                           {action.aiAnalysis?.classification}
                        </p>
                     </div>
                     <div className="border-t border-white/5 pt-4">
                        <p className="text-foreground/40 mb-1 uppercase tracking-widest font-bold text-[10px]">Remediation Status</p>
                        <p className="text-primary font-semibold flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />
                           Successfully {action.status === 'completed' ? 'Executed' : 'Attempted'}
                        </p>
                     </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        ))}

        {actions.length === 0 && !isLoading && (
          <div className="h-[400px] flex flex-col items-center justify-center text-center bg-[#0A0A0A] border border-dashed border-white/5">
            <Icon.Shield className="w-16 h-16 text-white/5 mb-6" />
            <h3 className="text-2xl font-bold text-white/20">System Quiet</h3>
            <p className="text-white/10 max-w-sm">Autonomous SOC is monitoring all channels. No interventions required in the last 24 hours.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutopilotPage;
