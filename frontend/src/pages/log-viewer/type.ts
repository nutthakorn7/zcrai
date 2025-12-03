export interface LogEntry {
  id: string;
  source: string;
  timestamp: string;
  severity: string;
  event_type: string;
  title: string;
  description: string;
  host_name: string;
  host_ip: string;
  user_name: string;
  mitre_tactic: string;
  mitre_technique: string;
  process_name: string;
  file_name: string;
  // Integration info
  integration_id: string;
  integration_name: string;
  // S1 Tenant info
  host_account_id: string;
  host_account_name: string;
  host_site_id: string;
  host_site_name: string;
  host_group_name: string;
}

export interface FilterOptions {
  integrations: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  sites: { id: string; name: string }[];
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}