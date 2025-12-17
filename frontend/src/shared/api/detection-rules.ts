import { api } from './api';

export interface DetectionRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  query: string;
  isEnabled: boolean;
  runIntervalSeconds: number;
  lastRunAt?: string;
  mitreTechnique?: string;
  actions?: {
    auto_case?: boolean;
    case_title_template?: string;
    severity_override?: string;
    group_by?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export const DetectionRulesAPI = {
  list: async () => {
    const response = await api.get('/detection-rules');
    return response.data.data as DetectionRule[];
  },

  create: async (data: Partial<DetectionRule>) => {
    const response = await api.post('/detection-rules', data);
    return response.data.data as DetectionRule;
  },

  update: async (id: string, data: Partial<DetectionRule>) => {
    const response = await api.patch(`/detection-rules/${id}`, data);
    return response.data.data as DetectionRule;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/detection-rules/${id}`);
    return response.data;
  },

  runNow: async (id: string) => {
    const response = await api.post(`/detection-rules/${id}/run`);
    return response.data;
  }
};
