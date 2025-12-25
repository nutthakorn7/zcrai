import React, { useState, useEffect } from 'react';
import { Card, CardBody, Chip, Progress, Tooltip } from '@heroui/react';
import { Icon } from '../../shared/ui';
import { api } from '../../shared/api';
import { StatCard } from '../../shared/ui/StatCard';
import { SEVERITY_COLORS } from '../../shared/config/theme';

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

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return SEVERITY_COLORS.critical;
      case 'high': return SEVERITY_COLORS.high;
      case 'medium': return SEVERITY_COLORS.medium;
      default: return SEVERITY_COLORS.low;
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-success uppercase tracking-wider">Autopilot Active</span>
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">AI Autopilot</h1>
          <p className="text-foreground/60 text-sm mt-1">Autonomous threat remediation powered by AI</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Threats Blocked"
          value={stats?.threatsBlocked || 0}
          className="border-l-4 border-l-primary"
        />
        <StatCard
          label="Time Saved"
          value={`${Math.floor((stats?.timeSavedMinutes || 0) / 60)}h ${(stats?.timeSavedMinutes || 0) % 60}m`}
          className="border-l-4 border-l-success"
        />
        <StatCard
          label="Total Remediations"
          value={stats?.totalRemediations || 0}
          className="border-l-4 border-l-secondary"
        />
      </div>

      {/* Actions List */}
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Icon.Zap className="w-4 h-4 text-default-500" />
          <h2 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">Recent Actions</h2>
          <Chip size="sm" variant="flat" className="bg-default-100">{actions.length}</Chip>
        </div>

        <div className="space-y-4 overflow-y-auto h-[calc(100%-40px)] custom-scrollbar pr-2">
          {actions.map((action) => (
            <Card 
              key={action.id} 
              className="bg-content1 border border-white/5 hover:border-primary/30 transition-all"
            >
              <CardBody className="p-5">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    action.status === 'completed' 
                      ? 'bg-success/10 text-success' 
                      : 'bg-danger/10 text-danger'
                  }`}>
                    {action.status === 'completed' 
                      ? <Icon.Check className="w-6 h-6" />
                      : <Icon.Alert className="w-6 h-6" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Chip 
                        size="sm" 
                        variant="flat"
                        style={{
                          backgroundColor: `${getSeverityColor(action.alertSeverity)}1A`,
                          color: getSeverityColor(action.alertSeverity),
                          borderColor: `${getSeverityColor(action.alertSeverity)}33`,
                        }}
                        className="border capitalize"
                      >
                        {action.alertSeverity}
                      </Chip>
                      <Chip size="sm" variant="flat" className="bg-default-100 uppercase text-[10px] font-bold">
                        {action.actionType.replace(/_/g, ' ')}
                      </Chip>
                      <span className="text-xs text-default-400 font-mono">
                        {new Date(action.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <h3 className="font-semibold text-foreground mb-1 truncate">{action.alertTitle}</h3>
                    
                    <p className="text-sm text-default-500 flex items-center gap-2">
                      <Icon.Shield className="w-3.5 h-3.5" />
                      Target: <span className="font-mono text-foreground">{action.target}</span>
                    </p>

                    {/* AI Reasoning */}
                    {action.aiAnalysis?.reasoning && (
                      <div className="mt-3 p-3 bg-default-50 rounded-lg border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon.Cpu className="w-3.5 h-3.5 text-primary" />
                           <span className="text-[10px] font-bold font-display text-primary uppercase tracking-[0.2em]">AI Reasoning</span>
                        </div>
                        <p className="text-sm text-default-600 italic">"{action.aiAnalysis.reasoning}"</p>
                      </div>
                    )}

                    {/* Confidence */}
                    {action.aiAnalysis?.confidence && (
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-xs text-default-400">Confidence</span>
                        <Progress 
                          size="sm" 
                          value={action.aiAnalysis.confidence} 
                          color={action.aiAnalysis.confidence > 80 ? 'success' : action.aiAnalysis.confidence > 50 ? 'warning' : 'danger'}
                          className="flex-1 max-w-[200px]"
                        />
                        <span className="text-xs font-mono font-bold text-foreground">{action.aiAnalysis.confidence}%</span>
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <Tooltip content={action.status === 'completed' ? 'Action completed successfully' : 'Action failed'}>
                    <Chip 
                      size="sm" 
                      color={action.status === 'completed' ? 'success' : 'danger'}
                      variant="flat"
                      className="capitalize"
                    >
                      {action.status}
                    </Chip>
                  </Tooltip>
                </div>
              </CardBody>
            </Card>
          ))}

          {actions.length === 0 && !isLoading && (
            <Card className="bg-content1 border border-dashed border-white/10">
              <CardBody className="py-16 flex flex-col items-center justify-center text-center">
                <Icon.Shield className="w-16 h-16 text-default-200 mb-4" />
                <h3 className="text-lg font-semibold text-default-400 mb-2">No Actions Yet</h3>
                <p className="text-sm text-default-400 max-w-md">
                  The AI Autopilot is monitoring all channels. Automated remediations will appear here when triggered.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutopilotPage;
