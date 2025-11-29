import { useEffect, useState } from 'react';
import { Card, CardBody, Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip, Select, SelectItem, Switch, Divider } from "@heroui/react";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";

// ⭐ Type สำหรับ Fetch Settings
interface FetchSettingItem {
  enabled: boolean;
  days: number;
}

interface S1FetchSettings {
  threats: FetchSettingItem;
  activities: FetchSettingItem;
  alerts: FetchSettingItem;
}

interface CSFetchSettings {
  alerts: FetchSettingItem;
  detections: FetchSettingItem;
  incidents: FetchSettingItem;
}

// Day options สำหรับ Select
const DAY_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 120, label: '120 days (Recommended for Activities)' },
  { value: 180, label: '180 days' },
  { value: 365, label: '365 days (Full Year)' },
];

interface Integration {
  id: string;
  provider: string;
  label: string;
  createdAt: string;
  hasApiKey: boolean;
  lastSyncStatus: 'success' | 'error' | 'pending' | null;
  lastSyncError: string | null;
  lastSyncAt: string | null;
  fetchSettings?: S1FetchSettings | CSFetchSettings | null;  // ⭐ เพิ่ม
  maskedUrl?: string | null;  // ⭐ เพิ่ม
  keyId?: string | null;      // ⭐ CrowdStrike Client ID
}

