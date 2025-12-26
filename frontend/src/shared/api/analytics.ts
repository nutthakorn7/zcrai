import { api } from './api';

export interface SankeyNode {
  name: string;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  stats: {
    escalated: number;
    notEscalated: number;
    determinationBreakdown: Record<string, number>;
    sourceBreakdown: Record<string, number>;
    timeSavedHours: number;
    timeSavedMinutes: number;
    totalAlerts: number;
    iocStats: {
      total: number;
      enriched: number;
      rate: number;
    };
  };
}

export const AnalyticsAPI = {
  getInsights: (days: number = 7) => 
    api.get<SankeyData>(`/analytics/insights?days=${days}`),
};
