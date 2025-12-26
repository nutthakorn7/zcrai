import { useEffect, useState, useCallback } from 'react';
import { Card, CardBody, Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip, Select, SelectItem, Switch, Divider } from "@heroui/react";
import { api } from "@/shared/api";
import { usePageContext } from "@/contexts/PageContext";
import { Icon } from '../../shared/ui';
import toast from 'react-hot-toast';

// ⭐ Import Logos
import SentinelOneLogo from '../../assets/logo/sentinelone.png';
import CrowdStrikeLogo from '../../assets/logo/crowdstrike.png';
import OpenAILogo from '../../assets/logo/openai.png';
import ClaudeLogo from '../../assets/logo/claude.png';
import GeminiLogo from '../../assets/logo/gemini.png';
import AWSLogo from '../../assets/logo/aws.png';

// ⭐ Preload all logos immediately
const preloadImages = () => {
  [SentinelOneLogo, CrowdStrikeLogo, OpenAILogo, ClaudeLogo, GeminiLogo, AWSLogo].forEach(src => {
    const img = new Image();
    img.src = src;
  });
}
preloadImages();

// ⭐ Provider Logo Map
const PROVIDER_LOGOS: Record<string, string> = {
  sentinelone: SentinelOneLogo,
  crowdstrike: CrowdStrikeLogo,
  openai: OpenAILogo,
  claude: ClaudeLogo,
  gemini: GeminiLogo,
  'aws-cloudtrail': AWSLogo,
};

// ⭐ Provider Config
// ⭐ Provider Config
interface ProviderConfigItem {
  name: string;
  color: "primary" | "secondary" | "success" | "warning" | "danger" | "default";
  gradient: string;
  border: string;
  iconBg: string;
  iconColor: string;
  description: string;
  category?: string;
}

