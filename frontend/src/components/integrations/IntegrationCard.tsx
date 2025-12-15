// IntegrationCard Component - Displays active or unconfigured integration cards
import { Card, CardBody, Button, Chip } from "@heroui/react";
import { Icon } from '../../shared/ui';
import { Integration, PROVIDER_CONFIG, PROVIDER_LOGOS, getColorClasses } from './integration.types';

interface IntegrationCardProps {
  integration?: Integration;
  provider: string;
  onEdit: (integration: Integration) => void;
  onDelete: (id: string, provider: string) => void;
  onAdd: (type: 's1' | 'cs' | 'ai' | 'enrichment' | 'aws' | 'm365', provider?: string) => void;
}

const getModalType = (provider: string): 's1' | 'cs' | 'ai' | 'enrichment' | 'aws' | 'm365' => {
  switch (provider) {
    case 'sentinelone': return 's1';
    case 'crowdstrike': return 'cs';
    case 'aws': case 'aws-cloudtrail': return 'aws';
    case 'm365': return 'm365';
    case 'virustotal': case 'abuseipdb': case 'alienvault': return 'enrichment';
    case 'openai': case 'claude': case 'gemini': return 'ai';
    default: return 'aws';
  }
};

export function IntegrationCard({ integration, provider, onEdit, onDelete, onAdd }: IntegrationCardProps) {
  const config = PROVIDER_CONFIG[provider] || { name: provider, color: 'default', gradient: '', description: '' };
  const colors = getColorClasses(config.color);
  const logo = PROVIDER_LOGOS[provider];

  if (integration) {
    // Active Card
    return (
      <Card className={`bg-gradient-to-br ${config.gradient} border transition-all duration-300 ${colors.border}`}>
        <CardBody className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl ${colors.bgLight} flex items-center justify-center`}>
              {logo ? (
                <img src={logo} alt={provider} className="w-6 h-6" />
              ) : (
                <Icon.Cloud className={`w-6 h-6 ${colors.text}`} />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{config.name}</h3>
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              </div>
              <p className="text-xs text-default-400 capitalize">{integration.label}</p>
            </div>
            <Chip 
              size="sm" 
              color={integration.lastSyncStatus === 'success' ? "success" : "warning"} 
              variant="dot" 
              classNames={{ 
                base: `border-none ${colors.bgLight}`, 
                content: `${colors.text} font-medium` 
              }}
            >
              {integration.lastSyncStatus === 'success' ? 'Active' : 'Syncing'}
            </Chip>
          </div>
          
          <p className="text-xs text-default-600 mb-4 line-clamp-2">
            {config.description}
          </p>

          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="flat" 
              className={`flex-1 ${colors.bgLight} ${colors.bgHover} ${colors.text}`} 
              onPress={() => onEdit(integration)}
            >
              Configure
            </Button>
            <Button 
              size="sm" 
              variant="flat" 
              className="bg-danger/10 hover:bg-danger/20 text-danger" 
              isIconOnly 
              onPress={() => onDelete(integration.id, integration.provider)}
            >
              <Icon.Delete className="w-4 h-4" />
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Unconfigured Card
  return (
    <button
      onClick={() => onAdd(getModalType(provider), provider)}
      className={`group relative overflow-hidden rounded-xl 
                 border transition-all duration-300 p-4 text-left h-full
                 ${colors.border} bg-gradient-to-br ${config.gradient}
                 active:scale-[0.98]`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${colors.bgLight}`}>
          {logo ? (
            <img src={logo} alt={provider} className="w-7 h-7" />
          ) : (
            <Icon.Cloud className={`w-7 h-7 ${colors.text}`} />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-sm">{config.name}</h3>
          <p className="text-xs text-default-500">{config.description}</p>
        </div>
      </div>
      
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className={`text-xs ${colors.text} flex items-center gap-1`}>
          <span>Connect</span>
          <Icon.ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </button>
  );
}

// AI Provider Card Component
interface AIProviderCardProps {
  provider: string;
  integration?: Integration;
  onEdit: (integration: Integration) => void;
  onDelete: (id: string, provider: string) => void;
  onAdd: (type: 's1' | 'cs' | 'ai' | 'enrichment' | 'aws' | 'm365', provider?: string) => void;
}

export function AIProviderCard({ provider, integration, onEdit, onDelete, onAdd }: AIProviderCardProps) {
  const config = PROVIDER_CONFIG[provider] || { name: provider, color: 'default', gradient: '', description: '' };
  const colors = getColorClasses(config.color);
  const logo = PROVIDER_LOGOS[provider];

  if (integration) {
    return (
      <Card className={`bg-gradient-to-br ${config.gradient} border ${colors.border}`}>
        <CardBody className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl ${colors.bgLight} flex items-center justify-center`}>
              {logo ? (
                <img src={logo} alt={provider} className="w-6 h-6" />
              ) : (
                <Icon.Settings className={`w-6 h-6 ${colors.text}`} />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">{config.name}</h3>
              <p className="text-xs text-default-400">{integration.label}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="flat" className={`flex-1 ${colors.bgLight} ${colors.text}`} onPress={() => onEdit(integration)}>
              Edit
            </Button>
            <Button size="sm" variant="flat" className="bg-danger/10 text-danger" isIconOnly onPress={() => onDelete(integration.id, provider)}>
              <Icon.Delete className="w-4 h-4" />
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <button
      onClick={() => onAdd('ai', provider)}
      className={`group rounded-xl border ${colors.border} p-4 text-left bg-gradient-to-br ${config.gradient} hover:scale-[1.02] transition-all`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${colors.bgLight} flex items-center justify-center`}>
          {logo ? (
            <img src={logo} alt={provider} className="w-6 h-6" />
          ) : (
            <Icon.Settings className={`w-6 h-6 ${colors.text}`} />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-sm">{config.name}</h3>
          <p className="text-xs text-default-500">{config.description}</p>
        </div>
      </div>
    </button>
  );
}

// Enrichment Provider Card
export function EnrichmentCard({ provider, integration, onEdit, onDelete, onAdd }: AIProviderCardProps) {
  const config = PROVIDER_CONFIG[provider] || { name: provider, color: 'default', gradient: '', description: '' };
  const colors = getColorClasses(config.color);

  if (integration) {
    return (
      <Card className={`bg-gradient-to-br ${config.gradient} border ${colors.border}`}>
        <CardBody className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl ${colors.bgLight} flex items-center justify-center`}>
              <Icon.Database className={`w-6 h-6 ${colors.text}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">{config.name}</h3>
              <p className="text-xs text-success">Connected</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="flat" className={`flex-1 ${colors.bgLight} ${colors.text}`} onPress={() => onEdit(integration)}>
              Configure
            </Button>
            <Button size="sm" variant="flat" className="bg-danger/10 text-danger" isIconOnly onPress={() => onDelete(integration.id, provider)}>
              <Icon.Delete className="w-4 h-4" />
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <button
      onClick={() => onAdd('enrichment', provider)}
      className={`group rounded-xl border ${colors.border} p-4 text-left bg-gradient-to-br ${config.gradient} hover:scale-[1.02] transition-all`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${colors.bgLight} flex items-center justify-center`}>
          <Icon.Database className={`w-6 h-6 ${colors.text}`} />
        </div>
        <div>
          <h3 className="font-semibold text-sm">{config.name}</h3>
          <p className="text-xs text-default-500">{config.description}</p>
        </div>
      </div>
    </button>
  );
}
