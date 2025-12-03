// Interface definitions extracted from DashboardPage

export interface Summary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface TopHost {
  host_name: string;
  count: string;
  critical: string;
  high: string;
}

export interface TopUser {
  user_name: string;
  count: string;
  critical: string;
  high: string;
}

export interface SourceBreakdown {
  source: string;
  count: string;
}

export interface TimelineData {
  time: string;
  source: string;  // เพิ่ม source field เพื่อแยกตาม provider
  count: string;
  critical: string;
  high: string;
  medium: string;
  low: string;
}

export interface MitreData {
  mitre_tactic: string;
  mitre_technique: string;
  count: string;
}

export interface IntegrationData {
  integration_id: string;
  integration_name: string;
  source: string;
  count: string;
  critical: string;
  high: string;
}

export interface SiteData {
  source: string;
  host_account_name: string;
  host_site_name: string;
  count: string;
  critical: string;
  high: string;
}

export interface RecentDetection {
  id: string;
  severity: string;
  mitre_tactic: string;
  mitre_technique: string;
  timestamp: string;
  host_name: string;
  source: string;
}