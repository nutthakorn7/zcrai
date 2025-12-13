import { useEffect, useState } from 'react';
import { Card, CardBody, Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip, Select, SelectItem, Switch, Divider } from "@heroui/react";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";
import { Icon } from '../../shared/ui';

// ⭐ Import Logos
import SentinelOneLogo from '../../assets/logo/sentinelone.png';
import CrowdStrikeLogo from '../../assets/logo/crowdstrike.png';
import OpenAILogo from '../../assets/logo/openai.png';
import ClaudeLogo from '../../assets/logo/claude.png';
import GeminiLogo from '../../assets/logo/gemini.png';

// ⭐ Preload all logos immediately
const preloadImages = () => {
  [SentinelOneLogo, CrowdStrikeLogo, OpenAILogo, ClaudeLogo, GeminiLogo].forEach(src => {
    const img = new Image();
    img.src = src;
  });
};
preloadImages();

// ⭐ Provider Logo Map
const PROVIDER_LOGOS: Record<string, string> = {
  sentinelone: SentinelOneLogo,
  crowdstrike: CrowdStrikeLogo,
  openai: OpenAILogo,
  claude: ClaudeLogo,
  gemini: GeminiLogo,
};

// ⭐ Provider Config
const PROVIDER_CONFIG: Record<string, { name: string; color: string; gradient: string; description: string }> = {
  sentinelone: { 
    name: 'SentinelOne', 
    color: 'primary',
    gradient: 'from-purple-500/20 to-purple-600/10',
    description: 'AI-Powered Endpoint Security'
  },
  crowdstrike: { 
    name: 'CrowdStrike', 
    color: 'danger',
    gradient: 'from-red-500/20 to-orange-500/10',
    description: 'Cloud-Native Endpoint Protection'
  },
  openai: { 
    name: 'OpenAI', 
    color: 'success',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    description: 'GPT Models & AI Assistant'
  },
  claude: { 
    name: 'Anthropic Claude', 
    color: 'warning',
    gradient: 'from-amber-500/20 to-orange-400/10',
    description: 'Safe & Helpful AI Assistant'
  },
  gemini: { 
    name: 'Google Gemini', 
    color: 'secondary',
    gradient: 'from-blue-500/20 to-cyan-400/10',
    description: 'Multimodal AI by Google'
  },
};

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
  
  // ⭐ Resync countdown state
  const [resyncCountdown, setResyncCountdown] = useState<{ integrationId: string; seconds: number } | null>(null);
  
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

  // ⭐ handleOpenAdd รับ aiProviderOverride สำหรับ AI cards
  const handleOpenAdd = (type: 's1' | 'cs' | 'ai', aiProviderOverride?: string) => {
    setMode('add');
    setModalType(type);
    resetForm();
    // ถ้ามี aiProviderOverride ให้ set หลัง resetForm
    if (aiProviderOverride) {
      setAiProvider(aiProviderOverride);
    }
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
      
      // ⭐ Start resync countdown สำหรับ Security tools (ไม่ใช่ AI)
      if (mode === 'edit' && selectedIntegration && 
          (selectedIntegration.provider === 'sentinelone' || selectedIntegration.provider === 'crowdstrike')) {
        startResyncCountdown(selectedIntegration.id);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ⭐ Start countdown หลัง edit (30 วินาที)
  const startResyncCountdown = (integrationId: string) => {
    setResyncCountdown({ integrationId, seconds: 30 });
    
    const interval = setInterval(() => {
      setResyncCountdown(prev => {
        if (!prev || prev.seconds <= 1) {
          clearInterval(interval);
          // Refresh integrations หลัง countdown จบ
          setTimeout(() => {
            fetchIntegrations();
            setResyncCountdown(null);
          }, 2000); // รอ 2 วินาทีให้ sync เริ่มทำงาน
          return null;
        }
        return { ...prev, seconds: prev.seconds - 1 };
      });
    }, 1000);
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

  return (
    <div className="space-y-8">
      {/* ⭐ Header Section - Simple */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-default-500 bg-clip-text text-transparent">
          Integrations
        </h1>
        <p className="text-default-500 mt-1">Connect your security tools and AI providers</p>
      </div>

      {/* ⭐ Active Connections Section */}
      {integrations.some(i => i.hasApiKey) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-default-600 flex items-center gap-2">
            <Icon.Signal className="w-5 h-5 text-success" />
            Active Connections
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {integrations
              .filter(i => i.hasApiKey)
              .map(int => (
                <Card key={int.id} className="bg-content1/50 border border-success/20">
                  <CardBody className="p-4 flex flex-row items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      int.lastSyncStatus === 'success' ? 'bg-success/10 text-success' : 
                      int.lastSyncStatus === 'pending' ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'
                    }`}>
                      <img src={PROVIDER_LOGOS[int.provider]} alt={int.provider} className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{int.label}</h3>
                      <p className="text-xs text-default-400 capitalize">{int.provider}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-md text-xs font-medium border ${
                      int.lastSyncStatus === 'success' ? 'bg-success/10 text-success border-success/20' : 
                      int.lastSyncStatus === 'pending' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-danger/10 text-danger border-danger/20'
                    }`}>
                      {int.lastSyncStatus === 'success' ? 'Active' : int.lastSyncStatus || 'Unknown'}
                    </div>
                  </CardBody>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* ⭐ Security Integrations Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-default-600 flex items-center gap-2">
          <Icon.Wrench className="w-5 h-5 text-secondary" />
          Security Tools
        </h2>
        
        {/* ⭐ Add Provider Card (Top) */}
        <Card className="border border-white/5 bg-content2/30">
          <CardBody className="p-5">
            <h3 className="text-sm font-semibold text-default-600 mb-4">Add Provider</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* CrowdStrike Button */}
              <button
                onClick={() => handleOpenAdd('cs')}
                className="group relative overflow-hidden rounded-xl 
                           border border-red-500/20 
                           bg-gradient-to-br from-red-500/10 to-orange-500/5 
                           hover:from-red-500/20 hover:to-orange-500/10 
                           hover:border-red-500/40 
                           active:scale-[0.98] 
                           transition-all duration-300 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img src={CrowdStrikeLogo} alt="CrowdStrike" className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-medium text-red-400 group-hover:text-red-300 transition-colors block">CrowdStrike</span>
                    <span className="text-xs text-default-400">Endpoint Protection</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-red-500/10 group-hover:bg-red-500/20 flex items-center justify-center transition-colors">
                    <span className="text-red-400 text-lg font-light">+</span>
                  </div>
                </div>
              </button>

              {/* SentinelOne Button */}
              <button
                onClick={() => handleOpenAdd('s1')}
                className="group relative overflow-hidden rounded-xl 
                           border border-purple-500/20 
                           bg-gradient-to-br from-purple-500/10 to-purple-600/5 
                           hover:from-purple-500/20 hover:to-purple-600/10 
                           hover:border-purple-500/40 
                           active:scale-[0.98] 
                           transition-all duration-300 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img src={SentinelOneLogo} alt="SentinelOne" className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-medium text-purple-400 group-hover:text-purple-300 transition-colors block">SentinelOne</span>
                    <span className="text-xs text-default-400">AI Security</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center transition-colors">
                    <span className="text-purple-400 text-lg font-light">+</span>
                  </div>
                </div>
              </button>
            </div>
          </CardBody>
        </Card>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* ⭐ Existing Security Integrations (Left Side) */}
          {integrations
            .filter(int => int.provider === 'sentinelone' || int.provider === 'crowdstrike')
            .map((int) => (
              <Card 
                key={int.id} 
                className={`bg-gradient-to-br ${PROVIDER_CONFIG[int.provider]?.gradient || 'from-default-100 to-default-50'} border border-white/5 backdrop-blur-sm hover:border-white/10 transition-all duration-300`}
              >
                <CardBody className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Logo */}
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-xl ${
                        int.provider === 'sentinelone' ? 'bg-purple-500/20' : 'bg-red-500/20'
                      } flex items-center justify-center backdrop-blur-sm`}>
                        <img 
                          src={PROVIDER_LOGOS[int.provider]} 
                          alt={int.provider}
                          className="w-7 h-7"
                        />
                      </div>
                      {/* Status Indicator */}
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-content1 ${
                        !int.hasApiKey ? 'bg-danger' : 
                        int.lastSyncStatus === 'error' ? 'bg-warning' : 
                        'bg-success'
                      }`}></div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold truncate">{int.label}</h3>
                        <Chip 
                          size="sm" 
                          className={`text-xs ${
                            int.provider === 'sentinelone' 
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' 
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
                          } border`}
                        >
                          {PROVIDER_CONFIG[int.provider]?.name || int.provider}
                        </Chip>
                      </div>
                      
                      {/* URL */}
                      {int.maskedUrl && (
                        <p className="text-xs text-default-400 font-mono truncate mb-2">
                          {int.maskedUrl}
                        </p>
                      )}
                      
                      {/* Fetch Settings */}
                      {int.fetchSettings && (
                        <div className="flex gap-1.5 flex-wrap mb-2">
                          {int.provider === 'sentinelone' && (
                            <>
                              {(int.fetchSettings as S1FetchSettings).threats?.enabled && (
                                <Chip size="sm" className="text-xs bg-white/5 border border-white/10">
                                  Threats {(int.fetchSettings as S1FetchSettings).threats.days}d
                                </Chip>
                              )}
                              {(int.fetchSettings as S1FetchSettings).activities?.enabled && (
                                <Chip size="sm" className="text-xs bg-white/5 border border-white/10">
                                  Activities {(int.fetchSettings as S1FetchSettings).activities.days}d
                                </Chip>
                              )}
                              {(int.fetchSettings as S1FetchSettings).alerts?.enabled && (
                                <Chip size="sm" className="text-xs bg-white/5 border border-white/10">
                                  Alerts {(int.fetchSettings as S1FetchSettings).alerts.days}d
                                </Chip>
                              )}
                            </>
                          )}
                          {int.provider === 'crowdstrike' && (
                            <>
                              {(int.fetchSettings as CSFetchSettings).detections?.enabled && (
                                <Chip size="sm" className="text-xs bg-white/5 border border-white/10">
                                  Detections {(int.fetchSettings as CSFetchSettings).detections.days}d
                                </Chip>
                              )}
                              {(int.fetchSettings as CSFetchSettings).incidents?.enabled && (
                                <Chip size="sm" className="text-xs bg-white/5 border border-white/10">
                                  Incidents {(int.fetchSettings as CSFetchSettings).incidents.days}d
                                </Chip>
                              )}
                              {(int.fetchSettings as CSFetchSettings).alerts?.enabled && (
                                <Chip size="sm" className="text-xs bg-white/5 border border-white/10">
                                  Alerts {(int.fetchSettings as CSFetchSettings).alerts.days}d
                                </Chip>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* Status & Date */}
                      <div className="flex items-center gap-2 text-xs text-default-400">
                        {/* ⭐ Resync Countdown แสดงขณะรอ sync ใหม่ */}
                        {resyncCountdown && resyncCountdown.integrationId === int.id ? (
                          <span className="text-warning animate-pulse font-medium">
                            ⏳ Resync in {resyncCountdown.seconds}s
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              !int.hasApiKey ? 'bg-danger' : 
                              int.lastSyncStatus === 'error' ? 'bg-warning' : 
                              int.lastSyncStatus === 'pending' ? 'bg-primary animate-pulse' : 
                              'bg-success'
                            }`}></span>
                            {!int.hasApiKey ? 'Missing API Key' : 
                             int.lastSyncStatus === 'error' ? (int.lastSyncError || 'Sync Error') : 
                             int.lastSyncStatus === 'pending' ? 'Syncing...' : 'Connected'}
                          </span>
                        )}
                        <span>•</span>
                        <span>{new Date(int.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-white/5">
                    <Button 
                      size="sm" 
                      variant="flat" 
                      className="bg-white/5 hover:bg-white/10 border border-white/10"
                      isLoading={testingId === int.id}
                      onPress={() => handleTestConnection(int.id)}
                    >
                      Test
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      className="bg-white/5 hover:bg-white/10 border border-white/10" 
                      onPress={() => handleOpenEdit(int)}
                    >
                      <Icon.Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      className="bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20" 
                      onPress={() => handleDelete(int.id)}
                    >
                      <Icon.Delete className="w-4 h-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
        </div>
      </div>

      {/* ⭐ AI Providers Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-default-600 flex items-center gap-2">
          <Icon.Cpu className="w-5 h-5 te xt-secondary" />
          AI Providers
        </h2>
        
        {/* ⭐ Add AI Provider Card (Top) */}
        <Card className="border border-white/5 bg-content2/30">
          <CardBody className="p-5">
            <h3 className="text-sm font-semibold text-default-600 mb-4">Add AI Provider</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* OpenAI Button */}
              <button
                onClick={() => handleOpenAdd('ai', 'openai')}
                className="group relative overflow-hidden rounded-xl 
                           border border-emerald-500/20 
                           bg-gradient-to-br from-emerald-500/10 to-teal-500/5 
                           hover:from-emerald-500/20 hover:to-teal-500/10 
                           hover:border-emerald-500/40 
                           active:scale-[0.98] 
                           transition-all duration-300 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img src={OpenAILogo} alt="OpenAI" className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-medium text-emerald-400 group-hover:text-emerald-300 transition-colors block">OpenAI</span>
                    <span className="text-xs text-default-400">GPT Models</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
                    <span className="text-emerald-400 text-lg font-light">+</span>
                  </div>
                </div>
              </button>

              {/* Claude Button */}
              <button
                onClick={() => handleOpenAdd('ai', 'claude')}
                className="group relative overflow-hidden rounded-xl 
                           border border-amber-500/20 
                           bg-gradient-to-br from-amber-500/10 to-orange-400/5 
                           hover:from-amber-500/20 hover:to-orange-400/10 
                           hover:border-amber-500/40 
                           active:scale-[0.98] 
                           transition-all duration-300 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img src={ClaudeLogo} alt="Claude" className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-medium text-amber-400 group-hover:text-amber-300 transition-colors block">Claude</span>
                    <span className="text-xs text-default-400">Anthropic</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center transition-colors">
                    <span className="text-amber-400 text-lg font-light">+</span>
                  </div>
                </div>
              </button>

              {/* Gemini Button */}
              <button
                onClick={() => handleOpenAdd('ai', 'gemini')}
                className="group relative overflow-hidden rounded-xl 
                           border border-blue-500/20 
                           bg-gradient-to-br from-blue-500/10 to-cyan-400/5 
                           hover:from-blue-500/20 hover:to-cyan-400/10 
                           hover:border-blue-500/40 
                           active:scale-[0.98] 
                           transition-all duration-300 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img src={GeminiLogo} alt="Gemini" className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-medium text-blue-400 group-hover:text-blue-300 transition-colors block">Gemini</span>
                    <span className="text-xs text-default-400">Google AI</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                    <span className="text-blue-400 text-lg font-light">+</span>
                  </div>
                </div>
              </button>
            </div>
          </CardBody>
        </Card>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* ⭐ Existing AI Integrations (Left Side) */}
          {integrations
            .filter(int => ['openai', 'claude', 'gemini'].includes(int.provider))
            .map((int) => (
              <Card 
                key={int.id} 
                className={`bg-gradient-to-br ${PROVIDER_CONFIG [int.provider]?.gradient || 'from-default-100 to-default-50'} border border-white/5 backdrop-blur-sm hover:border-white/10 transition-all duration-300`}
              >
                <CardBody className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl ${
                      int.provider === 'openai' ? 'bg-emerald-500/20' : 
                      int.provider === 'claude' ? 'bg-amber-500/20' : 
                      'bg-blue-500/20'
                    } flex items-center justify-center backdrop-blur-sm`}>
                      <img 
                        src={PROVIDER_LOGOS[int.provider]} 
                        alt={int.provider}
                        className="w-6 h-6"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate text-sm">{int.label}</h3>
                      <p className="text-xs text-default-400 truncate">
                        {PROVIDER_CONFIG[int.provider]?.description}
                      </p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${int.hasApiKey ? 'bg-success' : 'bg-danger'}`}></div>
                  </div>
                  
                  <div className="flex justify-between gap-2 pt-2 border-t border-white/5">
                    {int.id === 'system-gemini' ? (
                      <div className="w-full text-center text-xs text-default-400 py-1">
                        System Managed
                      </div>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="flat" 
                          className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10" 
                          onPress={() => handleOpenEdit(int)}
                        >
                          Configure
                        </Button>
                        <Button 
                          size="sm" 
                          variant="flat" 
                          className="bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20" 
                          isIconOnly 
                          onPress={() => handleDelete(int.id)}
                        >
                          <Icon.Delete className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
        </div>
      </div>

      <Modal 
        isOpen={isOpen} 
        onOpenChange={onOpenChange} 
        placement="top-center"
        size="lg"
        classNames={{
          base: "bg-content1 border border-default-200",
          header: "border-b border-default-200",
          body: "py-6",
          footer: "border-t border-default-200",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-3">
                {/* Logo in Modal Header */}
                {modalType === 's1' && (
                  <img src={SentinelOneLogo} alt="SentinelOne" className="w-8 h-8" />
                )}
                {modalType === 'cs' && (
                  <img src={CrowdStrikeLogo} alt="CrowdStrike" className="w-8 h-8" />
                )}
                {modalType === 'ai' && (
                  <img src={PROVIDER_LOGOS[aiProvider] || OpenAILogo} alt="AI" className="w-8 h-8" />
                )}
                <div>
                  <h3 className="text-lg font-bold">
                    {mode === 'add' ? 'Add ' : 'Edit '}
                    {modalType === 's1' ? 'SentinelOne' : modalType === 'cs' ? 'CrowdStrike' : PROVIDER_CONFIG[aiProvider]?.name || 'AI Provider'}
                  </h3>
                  <p className="text-xs text-default-400 font-normal">
                    {modalType === 's1' ? 'AI-Powered Endpoint Security' : 
                     modalType === 'cs' ? 'Cloud-Native Endpoint Protection' : 
                     PROVIDER_CONFIG[aiProvider]?.description || 'Configure AI Assistant'}
                  </p>
                </div>
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
                            {[...(POPULAR_MODELS[aiProvider] || []).map((m: string) => (
                              <SelectItem key={m} textValue={m}>
                                {m}
                              </SelectItem>
                            )),
                            <SelectItem key="custom" className="text-primary" textValue="Custom Model">
                              Type Custom Model...
                            </SelectItem>]}
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

              <ModalFooter className="gap-2">
                <Button variant="flat" className="bg-default-100" onPress={onClose}>
                  Cancel
                </Button>
                <Button 
                  className={`${
                    modalType === 's1' ? 'bg-gradient-to-r from-purple-600 to-purple-500' :
                    modalType === 'cs' ? 'bg-gradient-to-r from-red-600 to-orange-500' :
                    aiProvider === 'openai' ? 'bg-gradient-to-r from-emerald-600 to-teal-500' :
                    aiProvider === 'claude' ? 'bg-gradient-to-r from-amber-600 to-orange-400' :
                    aiProvider === 'gemini' ? 'bg-gradient-to-r from-blue-600 to-cyan-500' :
                    'bg-gradient-to-r from-emerald-600 to-teal-500'
                  } text-white shadow-lg`}
                  onPress={() => handleSubmit(onClose)} 
                  isLoading={isLoading}
                >
                  {mode === 'add' ? '🔗 Test & Connect' : '💾 Save Changes'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
