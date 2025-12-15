import { useEffect, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Card,
  CardHeader,
  CardBody,
  Chip,
  Spinner,
  Divider
} from '@heroui/react';
import { Alert, AlertCorrelation, AlertsAPI } from '../../shared/api/alerts';
import { CorrelationCard } from './CorrelationCard';
import { Icon } from '../../shared/ui';

interface AlertDetailModalProps {
  alert: Alert | null;
  isOpen: boolean;
  onClose: () => void;
}

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'new':
      return 'primary';
    case 'investigating':
      return 'warning';
    case 'resolved':
      return 'success';
    case 'dismissed':
      return 'default';
    default:
      return 'default';
  }
};

export function AlertDetailModal({ alert, isOpen, onClose }: AlertDetailModalProps) {
  const [correlations, setCorrelations] = useState<AlertCorrelation[]>([]);
  const [isLoadingCorrelations, setIsLoadingCorrelations] = useState(false);

  useEffect(() => {
    if (alert && isOpen) {
      loadCorrelations();
    }
  }, [alert, isOpen]);

  const loadCorrelations = async () => {
    if (!alert) return;
    
    try {
      setIsLoadingCorrelations(true);
      const data = await AlertsAPI.getCorrelations(alert.id);
      setCorrelations(data);
    } catch (error) {
      console.error('Failed to load correlations:', error);
    } finally {
      setIsLoadingCorrelations(false);
    }
  };

  const handleViewRelatedAlert = (alertId: string) => {
    // Navigate to the related alert (you can enhance this later)
    window.location.href = `/alerts?id=${alertId}`;
  };

  if (!alert) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      className="bg-content1 border border-white/10"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-3 border-b border-white/5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Chip size="sm" variant="flat" color={getSeverityColor(alert.severity) as any}>
                    {alert.severity}
                  </Chip>
                  <Chip size="sm" variant="flat" color={getStatusColor(alert.status) as any}>
                    {alert.status}
                  </Chip>
                  <Chip size="sm" variant="flat">
                    {alert.source}
                  </Chip>
                </div>
                <h3 className="text-lg font-semibold">{alert.title}</h3>
              </div>
              <Button
                isIconOnly
                variant="light"
                onPress={onClose}
              >
                <Icon.Close className="w-5 h-5" />
              </Button>
            </ModalHeader>

            <ModalBody className="p-6">
              {/* Alert Details */}
              <Card className="bg-content2/50 border border-white/5 mb-4">
                <CardBody className="p-4">
                  <h4 className="text-sm font-semibold mb-2">Description</h4>
                  <p className="text-sm text-foreground/80">{alert.description}</p>
                  
                  <Divider className="my-3" />
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-foreground/60">Created:</span>{' '}
                      <span className="font-medium">
                        {new Date(alert.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-foreground/60">Last Seen:</span>{' '}
                      <span className="font-medium">
                        {alert.lastSeenAt 
                          ? new Date(alert.lastSeenAt).toLocaleString()
                          : 'N/A'
                        }
                      </span>
                    </div>
                    {alert.duplicateCount && alert.duplicateCount > 1 && (
                      <div>
                        <span className="text-foreground/60">Duplicate Count:</span>{' '}
                        <Chip size="sm" variant="flat" color="warning">
                          {alert.duplicateCount}x
                        </Chip>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>

              {/* AI Investigation Report */}
              {alert.aiAnalysis?.investigationReport && (
                <Card className="bg-content2/50 border border-white/5 mb-4">
                  <CardHeader className="border-b border-white/5 px-4 py-3 flex gap-2">
                    <Icon.Search className="w-5 h-5 text-primary" />
                    <h4 className="text-sm font-semibold">Automated Investigation Report</h4>
                    <Chip size="sm" variant="flat" color="primary">AI Findings</Chip>
                  </CardHeader>
                  <CardBody className="p-4">
                    <div className="prose prose-sm prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/80">
                            {alert.aiAnalysis.investigationReport}
                        </pre>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Related Alerts Section */}
              <Card className="bg-content2/50 border border-white/5">
                <CardHeader className="border-b border-white/5 px-4 py-3">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Icon.Signal className="w-5 h-5 text-warning" />
                      <h4 className="text-sm font-semibold">Related Alerts</h4>
                      {correlations.length > 0 && (
                        <Chip size="sm" variant="flat" color="warning">
                          {correlations.reduce((acc, c) => acc + (c.relatedAlerts?.length || 0), 0)} correlated
                        </Chip>
                      )}
                    </div>
                    {isLoadingCorrelations && <Spinner size="sm" />}
                  </div>
                </CardHeader>
                <CardBody className="p-4">
                  {isLoadingCorrelations ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : correlations.length > 0 ? (
                    <div className="space-y-4">
                      {correlations.map((correlation) => (
                        <CorrelationCard
                          key={correlation.id}
                          correlation={correlation}
                          onViewAlert={handleViewRelatedAlert}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Icon.Info className="w-8 h-8 text-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-foreground/60">No related alerts found</p>
                      <p className="text-xs text-foreground/40 mt-1">
                        This alert has no correlations within the last hour
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
