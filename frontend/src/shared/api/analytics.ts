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
    timeSavedHours: number;
  };
}

export const AnalyticsAPI = {
  getInsights: (days: number = 7) => 
    api.get<SankeyData>(`/analytics/insights?days=${days}`),
};
