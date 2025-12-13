import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Chip, Divider, Card, CardBody } from "@heroui/react";
import { Icon } from '../shared/ui';
import { Observable } from '../shared/api/observables';

interface ObservableDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  observable: Observable | null;
  onEnrich?: (id: string) => void;
}

export const ObservableDetailModal = ({ isOpen, onClose, observable, onEnrich }: ObservableDetailModalProps) => {
  if (!observable) return null;

  const enrichmentData = observable.enrichmentData as any || {};
  const vtData = enrichmentData.virustotal;
  const abusedbData = enrichmentData.abuseipdb;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-background border border-white/10",
        header: "border-b border-white/5",
        footer: "border-t border-white/5",
        closeButton: "hover:bg-white/5 active:bg-white/10",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon.Search className="w-5 h-5 text-primary" />
                <span>Observable Details</span>
                <Chip size="sm" variant="flat" color={observable.isMalicious ? "danger" : observable.isMalicious === false ? "success" : "default"}>
                  {observable.type.toUpperCase()}
                </Chip>
              </div>
              <p className="text-sm font-mono text-gray-400 mt-1">{observable.value}</p>
            </ModalHeader>
            
            <ModalBody className="py-6 space-y-6">
              
              {/* STATUS OVERVIEW */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-content1/50 border border-white/5">
                  <CardBody className="p-3">
                    <p className="text-xs text-gray-500 uppercase">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {observable.isMalicious ? (
                        <>
                          <Icon.Shield className="w-5 h-5 text-danger" />
                          <span className="text-danger font-bold">Malicious</span>
                        </>
                      ) : (
                        <>
                          <Icon.CheckCircle className="w-5 h-5 text-success" />
                          <span className="text-success font-bold">Safe</span>
                        </>
                      )}
                    </div>
                  </CardBody>
                </Card>
                <Card className="bg-content1/50 border border-white/5">
                  <CardBody className="p-3">
                    <p className="text-xs text-gray-500 uppercase">Sightings</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Icon.Eye className="w-5 h-5 text-warning" />
                      <span className="text-xl font-bold">{observable.sightingCount}</span>
                    </div>
                  </CardBody>
                </Card>
                <Card className="bg-content1/50 border border-white/5">
                  <CardBody className="p-3">
                    <p className="text-xs text-gray-500 uppercase">Last Seen</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Icon.Calendar className="w-5 h-5 text-primary" />
                      <span className="text-sm">
                        {new Date(observable.lastSeen).toLocaleDateString()}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </div>

              <Divider className="opacity-50" />

              {/* VIRUSTOTAL SECTION */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
                      <Icon.Shield className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-md font-bold">VirusTotal Analysis</h3>
                      <p className="text-xs text-gray-500">Threat Intelligence & Reputation</p>
                    </div>
                  </div>
                  {vtData ? (
                    <Chip size="sm" color="success" variant="flat">Enriched</Chip>
                  ) : (
                    <Chip size="sm" color="warning" variant="flat">Not Found / Pending</Chip>
                  )}
                </div>

                {vtData ? (
                  <Card className="bg-content1 border border-white/5">
                    <CardBody className="grid grid-cols-2 gap-6 p-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Detection Ratio</p>
                        <p className={`text-xl font-mono font-bold ${vtData.malicious ? 'text-danger' : 'text-success'}`}>
                          {vtData.detectionRatio}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Reputation Score</p>
                        <p className="text-xl font-bold">{vtData.reputation}</p>
                      </div>
                      {vtData.country && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Country</p>
                          <p className="text-sm">{vtData.country}</p>
                        </div>
                      )}
                      {vtData.asn && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">ASN</p>
                          <p className="text-sm">AS{vtData.asn}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 mb-1">Last Analysis</p>
                        <p className="text-xs font-mono text-gray-400">
                          {vtData.lastAnalysisDate ? new Date(vtData.lastAnalysisDate).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed border-white/10 text-center text-gray-500 text-sm">
                    No VirusTotal data available. Click "Enrich Now" to fetch.
                  </div>
                )}
              </div>

              {/* ABUSEIPDB SECTION (Only if IP) */}
              {observable.type === 'ip' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-orange-500/10 flex items-center justify-center">
                        <Icon.Global className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-md font-bold">AbuseIPDB Analysis</h3>
                        <p className="text-xs text-gray-500">Crowdsourced Abuse Reporting</p>
                      </div>
                    </div>
                    {abusedbData ? (
                      <Chip size="sm" color="success" variant="flat">Enriched</Chip>
                    ) : (
                      <Chip size="sm" color="warning" variant="flat">Not Found</Chip>
                    )}
                  </div>

                  {abusedbData ? (
                    <Card className="bg-content1 border border-white/5">
                      <CardBody className="grid grid-cols-2 gap-6 p-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Abuse Confidence</p>
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${abusedbData.abuseConfidenceScore > 50 ? 'bg-danger' : 'bg-success'}`}
                                style={{ width: `${abusedbData.abuseConfidenceScore}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold">{abusedbData.abuseConfidenceScore}%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Total Reports</p>
                          <p className="text-xl font-bold">{abusedbData.totalReports}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Country</p>
                          <p className="text-sm">{abusedbData.countryCode}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">ISP / Usage</p>
                          <p className="text-sm truncate" title={abusedbData.usageType}>{abusedbData.usageType || 'N/A'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500 mb-1">Last Reported</p>
                          <p className="text-xs font-mono text-gray-400">
                             {abusedbData.lastReportedAt ? new Date(abusedbData.lastReportedAt).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                      </CardBody>
                    </Card>
                  ) : (
                    <div className="p-4 rounded-lg border border-dashed border-white/10 text-center text-gray-500 text-sm">
                      No AbuseIPDB data available.
                    </div>
                  )}
                </div>
              )}

            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onPress={onClose}>
                Close
              </Button>
              <Button 
                color="primary" 
                startContent={<Icon.Refresh className="w-4 h-4" />}
                onPress={() => onEnrich && onEnrich(observable.id)}
                isLoading={!observable.enrichedAt && observable?.enrichmentData?.status === 'pending'}
              >
                Enrich Now
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