const PROVIDER_CONFIG: Record<string, ProviderConfigItem> = {
  sentinelone: { 
    name: 'SentinelOne', 
    color: 'primary',
    gradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
    border: 'border-purple-500/20 group-hover:border-purple-500/50',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    description: 'AI-Powered Endpoint Security',
    category: 'EDR'
  },
  crowdstrike: { 
    name: 'CrowdStrike', 
    color: 'danger',
    gradient: 'from-red-500/10 via-red-500/5 to-transparent',
    border: 'border-red-500/20 group-hover:border-red-500/50',
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-400',
    description: 'Cloud-Native Endpoint Protection',
    category: 'EDR'
  },
  aws: { 
    name: 'AWS CloudTrail', 
    color: 'warning', 
    gradient: 'from-orange-500/10 via-orange-500/5 to-transparent',
    border: 'border-orange-500/20 group-hover:border-orange-500/50',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
    description: 'AWS Log Ingestion & Threat Detection',
    category: 'Cloud'
  },
  openai: { 
    name: 'OpenAI', 
    color: 'success',
    gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    border: 'border-emerald-500/20 group-hover:border-emerald-500/50',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    description: 'GPT Models & AI Assistant',
    category: 'AI'
  },
  claude: { 
    name: 'Anthropic Claude', 
    color: 'warning',
    gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    border: 'border-amber-500/20 group-hover:border-amber-500/50',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    description: 'Safe & Helpful AI Assistant',
    category: 'AI'
  },
  gemini: { 
    name: 'Google Gemini', 
    color: 'secondary',
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    border: 'border-blue-500/20 group-hover:border-blue-500/50',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    description: 'Multimodal AI by Google',
    category: 'AI'
  },
  deepseek: { 
    name: 'DeepSeek', 
    color: 'primary',
    gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
    border: 'border-indigo-500/20 group-hover:border-indigo-500/50',
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-400',
    description: 'Open Source LLM',
    category: 'AI'
  },
  virustotal: {
    name: 'VirusTotal',
    color: 'primary',
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    border: 'border-blue-500/20 group-hover:border-blue-500/50',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    description: 'Threat Intelligence & IOC Enrichment',
    category: 'Enrichment'
  },
  abuseipdb: {
    name: 'AbuseIPDB',
    color: 'danger',
    gradient: 'from-red-500/10 via-pink-500/5 to-transparent',
    border: 'border-red-500/20 group-hover:border-red-500/50',
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-400',
    description: 'IP Reputation & Abuse Reports',
    category: 'Enrichment'
  },
  alienvault: {
    name: 'AlienVault OTX',
    color: 'secondary',
    gradient: 'from-cyan-500/10 via-cyan-500/5 to-transparent',
    border: 'border-cyan-500/20 group-hover:border-cyan-500/50',
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
    description: 'Open Threat Exchange Intelligence',
    category: 'Enrichment'
  },
  urlscan: {
    name: 'URLScan.io',
    color: 'warning',
    gradient: 'from-yellow-500/10 via-orange-500/5 to-transparent',
    border: 'border-yellow-500/20 group-hover:border-yellow-500/50',
    iconBg: 'bg-yellow-500/10',
    iconColor: 'text-yellow-400',
    description: 'URL & Domain Scanning',
    category: 'Enrichment'
  },
  azure: {
    name: 'Microsoft Azure',
    color: 'primary',
    gradient: 'from-blue-600/10 via-blue-400/5 to-transparent',
    border: 'border-blue-500/20 group-hover:border-blue-500/50',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    description: 'Azure Activity Logs & Security Center',
    category: 'Cloud'
  },
  gcp: {
    name: 'Google Cloud',
    color: 'warning',
    gradient: 'from-yellow-500/10 via-red-500/5 to-transparent',
    border: 'border-yellow-500/20 group-hover:border-yellow-500/50',
    iconBg: 'bg-yellow-500/10',
    iconColor: 'text-yellow-400',
    description: 'GCP Audit Logs & Security Command Center',
    category: 'Cloud'
  },
  m365: {
    name: 'Microsoft 365',
    color: 'secondary',
    gradient: 'from-indigo-500/10 via-blue-500/5 to-transparent',
    border: 'border-indigo-500/20 group-hover:border-indigo-500/50',
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-400',
    description: 'Exchange, SharePoint, Teams Audit Logs',
    category: 'SaaS'
  },
  jira: { 
    name: 'Jira Software', 
    color: 'primary',
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    border: 'border-blue-500/20 group-hover:border-blue-500/50',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    description: 'Issue & Project Tracking',
    category: 'Ticketing'
  },
  servicenow: { 
    name: 'ServiceNow', 
    color: 'success',
    gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    border: 'border-emerald-500/20 group-hover:border-emerald-500/50',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    description: 'IT Service Management (ITSM)',
    category: 'Ticketing'
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

interface CloudConfig {
    region?: string;
    tenantId?: string;
}

interface CloudCredentials {
    accessKeyId?: string;
    secretAccessKey?: string;
    clientId?: string;
    clientSecret?: string;
}

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
  config?: CloudConfig;
  credentials?: CloudCredentials;
  tokenExpiresAt?: string | null;  // ⏰ Token Expiry
}

export default function IntegrationPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { setPageContext } = usePageContext();
  
  // ⭐ Resync countdown state
  // const [resyncCountdown, setResyncCountdown] = useState<{ integrationId: string; seconds: number } | null>(null);
  
  // Mode: 'add' | 'edit'
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  // Selected Provider for Add
  const [modalType, setModalType] = useState<'s1' | 'cs' | 'ai' | 'enrichment' | 'aws' | 'm365' | 'ticketing'>('s1');
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
  
  // AWS Credentials
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [awsBucket, setAwsBucket] = useState('');
  const [awsRoleArn, setAwsRoleArn] = useState('');
  
  // ⭐ Ticketing State
  const [ticketingProvider, setTicketingProvider] = useState<'jira' | 'servicenow'>('jira');
  const [ticketingUrl, setTicketingUrl] = useState(''); // Domain or Instance URL
  const [ticketingUser, setTicketingUser] = useState(''); // Email or Username
  const [ticketingToken, setTicketingToken] = useState(''); // API Token or Password
  const [ticketingProjectKey, setTicketingProjectKey] = useState(''); // Jira Project Key
  const [autoSync, setAutoSync] = useState(false);

  // ⏰ Token Expiry State
  const [tokenExpiresAt, setTokenExpiresAt] = useState(''); // ISO Date string YYYY-MM-DD

  // Credential tracking states
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [hasExistingSecret, setHasExistingSecret] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  // Fetch Settings State
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

  // M365 State
  const [m365TenantId, setM365TenantId] = useState('');
  const [m365ClientId, setM365ClientId] = useState('');
  const [m365ClientSecret, setM365ClientSecret] = useState('');

  // ⭐ Test Connection State
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, 'success' | 'error' | null>>({});
  
  // 🔌 Reconnect State
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const [legacyRes, cloudRes] = await Promise.all([
         api.get('/integrations'),
         api.get('/cloud/integrations')
      ]);

      const legacyData = legacyRes.data;
      const cloudData = cloudRes.data.map((i: { id: string; provider: string; name: string; createdAt: string; status: string; lastError: string; lastSyncAt: string; config: CloudConfig; credentials: CloudCredentials }) => ({
          id: i.id,
          provider: i.provider, // 'aws' or 'm365'
          label: i.name, // Cloud service returns 'name'
          createdAt: i.createdAt,
          hasApiKey: true,
          lastSyncStatus: (i.status === 'error' ? 'error' : 'success') as 'error' | 'success', // Simple mapping
          lastSyncError: i.lastError,
          lastSyncAt: i.lastSyncAt,
          // Cloud specific config stashed in separate object if needed, or mapped to state in edit
          config: i.config,
          credentials: i.credentials // Masked
      }));

      const allIntegrations = [...legacyData, ...cloudData];
      setIntegrations(allIntegrations);
      
      // Update Page Context for AI Assistant
      const securityIntegrations = allIntegrations.filter((i: Integration) => i.provider === 'sentinelone' || i.provider === 'crowdstrike');
      const aiProviders = allIntegrations.filter((i: Integration) => ['openai', 'claude', 'gemini', 'deepseek'].includes(i.provider));
      
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
          totalIntegrations: allIntegrations.length,
        }
      });
    } catch (error) {
      console.error('Failed to fetch integrations', error);
    }
  }, [setPageContext]);

  // ⭐ Test Connection Handler
  const handleTestConnection = async (integrationId: string) => {
    setTestingId(integrationId);
    setTestResult(prev => ({ ...prev, [integrationId]: null }));
    
    try {
      await api.post(`/integrations/${integrationId}/test`);
      setTestResult(prev => ({ ...prev, [integrationId]: 'success' }));
      // Auto-clear success after 3 seconds
      setTimeout(() => {
        setTestResult(prev => ({ ...prev, [integrationId]: null }));
      }, 3000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setTestResult(prev => ({ ...prev, [integrationId]: 'error' }));
      alert(`Test Failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setTestingId(null);
      fetchIntegrations(); // Refresh to get updated sync status
    }
  };

  // 🔌 Reconnect Handler - Reset circuit breaker and retry
  const handleReconnect = async (integrationId: string) => {
    setReconnectingId(integrationId);
    
    try {
      const res = await api.post(`/integrations/${integrationId}/reset-circuit`);
      const data = res.data as { reconnected?: boolean; message?: string };
      
      if (data.reconnected) {
        toast.success('🔌 ' + (data.message || 'Reconnected successfully!'), {
          duration: 5000,
          style: {
            borderRadius: '10px',
            background: '#1A1D1F',
            color: '#fff',
            border: '1px solid rgba(34,197,94,0.5)'
          },
        });
      } else {
        toast.error('⚠️ ' + (data.message || 'Reconnect failed. Please check your credentials.'), {
          duration: 6000,
          style: {
            borderRadius: '10px',
            background: '#1A1D1F',
            color: '#fff',
            border: '1px solid rgba(239,68,68,0.5)'
          },
        });
      }
      
      fetchIntegrations(); // Refresh to get updated status
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      toast.error(`Reconnect Failed: ${err.response?.data?.error || err.message}`, {
        duration: 6000,
      });
    } finally {
      setReconnectingId(null);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // ⭐ handleOpenAdd
  const handleOpenAdd = (type: 's1' | 'cs' | 'ai' | 'enrichment' | 'aws' | 'm365' | 'ticketing', providerOverride?: string) => {
    setMode('add');
    setModalType(type);
    resetForm();
    
    // Reset Ticketing Defaults
    setAutoSync(false);
    setTicketingUrl('');
    setTicketingUser('');
    setTicketingToken('');
    setTicketingProjectKey('');

    if (type === 'ai' && providerOverride) {
      setAiProvider(providerOverride);
    } else if (type === 'enrichment' && providerOverride) {
      setLabel(
        providerOverride === 'virustotal' ? 'VirusTotal' : 
        providerOverride === 'alienvault' ? 'AlienVault OTX' :
        providerOverride === 'urlscan' ? 'URLScan.io' : 'AbuseIPDB'
      );
      setAiProvider(providerOverride);
    } else if (type === 'ticketing' && providerOverride) {
        setTicketingProvider(providerOverride as 'jira' | 'servicenow');
        setLabel(providerOverride === 'jira' ? 'Jira Software' : 'ServiceNow');
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

    // ⭐ Set Modal Type immediately to prevent stale state if API fails
    if (int.provider === 'sentinelone') {
      setModalType('s1');
      setS1Token('');
    } else if (int.provider === 'crowdstrike') {
      setModalType('cs');
      setCsSecret('');
    } else if (int.provider === 'virustotal' || int.provider === 'abuseipdb' || int.provider === 'alienvault' || int.provider === 'alienvault-otx') {
      setModalType('enrichment');
      setAiProvider(int.provider);
      setAiKey('');
    } else if (int.provider === 'aws') { // Changed from aws-cloudtrail to aws
      setModalType('aws');
      setAwsAccessKey('');
      setAwsSecretKey('');
    } else if (int.provider === 'm365') {
       setModalType('m365');
       setM365ClientSecret('');
    } else if (int.provider === 'jira' || int.provider === 'servicenow') {
        setModalType('ticketing');
        setTicketingProvider(int.provider as 'jira' | 'servicenow');
        setTicketingToken('');
    } else {
      setModalType('ai');
      setAiProvider(int.provider);
      setAiKey('');
    }
    
    // ⭐ Load existing config for edit
    try {
      // IF cloud provider, use data already in int (mapped from fetch)
      if (int.provider === 'aws' || int.provider === 'm365') {
          // ... (existing cloud logic)
          const cloudInt = int as Integration & { config: CloudConfig, credentials: CloudCredentials }; 
          if (int.provider === 'aws') {
              setAwsRegion(cloudInt.config?.region || 'us-east-1');
              setAwsAccessKey(cloudInt.credentials?.accessKeyId || '');
              setHasExistingSecret(true); // Always assume true for cloud
          } else if (int.provider === 'm365') {
              setM365TenantId(cloudInt.config?.tenantId || '');
              setM365ClientId(cloudInt.credentials?.clientId || '');
              setHasExistingSecret(true);
          }
      } else {
          const { data } = await api.get(`/integrations/${int.id}/config`);
          
          if (int.provider === 'sentinelone') {
            setS1Url(data.url || '');
            setHasExistingToken(data.hasToken || false);
            if (data.fetchSettings) {
              setS1FetchSettings(data.fetchSettings);
              setShowAdvanced(true);
            }
          } else if (int.provider === 'crowdstrike') {
            setCsBaseUrl(data.baseUrl || 'https://api.us-2.crowdstrike.com');
            setCsClientId(data.clientId || '');
            setHasExistingSecret(data.hasSecret || false);
            if (data.fetchSettings) {
              setCsFetchSettings(data.fetchSettings);
              setShowAdvanced(true);
            }
          } else if (int.provider === 'jira' || int.provider === 'servicenow') {
              setTicketingUrl(data.url || '');
              setTicketingUser(data.user || '');
              setTicketingProjectKey(data.projectKey || '');
              setAutoSync(data.autoSync || false);
              setHasExistingToken(data.hasToken || false);
          } else if (int.provider === 'virustotal' || int.provider === 'abuseipdb' || int.provider === 'alienvault' || int.provider === 'alienvault-otx') {
            setHasExistingKey(data.hasKey || false);
          } else {
            setAiModel(data.model || '');
            setAiBaseUrl(data.baseUrl || '');
            setHasExistingKey(data.hasKey || false);
          }
          
          // ⏰ Load Token Expiry
          if (int.tokenExpiresAt) {
            setTokenExpiresAt(new Date(int.tokenExpiresAt).toISOString().split('T')[0]);
          } else {
            setTokenExpiresAt('');
          }
      }
    } catch (e) {
      console.error('Failed to load config');
      // Even if config fails, we let the user edit (might overwrite)
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
            fetchSettings: s1FetchSettings,
          });
        } else if (modalType === 'cs') {
          await api.post('/integrations/crowdstrike', {
            baseUrl: csBaseUrl,
            clientId: csClientId,
            clientSecret: csSecret,
            label: label || 'CrowdStrike',
            fetchSettings: csFetchSettings,
          });
        } else if (modalType === 'ai') {
          await api.post(`/integrations/ai/${aiProvider}`, {
            apiKey: aiKey,
            label: label || aiProvider.toUpperCase(),
            model: aiModel || undefined,
            baseUrl: aiBaseUrl || undefined,
          });
        } else if (modalType === 'enrichment') {
          // Enrichment providers (VirusTotal, AbuseIPDB)
          await api.post(`/integrations/enrichment/${aiProvider}`, {
            apiKey: aiKey,
            label: label || (
                aiProvider === 'virustotal' ? 'VirusTotal' : 
                aiProvider === 'alienvault' ? 'AlienVault OTX' :
                aiProvider === 'urlscan' ? 'URLScan.io' : 'AbuseIPDB'
            ),
          });
        } else if (modalType === 'aws') {
          // Use New Cloud Controller
          await api.post('/cloud/integrations', {
            provider: 'aws',
            name: label || 'AWS CloudTrail',
            config: {
                region: awsRegion,
            },
            credentials: {
                accessKeyId: awsAccessKey,
                secretAccessKey: awsSecretKey
            }
          });
        } else if (modalType === 'm365') {
            // New M365 Integration
            await api.post('/cloud/integrations', {
                provider: 'm365',
                name: label || 'Microsoft 365',
                config: {
                    tenantId: m365TenantId
                },
                credentials: {
                    clientId: m365ClientId,
                    clientSecret: m365ClientSecret
                }
            });
        } else if (modalType === 'ticketing') {
            await api.post(`/integrations/ticketing/${ticketingProvider}`, {
                label: label || (ticketingProvider === 'jira' ? 'Jira' : 'ServiceNow'),
                url: ticketingUrl,
                user: ticketingUser,
                token: ticketingToken,
                projectKey: ticketingProvider === 'jira' ? ticketingProjectKey : undefined,
                autoSync: autoSync
            });
        }
      } else {
        // Edit Mode
        if (selectedIntegration) {
          const provider = selectedIntegration.provider;
          
          if (provider === 'aws' || provider === 'm365') {
             // Cloud Edit - For now, we only support delete and re-add for credentials securely, 
             // but let's implement delete only for MVP instructions or just recreate.
             // Actually, cloud controller doesn't support PUT yet.
             // We will suggest user to delete and re-add for now in the modal or just alert.
             // But let's assume valid flow is Delete -> Add.
             alert("For security reasons, please delete and re-add Cloud integrations to update credentials.");
             onClose();
             return;
          }

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
          } else if (provider === 'virustotal' || provider === 'abuseipdb' || provider === 'alienvault' || provider === 'alienvault-otx') {
            // Enrichment Provider
            await api.put(`/integrations/${selectedIntegration.id}`, {
              label: label,
              apiKey: aiKey || undefined, // undefined = keep existing
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

          // ⏰ Update Token Expiry if changed
          if (tokenExpiresAt !== (selectedIntegration.tokenExpiresAt ? new Date(selectedIntegration.tokenExpiresAt).toISOString().split('T')[0] : '')) {
             await api.put(`/integrations/${selectedIntegration.id}/token-expiry`, {
                expiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null
             });
          }
        }
      }

      fetchIntegrations();
      onClose();
      resetForm();
      
      // ⭐ Refetch integrations immediately
      fetchIntegrations();
      
      // Optional: a delayed fetch to catch status updates
      setTimeout(() => fetchIntegrations(), 5000);

    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      alert(err.response?.data?.error || 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, provider: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;
    try {
      if (provider === 'aws' || provider === 'm365') {
          await api.delete(`/cloud/integrations/${id}`);
      } else {
          await api.delete(`/integrations/${id}`);
      }
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
    setHasExistingToken(false);
    setHasExistingSecret(false);
    setHasExistingKey(false);
    
    setAwsAccessKey('');
    setAwsSecretKey('');
    setAwsRegion('us-east-1');
    setAwsBucket('');
    setAwsRoleArn('');
    
    setM365ClientId('');
    setM365ClientSecret('');
    setM365ClientSecret('');
    setM365TenantId('');
    
    setTokenExpiresAt('');
  };

  return (
    <div className="space-y-8">
      {/* ⭐ Header Section - Simple */}
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
          Integrations
        </h1>
        <p className="text-foreground/60 text-sm mt-1">Connect your security tools and AI providers</p>
      </div>

      {/* ⭐ Security Integrations Section */}
      <div className="space-y-4">
        <h2 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] flex items-center gap-2">
          <Icon.Wrench className="w-4 h-4 text-secondary" />
          Security & Cloud Tools
        </h2>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {['crowdstrike', 'sentinelone', 'aws', 'm365', 'azure', 'gcp', 'jira', 'servicenow'].map(provider => {
            // Find active integration for this provider
            const int = integrations.find(i => i.provider === provider);
            const isConfigured = !!int;
            // Fallback config if provider not found (shouldn't happen)
            const config: ProviderConfigItem = PROVIDER_CONFIG[provider] || { 
               name: provider, color: 'default', gradient: '', border: '', iconBg: '', iconColor: '', description: '' 
            };

            return isConfigured ? (
              // ⭐ Active Card
              <Card 
                key={int?.id} 
                className={`bg-gradient-to-br ${config.gradient} border ${config.border.replace('group-hover:', '')} transition-all duration-300`}
              >
                <CardBody className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center`}>
                      {PROVIDER_LOGOS[provider] ? (
                        <img src={PROVIDER_LOGOS[provider]} alt={provider} className="w-6 h-6 object-contain" />
                      ) : (
                        <Icon.Cloud className={`w-6 h-6 ${config.iconColor}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{config.name}</h3>
                        <div className={`w-2 h-2 rounded-full ${
                          int.lastSyncStatus === 'error' ? 'bg-danger' : 
                          int.lastSyncStatus === 'success' ? 'bg-success animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 
                          'bg-warning animate-pulse'
                        }`} />
                      </div>
                      <p className="text-xs text-default-400 capitalize truncate">{int.label}</p>
                    </div>
                    <Chip 
                      size="sm" 
                      color={int.lastSyncStatus === 'error' ? "danger" : int.lastSyncStatus === 'success' ? "success" : "warning"} 
                      variant="dot" 
                      classNames={{ 
                        base: `border-none ${int.lastSyncStatus === 'error' ? 'bg-danger/10' : config.iconBg}`, 
                        content: `${int.lastSyncStatus === 'error' ? 'text-danger' : config.iconColor} font-medium` 
                      }}
                    >
                      {int.lastSyncStatus === 'error' ? 'Error' : int.lastSyncStatus === 'success' ? 'Active' : 'Syncing'}
                    </Chip>
                  </div>
                  
                  {/* ⭐ Last Sync Display - Enhanced */}
                  <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-default-100/50 rounded-lg">
                     <Icon.Clock className={`w-3.5 h-3.5 ${
                        int.lastSyncAt && new Date(int.lastSyncAt).getTime() < Date.now() - 60 * 60 * 1000 
                          ? 'text-warning animate-pulse' 
                          : int.lastSyncAt ? 'text-success' : 'text-default-400'
                     }`} />
                     <span className="text-xs text-default-500 font-medium">
                        {int.lastSyncAt ? (
                          <>
                            Last sync: {new Date(int.lastSyncAt).toLocaleString(undefined, { 
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })}
                            {new Date(int.lastSyncAt).getTime() < Date.now() - 60 * 60 * 1000 && (
                              <span className="text-warning ml-1 font-semibold">(Stale)</span>
                            )}
                          </>
                        ) : (
                          <span className="text-default-400">Waiting for first sync...</span>
                        )}
                     </span>
                  </div>

                  {/* ⭐ API Key Display */}
                  {int.hasApiKey && (
                    <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-default-100/50 rounded-lg">
                       <Icon.Key className="w-3.5 h-3.5 text-success" />
                       <span className="text-xs text-default-500 font-medium">
                          Key: {int.keyId ? `••••${int.keyId.slice(-4)}` : 'Configured ✓'}
                       </span>
                    </div>
                  )}

                  {/* ⏰ Token Expiry Display */}
                  {(() => {
                    if (!int.tokenExpiresAt) {
                        return (
                           <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-default-100/50 rounded-lg border border-default-200/50">
                             <Icon.Calendar className="w-3.5 h-3.5 text-default-500" />
                             <span className="text-xs text-default-500 font-medium">Token Expiry: Not monitored</span>
                           </div>
                        );
                    }

                    const expiryDate = new Date(int.tokenExpiresAt);
                    const now = new Date();
                    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isExpired = daysRemaining <= 0;
                    const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;
                    const isWarning = daysRemaining > 7 && daysRemaining <= 30;
                    
                    return (
                      <div className={`flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg ${
                        isExpired ? 'bg-danger/20' :
                        isExpiringSoon ? 'bg-warning/20' :
                        isWarning ? 'bg-warning/10' : 'bg-default-100/50'
                      }`}>
                        <Icon.Calendar className={`w-3.5 h-3.5 ${
                          isExpired ? 'text-danger' :
                          isExpiringSoon ? 'text-warning animate-pulse' :
                          isWarning ? 'text-warning' : 'text-default-400'
                        }`} />
                        <span className={`text-xs font-medium ${
                          isExpired ? 'text-danger' :
                          isExpiringSoon ? 'text-warning' :
                          isWarning ? 'text-warning' : 'text-default-500'
                        }`}>
                          {isExpired ? (
                            <>Token expired {Math.abs(daysRemaining)} days ago!</>
                          ) : (
                            <>Token expires: {expiryDate.toLocaleDateString()} ({daysRemaining} days)</>
                          )}
                        </span>
                      </div>
                    );
                  })()}

                  <p className="text-xs text-default-600 mb-4 line-clamp-2 min-h-[20px]">
                    {config.description}
                  </p>


                  <div className="flex gap-2">
                    {/* 🔌 Reconnect Button - Show only when error */}
                    {int.lastSyncStatus === 'error' && (
                      <Button 
                        size="sm" 
                        variant="flat" 
                        className="bg-warning/20 hover:bg-warning/30 text-warning"
                        isIconOnly
                        isLoading={reconnectingId === int.id}
                        onPress={() => handleReconnect(int.id)}
                        title="Reset circuit and retry connection"
                      >
                        <Icon.Refresh className="w-4 h-4" />
                      </Button>
                    )}
                    {/* ⭐ Test Connection Button */}
                    <Button 
                      size="sm" 
                      variant="flat" 
                      className={`${
                        testResult[int.id] === 'success' ? 'bg-success/20 text-success' :
                        testResult[int.id] === 'error' ? 'bg-danger/20 text-danger' :
                        'bg-default-100 hover:bg-default-200'
                      }`}
                      isIconOnly
                      isLoading={testingId === int.id}
                      onPress={() => handleTestConnection(int.id)}
                      title="Test Connection"
                    >
                      {testResult[int.id] === 'success' ? (
                        <Icon.Check className="w-4 h-4" />
                      ) : testResult[int.id] === 'error' ? (
                        <Icon.XCircle className="w-4 h-4" />
                      ) : (
                        <Icon.Signal className="w-4 h-4" />
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      className={`flex-1 ${config.iconBg.replace('10', '5')} hover:${config.iconBg.replace('10', '20')} ${config.iconColor}`} 
                      onPress={() => handleOpenEdit(int)}
                    >
                      Configure
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      className="bg-danger/10 hover:bg-danger/20 text-danger" 
                      isIconOnly 
                      onPress={() => handleDelete(int.id, int.provider)}
                    >
                      <Icon.Delete className="w-4 h-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ) : (
              // ⭐ Configure Card (Not Connected)
              <button
                key={provider}
                onClick={() => handleOpenAdd(
                    provider === 'crowdstrike' ? 'cs' : 
                    provider === 'sentinelone' ? 's1' : 
                    provider === 'aws' ? 'aws' :
                    provider === 'm365' ? 'm365' : 
                    (provider === 'jira' || provider === 'servicenow') ? 'ticketing' : 'aws' 
                , provider)}
                className={`group relative overflow-hidden rounded-xl 
                           border ${config.border}
                           bg-gradient-to-br ${config.gradient}
                           w-full
                           transition-all duration-300 p-4 text-left h-full
                           hover:shadow-lg hover:shadow-${config.color}-500/5
                           active:scale-[0.98]`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${config.iconBg}`}>
                    {PROVIDER_LOGOS[provider] ? (
                      <img src={PROVIDER_LOGOS[provider]} alt={provider} className="w-7 h-7 object-contain" />
                    ) : (
                      <Icon.Cloud className={`w-7 h-7 ${config.iconColor}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`font-semibold transition-colors block group-hover:${config.iconColor.split(' ')[0]}`}>
                      {config.name}
                    </span>
                    <span className="text-xs text-default-400">
                      {config.category || 'Security Tool'}
                    </span>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${config.iconBg.replace('10', '5')} group-hover:${config.iconBg}`}>
                    <span className={`text-lg font-light ${config.iconColor}`}>+</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ⭐ AI Providers Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-default-600 flex items-center gap-2">
          <Icon.Cpu className="w-5 h-5 text-secondary" />
          AI Models
        </h2>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {['openai', 'claude', 'gemini', 'deepseek'].map(provider => {
            // Find active integration for this provider
            const int = integrations.find(i => i.provider === provider && i.id !== 'system-gemini');
            const isConfigured = !!int;
            
            // Get Config from PROVIDER_CONFIG directly
            const config: ProviderConfigItem = PROVIDER_CONFIG[provider] || { 
               name: provider, color: 'default', gradient: '', border: '', iconBg: '', iconColor: '', description: '' 
            };

            return isConfigured ? (
              // ⭐ Active Card
              <Card 
                key={int?.id} 
                className={`bg-gradient-to-br ${config.gradient} border ${config.border.replace('group-hover:', '')} transition-all duration-300`}
              >
                <CardBody className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center`}>
                      {PROVIDER_LOGOS[provider] ? (
                        <img src={PROVIDER_LOGOS[provider]} alt={provider} className="w-6 h-6 object-contain" />
                      ) : (
                        <Icon.Cpu className={`w-6 h-6 ${config.iconColor}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{config.name}</h3>
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                      </div>
                      <p className="text-xs text-default-400 capitalize">{int.label === provider ? config.name : int.label}</p>
                    </div>
                    <Chip 
                      size="sm" 
                      color="success"
                      variant="dot" 
                      classNames={{ 
                        base: `border-none ${config.iconBg}`, 
                        content: `${config.iconColor} font-medium` 
                      }}
                    >
                      Active
                    </Chip>
                  </div>
                  
                  <p className="text-xs text-default-600 mb-4 line-clamp-2 min-h-[32px]">
                    {config.description}
                  </p>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="flat" 
                      className={`flex-1 ${config.iconBg.replace('10', '5')} hover:${config.iconBg.replace('10', '20')} ${config.iconColor}`} 
                      onPress={() => handleOpenEdit(int)}
                    >
                      Configure
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      className="bg-danger/10 hover:bg-danger/20 text-danger" 
                      isIconOnly 
                      onPress={() => handleDelete(int.id, int.provider)}
                    >
                      <Icon.Delete className="w-4 h-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ) : (
              // ⭐ Configure Card (Not Connected)
              <button
                key={provider}
                onClick={() => handleOpenAdd('ai', provider)}
                className={`group relative overflow-hidden rounded-xl 
                           border ${config.border}
                           bg-gradient-to-br ${config.gradient}
                           w-full
                           transition-all duration-300 p-4 text-left h-full
                           hover:shadow-lg hover:shadow-${config.color}-500/5
                           active:scale-[0.98]`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${config.iconBg}`}>
                    {PROVIDER_LOGOS[provider] ? (
                      <img src={PROVIDER_LOGOS[provider]} alt={provider} className="w-7 h-7 object-contain" />
                    ) : (
                       <Icon.Cpu className={`w-7 h-7 ${config.iconColor}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`font-semibold transition-colors block group-hover:${config.iconColor.split(' ')[0]}`}>
                      {config.name}
                    </span>
                    <span className="text-xs text-default-400">
                      {config.description}
                    </span>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${config.iconBg.replace('10', '5')} group-hover:${config.iconBg}`}>
                    <span className={`text-lg font-light ${config.iconColor}`}>+</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ⭐ Enrichment Providers Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-default-600 flex items-center gap-2">
          <Icon.Shield className="w-5 h-5 text-primary" />
          Enrichment & Threat Intel
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {['virustotal', 'abuseipdb', 'alienvault', 'urlscan'].map(provider => {
             // Match alienvault or alienvault-otx from backend
             const int = integrations.find(i => 
               i.provider === provider || 
               (provider === 'alienvault' && i.provider === 'alienvault-otx')
             );
             const isConfigured = !!int;
             const config: ProviderConfigItem = PROVIDER_CONFIG[provider] || { 
                name: provider, color: 'default', gradient: '', border: '', iconBg: '', iconColor: '', description: '' 
             };
             
             return isConfigured ? (
               <Card 
                 key={int.id} 
                 className={`bg-gradient-to-br ${config.gradient} border ${config.border.replace('group-hover:', '')} transition-all duration-300`}
               >
                 <CardBody className="p-5">
                   <div className="flex items-center gap-3 mb-3">
                     <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center`}>
                       {config.name === 'VirusTotal' ? <Icon.Shield className={`w-5 h-5 ${config.iconColor}`} /> : <Icon.Global className={`w-5 h-5 ${config.iconColor}`} />}
                     </div>
                     <div className="flex-1">
                       <div className="flex items-center gap-2">
                         <h3 className="font-semibold text-sm">{config.name}</h3>
                         <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                       </div>
                       <p className="text-xs text-default-400 capitalize">{int.label}</p>
                     </div>
                     <Chip 
                        size="sm" 
                        color="success" 
                        variant="dot" 
                        classNames={{ 
                            base: `border-none ${config.iconBg}`, 
                            content: `${config.iconColor} font-medium` 
                        }}
                     >Active</Chip> 
                   </div>
                   
                   {/* ⭐ API Key Display */}
                   {int.hasApiKey && (
                     <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-default-100/50 rounded-lg">
                        <Icon.Key className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs text-default-500 font-medium">
                           Key: {int.keyId ? `••••${int.keyId}` : 'Configured ✓'}
                        </span>
                     </div>
                   )}
                   
                   {/* ⭐ Ready Status */}
                   <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-default-100/50 rounded-lg">
                      <Icon.Check className="w-3.5 h-3.5 text-success" />
                      <span className="text-xs text-default-500 font-medium">Ready for enrichment</span>
                   </div>
                   
                   <p className="text-xs text-default-600 mb-4 line-clamp-2 min-h-[32px]">
                     {config.description}
                   </p>
 
                   <div className="flex gap-2">
                     <Button 
                       size="sm" 
                       variant="flat" 
                       className={`flex-1 ${config.iconBg.replace('10', '5')} hover:${config.iconBg.replace('10', '20')} ${config.iconColor}`}
                       onPress={() => handleOpenEdit(int)}
                     >
                       Configure
                     </Button>
                     <Button 
                       size="sm" 
                       variant="flat" 
                       className="bg-danger/10 hover:bg-danger/20 text-danger" 
                       isIconOnly 
                       onPress={() => handleDelete(int.id, int.provider)}
                     >
                       <Icon.Delete className="w-4 h-4" />
                     </Button>
                   </div>
                 </CardBody>
               </Card>
             ) : (
               <button
                 key={provider}
                 onClick={() => handleOpenAdd('enrichment', provider)}
                 className={`group relative overflow-hidden rounded-xl 
                          border ${config.border}
                          bg-gradient-to-br ${config.gradient}
                          hover:shadow-lg hover:shadow-${config.color}-500/5
                          active:scale-[0.98]
                          transition-all duration-300 p-4 text-left h-full w-full`}
               >
                 <div className="flex items-center gap-3">
                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${config.iconBg}`}>
                      {provider === 'virustotal' ? <Icon.Shield className={`w-6 h-6 ${config.iconColor}`} /> : <Icon.Global className={`w-6 h-6 ${config.iconColor}`} />}
                   </div>
                   <div className="flex-1">
                     <span className={`font-semibold group-hover:${config.iconColor.split(' ')[0]} transition-colors block`}>{config.name}</span>
                     <span className="text-xs text-default-400">{config.description}</span>
                   </div>
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${config.iconBg.replace('10', '5')} group-hover:${config.iconBg}`}>
                     <span className={`text-lg font-light ${config.iconColor}`}>+</span>
                   </div>
                 </div>
               </button>
             );
          })}
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
                {modalType === 'enrichment' && (
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    PROVIDER_CONFIG[aiProvider as keyof typeof PROVIDER_CONFIG]?.iconBg || 'bg-default-100'
                  }`}>
                    {aiProvider === 'virustotal' ? (
                      <Icon.Shield className={`w-5 h-5 ${PROVIDER_CONFIG.virustotal.iconColor}`} />
                    ) : aiProvider === 'urlscan' ? (
                      <Icon.Globe className={`w-5 h-5 ${PROVIDER_CONFIG.urlscan.iconColor}`} />
                    ) : (
                      <Icon.Global className={`w-5 h-5 ${
                        PROVIDER_CONFIG[aiProvider as keyof typeof PROVIDER_CONFIG]?.iconColor || 'text-default-400'
                      }`} />
                    )}
                  </div>
                )}
                {modalType === 'aws' && (
                   <img src={AWSLogo} alt="AWS" className="w-8 h-8" />
                )}
                <div>
                  <h3 className="text-lg font-bold">
                    {mode === 'add' ? 'Add ' : 'Edit '}
                    {modalType === 's1' ? 'SentinelOne' : 
                     modalType === 'cs' ? 'CrowdStrike' : 
                     modalType === 'aws' ? 'AWS CloudTrail' :
                     modalType === 'm365' ? 'Microsoft 365' :
                     modalType === 'enrichment' ? (
                        PROVIDER_CONFIG[aiProvider as keyof typeof PROVIDER_CONFIG]?.name || 'Enrichment'
                     ) :
                     PROVIDER_CONFIG[aiProvider as keyof typeof PROVIDER_CONFIG]?.name || 'AI Provider'}
                  </h3>
                  <p className="text-xs text-default-400 font-normal">
                    {modalType === 's1' ? 'AI-Powered Endpoint Security' : 
                     modalType === 'cs' ? 'Cloud-Native Endpoint Protection' : 
                     modalType === 'aws' ? 'Cloud Log Ingestion' :
                     modalType === 'm365' ? 'SaaS Audit Logs' :
                     modalType === 'enrichment' ? 'Threat Intelligence & Enrichment' :
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

                {/* ⭐ AWS Form - Add & Edit */}
                {modalType === 'aws' && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="AWS Region"
                                placeholder="us-east-1"
                                value={awsRegion}
                                onValueChange={setAwsRegion}
                            />
                            <Input
                                label="S3 Bucket Name"
                                placeholder="my-cloudtrail-logs"
                                value={awsBucket}
                                onValueChange={setAwsBucket}
                            />
                        </div>
                        <Input
                             label="Access Key ID"
                             placeholder="AKIA..."
                             value={awsAccessKey}
                             onValueChange={setAwsAccessKey}
                        />
                         <Input
                              label="Secret Access Key"
                              placeholder={mode === 'edit' && hasExistingSecret ? '••••••• (Leave empty to keep existing)' : 'Enter Secret Key'}
                              description={mode === 'edit' && hasExistingSecret ? '✓ Secret exists - leave empty to keep, or enter new to replace' : undefined}
                              value={awsSecretKey}
                              onValueChange={setAwsSecretKey}
                              type="password"
                         />
                         <Input
                              label="Role ARN (Optional)"
                              placeholder="arn:aws:iam::123456789012:role/MyRole"
                              value={awsRoleArn}
                              onValueChange={setAwsRoleArn}
                         />
                        <p className="text-xs text-default-400 mt-2">
                             Ensure the IAM user/role has <code>s3:GetObject</code> and <code>s3:ListBucket</code> permissions for the specified bucket.
                        </p>
                    </>
                )}

                {/* ⭐ M365 Form - Add & Edit */}
                {modalType === 'm365' && (
                    <>
                        <Input
                             label="Tenant ID"
                             placeholder="e.g. 8456..."
                             value={m365TenantId}
                             onValueChange={setM365TenantId}
                             description="Directory (tenant) ID from Azure AD"
                        />
                        <Input
                             label="Client ID"
                             placeholder="e.g. 1234..."
                             value={m365ClientId}
                             onValueChange={setM365ClientId}
                             description="Application (client) ID"
                        />
                         <Input
                              label="Client Secret"
                              placeholder={mode === 'edit' && hasExistingSecret ? '••••••• (Leave empty to keep existing)' : 'Enter Client Secret'}
                              description={mode === 'edit' && hasExistingSecret ? '✓ Secret exists - leave empty to keep, or enter new to replace' : undefined}
                              value={m365ClientSecret}
                              onValueChange={setM365ClientSecret}
                              type="password"
                         />
                         <p className="text-xs text-default-400 mt-2">
                             Requires App Registration with <code>AuditLog.Read.All</code> and <code>SecurityEvents.Read.All</code> permissions.
                         </p>
                    </>
                )}

                {/* ⭐ Ticketing Form - Add & Edit */}
                {modalType === 'ticketing' && (
                    <>
                        <Input
                             label={ticketingProvider === 'jira' ? 'Jira Domain' : 'Instance URL'}
                             placeholder={ticketingProvider === 'jira' ? 'your-domain.atlassian.net' : 'https://dev12345.service-now.com'}
                             value={ticketingUrl}
                             onValueChange={setTicketingUrl}
                             description="Base URL for API access"
                        />
                        <Input
                             label={ticketingProvider === 'jira' ? 'Email Address' : 'Username'}
                             placeholder={ticketingProvider === 'jira' ? 'user@example.com' : 'admin'}
                             value={ticketingUser}
                             onValueChange={setTicketingUser}
                        />
                         <Input
                              label={ticketingProvider === 'jira' ? 'API Token' : 'Password/Token'}
                              placeholder={mode === 'edit' && hasExistingToken ? '••••••• (Leave empty to keep existing)' : 'Enter Secret'}
                              description={mode === 'edit' && hasExistingToken ? '✓ Secret exists - leave empty to keep, or enter new to replace' : undefined}
                              value={ticketingToken}
                              onValueChange={setTicketingToken}
                              type="password"
                         />
                         
                         {ticketingProvider === 'jira' && (
                             <Input
                                  label="Project Key"
                                  placeholder="SEC, ITSM, SOC"
                                  value={ticketingProjectKey}
                                  onValueChange={setTicketingProjectKey}
                                  description="Key of the project where issues will be created"
                             />
                         )}

                         <div className="flex items-center gap-3 p-3 bg-default-100 rounded-lg">
                            <Switch 
                                isSelected={autoSync}
                                onValueChange={setAutoSync}
                            />
                            <div>
                                <p className="text-sm font-medium">Auto-Create Tickets</p>
                                <p className="text-xs text-default-500">
                                    Automatically create a ticket when a Case is created in zcrAI
                                </p>
                            </div>
                         </div>
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

                {/* ⭐ Enrichment Provider Form - Add & Edit */}
                {modalType === 'enrichment' && (
                  <>
                    <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                      <div className="flex items-start gap-2">
                        <Icon.Info className="w-4 h-4 text-blue-400 mt-0.5" />
                        <div className="text-xs text-default-400">
                          <p className="font-medium text-blue-400 mb-1">
                            {PROVIDER_CONFIG[aiProvider as keyof typeof PROVIDER_CONFIG]?.name || 'Enrichment'} API Key
                          </p>
                          <p className="mb-1">
                            {aiProvider === 'virustotal' 
                              ? 'Get your free API key from virustotal.com (4 requests/minute)'
                              : aiProvider === 'alienvault'
                                ? 'Get your free API key from otx.alienvault.com'
                                : aiProvider === 'urlscan'
                                  ? 'Get your free API key from urlscan.io'
                                  : 'Get your free API key from abuseipdb.com (1000 requests/day)'}
                          </p>
                          <a 
                            href={aiProvider === 'virustotal' 
                              ? 'https://www.virustotal.com/gui/join-us' 
                              : aiProvider === 'alienvault'
                                ? 'https://otx.alienvault.com/api'
                                : aiProvider === 'urlscan'
                                  ? 'https://urlscan.io/about-api/'
                                  : 'https://www.abuseipdb.com/pricing'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            Get API Key →
                          </a>
                        </div>
                      </div>
                    </div>
                    
                    <Input
                      label="API Key"
                      placeholder={mode === 'edit' && hasExistingKey ? '••••••• (Leave empty to keep existing)' : 'Enter your API Key'}
                      description={mode === 'edit' && hasExistingKey ? '✓ API Key exists - leave empty to keep, or enter new to replace' : undefined}
                      value={aiKey}
                      onValueChange={setAiKey}
                      type="password"
                    />
                  </>
            )}
            
            {/* ⏰ Token Expiry Input - Available for all types in Edit Mode */}
            {mode === 'edit' && (
              <>
                 <Divider className="my-2" />
                 <Input
                    type="date"
                    label="Token Expiry Date (Optional)"
                    placeholder="Select expiry date"
                    value={tokenExpiresAt}
                    onValueChange={setTokenExpiresAt}
                    description="Set a reminder date for when this token expires."
                    variant="bordered"
                    startContent={<Icon.Calendar className="w-4 h-4 text-default-400" />}
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