export default function IntegrationPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { setPageContext } = usePageContext();
  
  // Mode: 'add' | 'edit'
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  // Selected Provider for Add
  const [modalType, setModalType] = useState<'s1' | 'cs' | 'ai'>('s1');
  // Selected Integration for Edit
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // AI Provider Select
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);

  // Popular Models
  const POPULAR_MODELS: Record<string, string[]> = {
    openai: ['gpt-5.1', 'gpt-5-pro', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    claude: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5', 'claude-3-5-sonnet-20240620'],
    gemini: ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  };

  // Form State
  const [s1Url, setS1Url] = useState('');
  const [s1Token, setS1Token] = useState('');
  const [csBaseUrl, setCsBaseUrl] = useState('https://api.us-2.crowdstrike.com');
  const [csClientId, setCsClientId] = useState('');
  const [csSecret, setCsSecret] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [label, setLabel] = useState('');
  
  // ⭐ State สำหรับเก็บว่ามี credential เดิมอยู่หรือไม่
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [hasExistingSecret, setHasExistingSecret] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  // ⭐ Fetch Settings State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [s1FetchSettings, setS1FetchSettings] = useState<S1FetchSettings>({
    threats: { enabled: true, days: 365 },
    activities: { enabled: true, days: 120 },
    alerts: { enabled: true, days: 365 },
  });
  const [csFetchSettings, setCsFetchSettings] = useState<CSFetchSettings>({
    alerts: { enabled: true, days: 365 },
    detections: { enabled: true, days: 365 },
    incidents: { enabled: true, days: 365 },
  });

  const fetchIntegrations = async () => {
    try {
      const { data } = await api.get('/integrations');
      setIntegrations(data);
      
      // Update Page Context for AI Assistant
      const securityIntegrations = data.filter((i: Integration) => i.provider === 'sentinelone' || i.provider === 'crowdstrike');
      const aiProviders = data.filter((i: Integration) => ['openai', 'claude', 'gemini', 'deepseek'].includes(i.provider));
      
      setPageContext({
        pageName: 'Integrations',
        pageDescription: 'Integration settings page for security tools and AI providers',
        data: {
          integrations: securityIntegrations.map((i: Integration) => ({
            name: i.label || i.provider,
            type: i.provider,
            status: i.lastSyncStatus || 'pending',
            lastSync: i.lastSyncAt,
          })),
          aiProviders: aiProviders.map((i: Integration) => ({
            provider: i.provider,
            label: i.label,
          })),
          totalIntegrations: data.length,
        }
      });
    } catch (error) {
      console.error('Failed to fetch integrations');
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleOpenAdd = (type: 's1' | 'cs' | 'ai') => {
    setMode('add');
    setModalType(type);
    resetForm();
    onOpen();
  };

  const handleOpenEdit = async (int: Integration) => {
    setMode('edit');
    setSelectedIntegration(int);
    setLabel(int.label);
    
    // ⭐ Reset credential states
    setHasExistingToken(false);
    setHasExistingSecret(false);
    setHasExistingKey(false);
    
    // ⭐ Load existing config for edit
    try {
      const { data } = await api.get(`/integrations/${int.id}/config`);
      
      if (int.provider === 'sentinelone') {
        setModalType('s1');
        setS1Url(data.url || '');
        setS1Token(''); // ไม่แสดง token จริง แต่บอก user ว่ามีอยู่
        setHasExistingToken(data.hasToken || false);
        if (data.fetchSettings) {
          setS1FetchSettings(data.fetchSettings);
          setShowAdvanced(true);
        }
      } else if (int.provider === 'crowdstrike') {
        setModalType('cs');
        setCsBaseUrl(data.baseUrl || 'https://api.us-2.crowdstrike.com');
        setCsClientId(data.clientId || '');
        setCsSecret(''); // ไม่แสดง secret จริง
        setHasExistingSecret(data.hasSecret || false);
        if (data.fetchSettings) {
          setCsFetchSettings(data.fetchSettings);
          setShowAdvanced(true);
        }
      } else {
        setModalType('ai');
        setAiProvider(int.provider);
        setAiModel(data.model || '');
        setAiBaseUrl(data.baseUrl || '');
        setAiKey(''); // ไม่แสดง key จริง
        setHasExistingKey(data.hasKey || false);
      }
    } catch (e) {
      console.error('Failed to load config');
    }
    
    onOpen();
  };

  const handleSubmit = async (onClose: () => void) => {
    setIsLoading(true);
    try {
      if (mode === 'add') {
        if (modalType === 's1') {
          await api.post('/integrations/sentinelone', {
            url: s1Url,
            token: s1Token,
            label: label || 'SentinelOne',
            fetchSettings: s1FetchSettings, // ⭐ ส่ง fetch settings
          });
        } else if (modalType === 'cs') {
          await api.post('/integrations/crowdstrike', {
            baseUrl: csBaseUrl,
            clientId: csClientId,
            clientSecret: csSecret,
            label: label || 'CrowdStrike',
            fetchSettings: csFetchSettings, // ⭐ ส่ง fetch settings
          });
        } else if (modalType === 'ai') {
          await api.post(`/integrations/ai/${aiProvider}`, {
            apiKey: aiKey,
            label: label || aiProvider.toUpperCase(),
            model: aiModel || undefined,
            baseUrl: aiBaseUrl || undefined,
          });
        }
      } else {
        // Edit Mode - ⭐ Full Update: URL, Token, fetchSettings
        if (selectedIntegration) {
          const provider = selectedIntegration.provider;
          
          if (provider === 'sentinelone') {
            await api.put(`/integrations/${selectedIntegration.id}`, {
              label: label,
              url: s1Url,
              token: s1Token || undefined, // undefined = keep existing
              fetchSettings: s1FetchSettings,
            });
          } else if (provider === 'crowdstrike') {
            await api.put(`/integrations/${selectedIntegration.id}`, {
              label: label,
              baseUrl: csBaseUrl,
              clientId: csClientId,
              clientSecret: csSecret || undefined, // undefined = keep existing
              fetchSettings: csFetchSettings,
            });
          } else {
            // AI Provider
            await api.put(`/integrations/${selectedIntegration.id}`, {
              label: label,
              apiKey: aiKey || undefined, // undefined = keep existing
              model: aiModel || undefined,
              baseUrl: aiBaseUrl || undefined,
            });
          }
        }
      }

      fetchIntegrations();
      onClose();
      resetForm();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Test State
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const { data } = await api.post(`/integrations/${id}/test`);
      alert(`✅ ${data.message}`);
    } catch (error: any) {
      alert(`❌ ${error.response?.data?.error || 'Connection failed'}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;
    try {
      await api.delete(`/integrations/${id}`);
      fetchIntegrations();
    } catch (error) {
      alert('Failed to delete integration');
    }
  };

  const resetForm = () => {
    setS1Url('');
    setS1Token('');
    setCsBaseUrl('https://api.us-2.crowdstrike.com');
    setCsClientId('');
    setCsSecret('');
    setAiKey('');
    setLabel('');
    setAiProvider('openai');
    setSelectedIntegration(null);
    // ⭐ Reset fetch settings
    setShowAdvanced(false);
    setS1FetchSettings({
      threats: { enabled: true, days: 365 },
      activities: { enabled: true, days: 120 },
      alerts: { enabled: true, days: 365 },
    });
    setCsFetchSettings({
      alerts: { enabled: true, days: 365 },
      detections: { enabled: true, days: 365 },
      incidents: { enabled: true, days: 365 },
    });
    // ⭐ Reset credential existence flags
    setHasExistingToken(false);
    setHasExistingSecret(false);
    setHasExistingKey(false);
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'sentinelone': return 'primary';
      case 'crowdstrike': return 'secondary';
      case 'openai': return 'success';
      case 'claude': return 'warning';
      case 'gemini': return 'default';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <div className="flex gap-2">
          <Button color="primary" onPress={() => handleOpenAdd('s1')}>
            Add SentinelOne
          </Button>
          <Button color="secondary" onPress={() => handleOpenAdd('cs')}>
            Add CrowdStrike
          </Button>
          <Button color="success" className="text-white" onPress={() => handleOpenAdd('ai')}>
            Add AI Provider
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {integrations.map((int) => (
          <Card key={int.id} className="bg-content1">
            <CardBody className="flex flex-row justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold">{int.label}</h3>
                  <Chip size="sm" color={getProviderColor(int.provider) as any}>
                    {int.provider}
                  </Chip>
                  {/* Visual Indicator - แสดงสถานะตาม lastSyncStatus */}
                  {!int.hasApiKey ? (
                    <Chip size="sm" variant="dot" color="danger" className="border-none pl-1">
                      Missing API Key
                    </Chip>
                  ) : int.lastSyncStatus === 'error' ? (
                    <Chip size="sm" variant="dot" color="warning" className="border-none pl-1" title={int.lastSyncError || 'Sync failed'}>
                      Sync Error
                    </Chip>
                  ) : (
                    <Chip size="sm" variant="dot" color="success" className="border-none pl-1" title={int.lastSyncStatus === 'pending' ? 'Syncing...' : 'Synced'}>
                      Connected
                    </Chip>
                  )}
                </div>
                
                {/* ⭐ แสดง URL และ Settings */}
                {int.maskedUrl && (
                  <p className="text-xs text-default-400 font-mono mb-1">
                    {int.maskedUrl}
                  </p>
                )}
                
                {/* ⭐ แสดง Fetch Settings Summary */}
                {int.fetchSettings && (int.provider === 'sentinelone' || int.provider === 'crowdstrike') && (
                  <div className="flex gap-2 flex-wrap">
                    {int.provider === 'sentinelone' && (
                      <>
                        {(int.fetchSettings as S1FetchSettings).threats?.enabled && (
                          <Chip size="sm" variant="flat" color="default" className="text-xs">
                            Threats: {(int.fetchSettings as S1FetchSettings).threats.days}d
                          </Chip>
                        )}
                        {(int.fetchSettings as S1FetchSettings).activities?.enabled && (
                          <Chip size="sm" variant="flat" color="default" className="text-xs">
                            Activities: {(int.fetchSettings as S1FetchSettings).activities.days}d
                          </Chip>
                        )}
                        {(int.fetchSettings as S1FetchSettings).alerts?.enabled && (
                          <Chip size="sm" variant="flat" color="default" className="text-xs">
                            Alerts: {(int.fetchSettings as S1FetchSettings).alerts.days}d
                          </Chip>
                        )}
                      </>
                    )}
                    {int.provider === 'crowdstrike' && (
                      <>
                        {(int.fetchSettings as CSFetchSettings).alerts?.enabled && (
                          <Chip size="sm" variant="flat" color="default" className="text-xs">
                            Alerts: {(int.fetchSettings as CSFetchSettings).alerts.days}d
                          </Chip>
                        )}
                        {(int.fetchSettings as CSFetchSettings).detections?.enabled && (
                          <Chip size="sm" variant="flat" color="default" className="text-xs">
                            Detections: {(int.fetchSettings as CSFetchSettings).detections.days}d
                          </Chip>
                        )}
                        {(int.fetchSettings as CSFetchSettings).incidents?.enabled && (
                          <Chip size="sm" variant="flat" color="default" className="text-xs">
                            Incidents: {(int.fetchSettings as CSFetchSettings).incidents.days}d
                          </Chip>
                        )}
                      </>
                    )}
                  </div>
                )}
                
                <p className="text-small text-default-500 mt-1">
                  Added on {new Date(int.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  color="success"
                  isLoading={testingId === int.id}
                  onPress={() => handleTestConnection(int.id)}
                >
                  Test Connection
                </Button>
                <Button size="sm" variant="flat" onPress={() => handleOpenEdit(int)}>
                  Edit
                </Button>
                <Button size="sm" color="danger" variant="light" onPress={() => handleDelete(int.id)}>
                  Remove
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
        
        {integrations.length === 0 && (
          <div className="text-center py-10 text-default-500">
            No integrations configured yet.
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {mode === 'add' ? (
                  `Add ${modalType === 's1' ? 'SentinelOne' : modalType === 'cs' ? 'CrowdStrike' : 'AI Provider'} Integration`
                ) : (
                  'Edit Integration'
                )}
              </ModalHeader>
              <ModalBody>
                <Input
                  label="Label"
                  placeholder="e.g. Production Env, PAX8 Instance"
                  value={label}
                  onValueChange={setLabel}
                />
                
                {/* ⭐ SentinelOne Form - Add & Edit */}
                {modalType === 's1' && (
                      <>
                        <Input
                          label="Base URL"
                          placeholder="https://apne1-pax8.sentinelone.net (Example)"
                          description="Enter your SentinelOne console URL"
                          value={s1Url}
                          onValueChange={setS1Url}
                        />
                        <Input
                          label="API Token"
                          placeholder={mode === 'edit' && hasExistingToken ? '••••••• (Leave empty to keep existing)' : 'Enter your API Token'}
                          description={mode === 'edit' && hasExistingToken ? '✓ Token exists - leave empty to keep, or enter new token to replace' : undefined}
                          value={s1Token}
                          onValueChange={setS1Token}
                          type="password"
                        />
                        
                        {/* ⭐ Advanced Settings - SentinelOne */}
                        <Divider className="my-2" />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-default-600">Data Retention Settings</span>
                          <Switch 
                            size="sm"
                            isSelected={showAdvanced} 
                            onValueChange={setShowAdvanced}
                          >
                            Customize
                          </Switch>
                        </div>
                        
                        {showAdvanced && (
                          <div className="space-y-3 p-3 bg-default-100 rounded-lg">
                            {/* Threats */}
                            <div className="flex items-center gap-3">
                              <Switch 
                                size="sm"
                                isSelected={s1FetchSettings.threats.enabled}
                                onValueChange={(v) => setS1FetchSettings(prev => ({
                                  ...prev, 
                                  threats: { ...prev.threats, enabled: v }
                                }))}
                              />
                              <span className="text-sm w-24">Threats</span>
                              <Select
                                size="sm"
                                className="flex-1"
                                selectedKeys={[String(s1FetchSettings.threats.days)]}
                                onChange={(e) => setS1FetchSettings(prev => ({
                                  ...prev,
                                  threats: { ...prev.threats, days: Number(e.target.value) }
                                }))}
                                isDisabled={!s1FetchSettings.threats.enabled}
                              >
                                {DAY_OPTIONS.map(opt => (
                                  <SelectItem key={String(opt.value)}>{opt.label}</SelectItem>
                                ))}
                              </Select>
                            </div>
                            
                            {/* Activities */}
                            <div className="flex items-center gap-3">
                              <Switch 
                                size="sm"
                                isSelected={s1FetchSettings.activities.enabled}
                                onValueChange={(v) => setS1FetchSettings(prev => ({
                                  ...prev, 
                                  activities: { ...prev.activities, enabled: v }
                                }))}
                              />
                              <span className="text-sm w-24">Activities</span>
                              <Select
                                size="sm"
                                className="flex-1"
                                selectedKeys={[String(s1FetchSettings.activities.days)]}
                                onChange={(e) => setS1FetchSettings(prev => ({
                                  ...prev,
                                  activities: { ...prev.activities, days: Number(e.target.value) }
                                }))}
                                isDisabled={!s1FetchSettings.activities.enabled}
                              >
                                {DAY_OPTIONS.map(opt => (
                                  <SelectItem key={String(opt.value)}>{opt.label}</SelectItem>
                                ))}
                              </Select>
                            </div>
                            
                            {/* Alerts */}
                            <div className="flex items-center gap-3">
                              <Switch 
                                size="sm"
                                isSelected={s1FetchSettings.alerts.enabled}
                                onValueChange={(v) => setS1FetchSettings(prev => ({
                                  ...prev, 
                                  alerts: { ...prev.alerts, enabled: v }
                                }))}
                              />
                              <span className="text-sm w-24">Alerts</span>
                              <Select
                                size="sm"
                                className="flex-1"
                                selectedKeys={[String(s1FetchSettings.alerts.days)]}
                                onChange={(e) => setS1FetchSettings(prev => ({
                                  ...prev,
                                  alerts: { ...prev.alerts, days: Number(e.target.value) }
                                }))}
                                isDisabled={!s1FetchSettings.alerts.enabled}
                              >
                                {DAY_OPTIONS.map(opt => (
                                  <SelectItem key={String(opt.value)}>{opt.label}</SelectItem>
                                ))}
                              </Select>
                            </div>
                            
                            <p className="text-xs text-default-400">
                              💡 Activities have large volume, recommend 120 days | Threats/Alerts recommend 365 days
                            </p>
                          </div>
                        )}
                      </>
                )}

                {/* ⭐ CrowdStrike Form - Add & Edit */}
                {modalType === 'cs' && (
                      <>
                        <Select
                          label="Region"
                          selectedKeys={[csBaseUrl]}
                          onChange={(e) => setCsBaseUrl(e.target.value)}
                          description="Select your CrowdStrike cloud region"
                        >
                          <SelectItem key="https://api.us-1.crowdstrike.com">US-1 (api.us-1.crowdstrike.com)</SelectItem>
                          <SelectItem key="https://api.us-2.crowdstrike.com">US-2 (api.us-2.crowdstrike.com)</SelectItem>
                          <SelectItem key="https://api.eu-1.crowdstrike.com">EU-1 (api.eu-1.crowdstrike.com)</SelectItem>
                          <SelectItem key="https://api.laggar.gcw.crowdstrike.com">US-GOV-1 (GovCloud)</SelectItem>
                        </Select>
                        <Input
                          label="Client ID"
                          placeholder="Enter Client ID"
                          value={csClientId}
                          onValueChange={setCsClientId}
                        />
                        <Input
                          label="Client Secret"
                          placeholder={mode === 'edit' && hasExistingSecret ? '••••••• (Leave empty to keep existing)' : 'Enter Client Secret'}
                          description={mode === 'edit' && hasExistingSecret ? '✓ Secret exists - leave empty to keep, or enter new to replace' : undefined}
                          value={csSecret}
                          onValueChange={setCsSecret}
                          type="password"
                        />
                        
                        {/* ⭐ Advanced Settings - CrowdStrike */}
                        <Divider className="my-2" />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-default-600">Data Retention Settings</span>
                          <Switch 
                            size="sm"
                            isSelected={showAdvanced} 
                            onValueChange={setShowAdvanced}
                          >
                            Customize
                          </Switch>
                        </div>
                        
                        {showAdvanced && (
                          <div className="space-y-3 p-3 bg-default-100 rounded-lg">
                            {/* Alerts */}
                            <div className="flex items-center gap-3">
                              <Switch 
                                size="sm"
                                isSelected={csFetchSettings.alerts.enabled}
                                onValueChange={(v) => setCsFetchSettings(prev => ({
                                  ...prev, 
                                  alerts: { ...prev.alerts, enabled: v }
                                }))}
                              />
                              <span className="text-sm w-24">Alerts</span>
                              <Select
                                size="sm"
                                className="flex-1"
                                selectedKeys={[String(csFetchSettings.alerts.days)]}
                                onChange={(e) => setCsFetchSettings(prev => ({
                                  ...prev,
                                  alerts: { ...prev.alerts, days: Number(e.target.value) }
                                }))}
                                isDisabled={!csFetchSettings.alerts.enabled}
                              >
                                {DAY_OPTIONS.map(opt => (
                                  <SelectItem key={String(opt.value)}>{opt.label}</SelectItem>
                                ))}
                              </Select>
                            </div>
                            
                            {/* Detections */}
                            <div className="flex items-center gap-3">
                              <Switch 
                                size="sm"
                                isSelected={csFetchSettings.detections.enabled}
                                onValueChange={(v) => setCsFetchSettings(prev => ({
                                  ...prev, 
                                  detections: { ...prev.detections, enabled: v }
                                }))}
                              />
                              <span className="text-sm w-24">Detections</span>
                              <Select
                                size="sm"
                                className="flex-1"
                                selectedKeys={[String(csFetchSettings.detections.days)]}
                                onChange={(e) => setCsFetchSettings(prev => ({
                                  ...prev,
                                  detections: { ...prev.detections, days: Number(e.target.value) }
                                }))}
                                isDisabled={!csFetchSettings.detections.enabled}
                              >
                                {DAY_OPTIONS.map(opt => (
                                  <SelectItem key={String(opt.value)}>{opt.label}</SelectItem>
                                ))}
                              </Select>
                            </div>
                            
                            {/* Incidents */}
                            <div className="flex items-center gap-3">
                              <Switch 
                                size="sm"
                                isSelected={csFetchSettings.incidents.enabled}
                                onValueChange={(v) => setCsFetchSettings(prev => ({
                                  ...prev, 
                                  incidents: { ...prev.incidents, enabled: v }
                                }))}
                              />
                              <span className="text-sm w-24">Incidents</span>
                              <Select
                                size="sm"
                                className="flex-1"
                                selectedKeys={[String(csFetchSettings.incidents.days)]}
                                onChange={(e) => setCsFetchSettings(prev => ({
                                  ...prev,
                                  incidents: { ...prev.incidents, days: Number(e.target.value) }
                                }))}
                                isDisabled={!csFetchSettings.incidents.enabled}
                              >
                                {DAY_OPTIONS.map(opt => (
                                  <SelectItem key={String(opt.value)}>{opt.label}</SelectItem>
                                ))}
                              </Select>
                            </div>
                            
                            <p className="text-xs text-default-400">
                              💡 Alerts/Detections/Incidents are critical data, recommend 365 days
                            </p>
                          </div>
                        )}
                      </>
                )}

                {/* ⭐ AI Provider Form - Add & Edit */}
                {modalType === 'ai' && (
                      <>
                        <Select 
                          label="Provider" 
                          selectedKeys={[aiProvider]} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setAiProvider(val);
                            setAiModel(''); // Reset model when provider changes
                            setUseCustomModel(false);
                          }}
                        >
                          <SelectItem key="openai">OpenAI</SelectItem>
                          <SelectItem key="claude">Claude (Anthropic)</SelectItem>
                          <SelectItem key="gemini">Gemini (Google)</SelectItem>
                        </Select>
                        <Input
                          label="API Key"
                          placeholder={mode === 'edit' && hasExistingKey ? '••••••• (Leave empty to keep existing)' : `sk-... (Enter your ${aiProvider} API Key)`}
                          description={mode === 'edit' && hasExistingKey ? '✓ API Key exists - leave empty to keep, or enter new to replace' : undefined}
                          value={aiKey}
                          onValueChange={setAiKey}
                          type="password"
                        />
                        
                        {/* Model Selection */}
                        {!useCustomModel ? (
                          <Select
                            label="Model"
                            placeholder="Select a model"
                            selectedKeys={aiModel ? [aiModel] : []}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'custom') {
                                setUseCustomModel(true);
                                setAiModel('');
                              } else {
                                setAiModel(val);
                              }
                            }}
                          >
                            {(POPULAR_MODELS[aiProvider] || []).map((m: string) => (
                              <SelectItem key={m} textValue={m}>
                                {m}
                              </SelectItem>
                            ))}
                            <SelectItem key="custom" className="text-primary" textValue="Custom Model">
                              Type Custom Model...
                            </SelectItem>
                          </Select>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              label="Custom Model Name"
                              placeholder="e.g. llama-3-70b"
                              value={aiModel}
                              onValueChange={setAiModel}
                              className="flex-1"
                            />
                            <Button 
                              isIconOnly 
                              variant="flat" 
                              color="danger" 
                              className="mt-2" // Align with input
                              onPress={() => {
                                setUseCustomModel(false);
                                setAiModel('');
                              }}
                            >
                              ✕
                            </Button>
                          </div>
                        )}

                        <Input
                          label="Base URL (Optional)"
                          placeholder="https://api.openai.com/v1"
                          description="Leave empty for default. Use for Local LLM or proxies."
                          value={aiBaseUrl}
                          onValueChange={setAiBaseUrl}
                        />
                      </>
                )}
              </ModalBody>

              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary" onPress={() => handleSubmit(onClose)} isLoading={isLoading}>
                  {mode === 'add' ? 'Test & Save' : 'Update'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
