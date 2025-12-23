import { Card, CardBody } from '@heroui/react';
import { Icon } from '../shared/ui';
// Logos
import sentineloneLogo from '../assets/logo/sentinelone.png';
import crowdstrikeLogo from '../assets/logo/crowdstrike.png';
import awsLogo from '../assets/logo/aws.png';

interface IntegrationStatus {
    provider: string; // 'sentinelone' | 'crowdstrike' | 'aws-cloudtrail'
    status: 'active' | 'error' | 'inactive';
    lastSync?: string;
    name?: string;
}

interface ConnectivityStatusCardProps {
    integrations: any[]; // Raw data from API
    isConnected?: boolean; // General platform status
}

export function ConnectivityStatusCard({ integrations }: ConnectivityStatusCardProps) {
    
    // Helper to map API data to status
    const getStatus = (provider: string): IntegrationStatus => {
        const integration = integrations.find(i => i.provider === provider && i.status === 'active');
        if (integration) {
            return { provider, status: 'active', lastSync: 'Now', name: integration.name };
        }
        return { provider, status: 'inactive' };
    };

    const providers = ['crowdstrike', 'sentinelone', 'aws-cloudtrail'];
    const statuses = providers.map(getStatus);
    
    // Mock for now if empty (to show potential)
    // In production, we rely on 'integrations' prop.

    const getLogo = (provider: string) => {
        if (provider === 'sentinelone') return sentineloneLogo;
        if (provider === 'crowdstrike') return crowdstrikeLogo;
        if (provider === 'aws-cloudtrail') return awsLogo;
        return '';
    };

    const getStatusColor = (status: string) => {
        if (status === 'active') return 'bg-success/20 text-success border-success/20';
        if (status === 'error') return 'bg-danger/20 text-danger border-danger/20';
        return 'bg-default/20 text-default-400 border-white/5 opacity-50'; // Inactive
    };

  return (
    <Card className="bg-content1/50 backdrop-blur-md border border-white/5">
      <CardBody className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Icon.Signal className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Integration Health</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/60">
             <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
             System Operational
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {statuses.map((item) => (
                <div key={item.provider} className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${getStatusColor(item.status)}`}>
                    <div className="p-2 bg-white rounded-lg">
                        <img src={getLogo(item.provider)} alt={item.provider} className="w-6 h-6 object-contain" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-sm capitalize">{item.provider === 'aws-cloudtrail' ? 'AWS CloudTrail' : item.provider}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${item.status === 'active' ? 'bg-success animate-pulse' : 'bg-default-400'}`} />
                            <span className="text-xs opacity-90 capitalize">{item.status}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </CardBody>
    </Card>
  );
}
