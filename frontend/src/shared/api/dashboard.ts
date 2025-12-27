import { api } from './api';

export interface MitreData {
  mitre_tactic: string;
  mitre_technique: string;
  count: string;
}

export const DashboardAPI = {
  getMitreHeatmap: (params: { startDate: string; endDate: string; mode?: 'detection' | 'coverage'; sources?: string[] }) => 
    api.get<MitreData[]>('/dashboard/mitre-heatmap', { params }),

  getFeedbackMetrics: () => api.get<any>('/dashboard/ai-feedback'),

  getAIMetrics: () => api.get<any>('/dashboard/ai-metrics'),

  getPerformanceMetrics: () => api.get<{ mtti: number; mttr: number; escalationRate: number; totalCases: number }>('/dashboard/performance'),

  getMitigationStats: (days: number = 7) => api.get<{ mitigated: number; not_mitigated: number; unknown: number }>('/dashboard/mitigation', { params: { days } }),
};
