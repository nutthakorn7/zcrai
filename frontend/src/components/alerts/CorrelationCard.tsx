import { Card, CardBody, Chip } from '@heroui/react';
import { AlertCorrelation, Alert } from '../../shared/api/alerts';
import { Icon } from '../../shared/ui';

interface CorrelationCardProps {
  correlation: AlertCorrelation;
  onViewAlert: (alertId: string) => void;
}

const getReasonLabel = (reason: string): string => {
  const labels: Record<string, string> = {
    time_window: 'Occurred within 1 hour',
    same_source_severity: 'Same source & severity',
    same_ioc: 'Shared IOC',
  };
  return labels[reason] || reason;
};

const getReasonIcon = (reason: string) => {
  switch (reason) {
    case 'time_window':
      return <Icon.Clock className="w-4 h-4" />;
    case 'same_source_severity':
      return <Icon.Shield className="w-4 h-4" />;
    case 'same_ioc':
      return <Icon.Alert className="w-4 h-4" />;
    default:
      return <Icon.Signal className="w-4 h-4" />;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'warning';
    case 'medium':
      return 'primary';
    case 'low':
      return 'success';
    default:
      return 'default';
  }
};

export function CorrelationCard({ correlation, onViewAlert }: CorrelationCardProps) {
  const confidencePercent = Math.round(parseFloat(correlation.confidence) * 100);
  const confidenceColor = confidencePercent >= 70 ? 'warning' : 'default';

  return (
    <div className="border-l-2 border-warning/50 pl-4 mb-4">
      {/* Correlation Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1 text-sm text-foreground/60">
          {getReasonIcon(correlation.reason)}
          <span>{getReasonLabel(correlation.reason)}</span>
        </div>
        <Chip size="sm" variant="flat" color={confidenceColor as any}>
          {confidencePercent}% confidence
        </Chip>
      </div>

      {/* Related Alerts */}
      <div className="space-y-2">
        {correlation.relatedAlerts && correlation.relatedAlerts.length > 0 ? (
          correlation.relatedAlerts.map((alert: Alert) => (
            <Card
              key={alert.id}
              isPressable
              onPress={() => onViewAlert(alert.id)}
              className="border border-white/5 bg-content2/30 hover:bg-content2/50 transition-all cursor-pointer"
            >
              <CardBody className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Chip 
                        size="sm" 
                        variant="flat" 
                        color={getSeverityColor(alert.severity) as any}
                        className="h-5"
                      >
                        {alert.severity}
                      </Chip>
                      <span className="text-xs text-foreground/60">{alert.source}</span>
                    </div>
                    <h4 className="text-sm font-medium text-foreground line-clamp-1">
                      {alert.title}
                    </h4>
                    <p className="text-xs text-foreground/60 mt-1 line-clamp-1">
                      {alert.description}
                    </p>
                  </div>
                  <Icon.ArrowUpRight className="w-4 h-4 text-foreground/40 flex-shrink-0 mt-1" />
                </div>
                
                {/* Footer info */}
                <div className="flex items-center gap-3 mt-2 text-xs text-foreground/50">
                  <span title={new Date(alert.createdAt).toLocaleString()}>
                    {new Date(alert.createdAt).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                  {alert.duplicateCount && alert.duplicateCount > 1 && (
                    <Chip size="sm" variant="flat" className="h-4 text-[10px]">
                      {alert.duplicateCount}x duplicates
                    </Chip>
                  )}
                </div>
              </CardBody>
            </Card>
          ))
        ) : (
          <p className="text-sm text-foreground/50 italic">
            {correlation.relatedAlertIds.length} related alert(s), details unavailable
          </p>
        )}
      </div>
    </div>
  );
}
