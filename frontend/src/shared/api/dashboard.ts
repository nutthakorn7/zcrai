import { api } from './api';

export interface MitreData {
  mitre_tactic: string;
  mitre_technique: string;
  count: string;
}

export const DashboardAPI = {
  getMitreHeatmap: (params: { startDate: string; endDate: string; mode?: 'detection' | 'coverage'; sources?: string[] }) => 
    api.get<MitreData[]>('/dashboard/mitre-heatmap', { params }),
};
