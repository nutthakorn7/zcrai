// Integration Types and Constants
import SentinelOneLogo from '../../assets/logo/sentinelone.png';
import CrowdStrikeLogo from '../../assets/logo/crowdstrike.png';
import OpenAILogo from '../../assets/logo/openai.png';
import ClaudeLogo from '../../assets/logo/claude.png';
import GeminiLogo from '../../assets/logo/gemini.png';
import AWSLogo from '../../assets/logo/aws.png';

// ⭐ Provider Logo Map
export const PROVIDER_LOGOS: Record<string, string> = {
  sentinelone: SentinelOneLogo,
  crowdstrike: CrowdStrikeLogo,
  openai: OpenAILogo,
  claude: ClaudeLogo,
  gemini: GeminiLogo,
  'aws-cloudtrail': AWSLogo,
};

// ⭐ Provider Config
export interface ProviderConfig {
  name: string;
  color: string;
  gradient: string;
  description: string;
  category?: string;
}

export const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
  sentinelone: { 
    name: 'SentinelOne', 
    color: 'primary',
    gradient: 'from-purple-500/20 to-purple-600/10',
    description: 'AI-Powered Endpoint Security',
    category: 'EDR'
  },
  crowdstrike: { 
    name: 'CrowdStrike', 
    color: 'danger',
    gradient: 'from-red-500/20 to-orange-500/10',
    description: 'Cloud-Native Endpoint Protection',
    category: 'EDR'
  },
  aws: { 
    name: 'AWS CloudTrail', 
    color: 'warning', 
    gradient: 'from-orange-500/20 to-amber-500/10',
    description: 'AWS Log Ingestion & Threat Detection',
    category: 'Cloud'
  },
  openai: { 
    name: 'OpenAI', 
    color: 'success',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    description: 'GPT Models & AI Assistant',
    category: 'AI'
  },
  claude: { 
    name: 'Anthropic Claude', 
    color: 'warning',
    gradient: 'from-amber-500/20 to-orange-400/10',
    description: 'Safe & Helpful AI Assistant',
    category: 'AI'
  },
  gemini: { 
    name: 'Google Gemini', 
    color: 'secondary',
    gradient: 'from-blue-500/20 to-cyan-400/10',
    description: 'Multimodal AI by Google',
    category: 'AI'
  },
  virustotal: {
    name: 'VirusTotal',
    color: 'primary',
    gradient: 'from-blue-500/20 to-indigo-500/10',
    description: 'Threat Intelligence & IOC Enrichment',
    category: 'Enrichment'
  },
  abuseipdb: {
    name: 'AbuseIPDB',
    color: 'danger',
    gradient: 'from-red-500/20 to-pink-500/10',
    description: 'IP Reputation & Abuse Reports',
    category: 'Enrichment'
  },
  alienvault: {
    name: 'AlienVault OTX',
    color: 'secondary',
    gradient: 'from-cyan-500/20 to-blue-500/10',
    description: 'Open Threat Exchange Intelligence',
    category: 'Enrichment'
  },
  azure: {
    name: 'Microsoft Azure',
    color: 'primary',
    gradient: 'from-blue-600/20 to-blue-400/10',
    description: 'Azure Activity Logs & Security Center',
    category: 'Cloud'
  },
  gcp: {
    name: 'Google Cloud',
    color: 'warning',
    gradient: 'from-yellow-500/20 to-red-500/10',
    description: 'GCP Audit Logs & Security Command Center',
    category: 'Cloud'
  },
  m365: {
    name: 'Microsoft 365',
    color: 'secondary',
    gradient: 'from-indigo-500/20 to-blue-500/10',
    description: 'Exchange, SharePoint, Teams Audit Logs',
    category: 'SaaS'
  },
};

// ⭐ Fetch Settings Types
export interface FetchSettingItem {
  enabled: boolean;
  days: number;
}

export interface S1FetchSettings {
  threats: FetchSettingItem;
  activities: FetchSettingItem;
  alerts: FetchSettingItem;
}

export interface CSFetchSettings {
  alerts: FetchSettingItem;
  detections: FetchSettingItem;
  incidents: FetchSettingItem;
}

// Day options for Select
export const DAY_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 120, label: '120 days (Recommended for Activities)' },
  { value: 180, label: '180 days' },
  { value: 365, label: '365 days (Full Year)' },
];

// Integration Interface
export interface Integration {
  id: string;
  provider: string;
  label: string;
  createdAt: string;
  hasApiKey: boolean;
  lastSyncStatus: 'success' | 'error' | 'pending' | null;
  lastSyncError: string | null;
  lastSyncAt: string | null;
  fetchSettings?: S1FetchSettings | CSFetchSettings | null;
  maskedUrl?: string | null;
  keyId?: string | null;
  config?: Record<string, any>;
  credentials?: Record<string, any>;
}

// Modal Types
export type ModalType = 's1' | 'cs' | 'ai' | 'enrichment' | 'aws' | 'm365';

// Popular AI Models
export const POPULAR_MODELS: Record<string, string[]> = {
  openai: ['gpt-5.1', 'gpt-5-pro', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  claude: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5', 'claude-3-5-sonnet-20240620'],
  gemini: ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
};

// Default Fetch Settings
export const DEFAULT_S1_SETTINGS: S1FetchSettings = {
  threats: { enabled: true, days: 365 },
  activities: { enabled: true, days: 120 },
  alerts: { enabled: true, days: 365 },
};

export const DEFAULT_CS_SETTINGS: CSFetchSettings = {
  alerts: { enabled: true, days: 365 },
  detections: { enabled: true, days: 365 },
  incidents: { enabled: true, days: 365 },
};

// Preload Images
export const preloadImages = () => {
  [SentinelOneLogo, CrowdStrikeLogo, OpenAILogo, ClaudeLogo, GeminiLogo, AWSLogo].forEach(src => {
    const img = new Image();
    img.src = src;
  });
};

// Helper to get color classes by provider color
export const getColorClasses = (color: string) => ({
  bgLight: color === 'primary' ? 'bg-purple-500/20' : 
           color === 'danger' ? 'bg-red-500/20' :
           color === 'warning' ? 'bg-orange-500/20' :
           color === 'success' ? 'bg-emerald-500/20' :
           color === 'secondary' ? 'bg-blue-500/20' :
           'bg-default-100',
  bgHover: color === 'primary' ? 'hover:bg-purple-500/30' : 
           color === 'danger' ? 'hover:bg-red-500/30' :
           color === 'warning' ? 'hover:bg-orange-500/30' :
           color === 'success' ? 'hover:bg-emerald-500/30' :
           color === 'secondary' ? 'hover:bg-blue-500/30' :
           'hover:bg-default-200',
  text: color === 'primary' ? 'text-purple-400' : 
        color === 'danger' ? 'text-red-400' :
        color === 'warning' ? 'text-orange-400' :
        color === 'success' ? 'text-emerald-400' :
        color === 'secondary' ? 'text-blue-400' :
        'text-default-400',
  border: color === 'primary' ? 'border-purple-500/20 hover:border-purple-500/40' : 
          color === 'danger' ? 'border-red-500/20 hover:border-red-500/40' :
          color === 'warning' ? 'border-orange-500/20 hover:border-orange-500/40' :
          color === 'success' ? 'border-emerald-500/20 hover:border-emerald-500/40' :
          color === 'secondary' ? 'border-blue-500/20 hover:border-blue-500/40' :
          'border-default-200',
});
