import { Card, CardBody, Chip, Skeleton } from '@heroui/react';
import { Icon } from '../../../shared/ui';

interface Integration {
  id: string;
  provider: string;
  label: string | null;
  healthStatus: 'healthy' | 'degraded' | 'down';
  lastSyncAt: string | null;
  tokenExpiresAt?: string | null;
}

interface IntegrationHealthWidgetProps {
  integrations: Integration[];
  loading?: boolean;
}

export function IntegrationHealthWidget({ integrations, loading }: IntegrationHealthWidgetProps) {
  if (loading) {
    return (
      <Card className="bg-content1/50 border border-white/5 h-full">
        <CardBody className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="w-32 h-6 rounded-lg" />
            <Skeleton className="w-16 h-6 rounded-full" />
          </div>
          <div className="space-y-3">
             <Skeleton className="w-full h-12 rounded-xl" />
             <Skeleton className="w-full h-12 rounded-xl" />
             <Skeleton className="w-full h-12 rounded-xl" />
          </div>
        </CardBody>
      </Card>
    );
  }

  // Calculate stats
  const total = integrations.length;
  const healthy = integrations.filter(i => i.healthStatus === 'healthy').length;
  const down = integrations.filter(i => i.healthStatus === 'down').length;
  const degraded = integrations.filter(i => i.healthStatus === 'degraded').length;

  // Find expiring tokens
  const now = new Date();
  const warningDays = 7;
  const expiring = integrations.filter(i => {
    if (!i.tokenExpiresAt) return false;
    const expiry = new Date(i.tokenExpiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= warningDays;
  });

  // Calculate health score (simple %)
  const healthScore = total > 0 ? Math.round((healthy / total) * 100) : 100;
  
  // Determine overall status
  let statusColor = 'text-success';
  let statusText = 'Systems Operational';
  let StatusIcon = Icon.Check;

  if (down > 0) {
    statusColor = 'text-danger';
    statusText = 'Critical Issues Detected';
    StatusIcon = Icon.XCircle;
  } else if (degraded > 0 || expiring.length > 0) {
    statusColor = 'text-warning';
    statusText = 'Attention Needed';
    StatusIcon = Icon.Alert;
  }

  return (
    <Card className="bg-content1/50 border border-white/5 backdrop-blur-sm h-full">
      <CardBody className="p-4 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
                statusColor === 'text-success' ? 'bg-success/10' : 
                statusColor === 'text-danger' ? 'bg-danger/10' : 'bg-warning/10'
            }`}>
              <StatusIcon className={`w-5 h-5 ${statusColor}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">System Health</h3>
              <p className={`text-xs ${statusColor} font-medium`}>{statusText}</p>
            </div>
          </div>
          <div className="text-right">
             <span className="text-2xl font-bold font-display">{healthScore}%</span>
             <p className="text-[10px] text-foreground/50 uppercase tracking-wider">Uptime</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-6">
           <div className="p-2 rounded-xl bg-default-100/50 border border-white/5 text-center">
              <span className="text-lg font-bold text-success">{healthy}</span>
              <p className="text-[10px] text-foreground/50">Active</p>
           </div>
           <div className="p-2 rounded-xl bg-default-100/50 border border-white/5 text-center">
              <span className={`text-lg font-bold ${degraded > 0 ? 'text-warning' : 'text-default-400'}`}>{degraded}</span>
              <p className="text-[10px] text-foreground/50">Degraded</p>
           </div>
           <div className="p-2 rounded-xl bg-default-100/50 border border-white/5 text-center">
              <span className={`text-lg font-bold ${down > 0 ? 'text-danger' : 'text-default-400'}`}>{down}</span>
              <p className="text-[10px] text-foreground/50">Down</p>
           </div>
        </div>

        {/* Issues List - Only show if there are issues */}
        <div className="flex-1 overflow-y-auto min-h-[100px] space-y-2 pr-1 custom-scrollbar">
           {(down === 0 && degraded === 0 && expiring.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-white/10 rounded-xl">
                 <Icon.Shield className="w-8 h-8 text-success/20 mb-2" />
                 <p className="text-xs text-foreground/50">All systems operational</p>
              </div>
           ) : (
              <>
                {/* Down Integrations */}
                {integrations.filter(i => i.healthStatus === 'down').map(i => (
                  <div key={i.id} className="flex items-center justify-between p-2 rounded-lg bg-danger/10 border border-danger/20">
                     <div className="flex items-center gap-2">
                        <Icon.XCircle className="w-4 h-4 text-danger" />
                        <span className="text-xs font-medium text-danger-foreground">{i.label || i.provider}</span>
                     </div>
                     <Chip size="sm" variant="solid" color="danger" className="h-5 text-[10px]">Down</Chip>
                  </div>
                ))}
                
                {/* Expiring Integrations */}
                {expiring.map(i => {
                    const days = Math.ceil((new Date(i.tokenExpiresAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={'exp-' + i.id} className="flex items-center justify-between p-2 rounded-lg bg-warning/10 border border-warning/20">
                         <div className="flex items-center gap-2">
                            <Icon.Clock className="w-4 h-4 text-warning" />
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-warning-foreground">{i.label || i.provider}</span>
                                <span className="text-[10px] text-warning">Expires in {days} days</span>
                            </div>
                         </div>
                         <Chip size="sm" variant="flat" color="warning" className="h-5 text-[10px]">Renew</Chip>
                      </div>
                    );
                })}
              </>
           )}
        </div>
      </CardBody>
    </Card>
  );
}
