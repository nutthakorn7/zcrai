import { api } from './api';

export interface SOARIntegration {
  id: string;
  provider: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SOARActionLog {
  id: string;
  tenantId: string;
  alertId?: string;
  caseId?: string;
  actionType: string;
  provider: string;
  target: string;
  status: string;
  result: any;
  error?: string;
  triggeredBy: string;
  userId?: string;
  createdAt: string;
}

export const SOARAPI = {
  listIntegrations: async () => {
    const response = await api.get('/soar/integrations');
    return response.data.data as SOARIntegration[];
  },

  saveSecret: async (provider: string, data: any) => {
    const response = await api.post('/soar/secrets', { provider, data });
    return response.data;
  },

  deleteSecret: async (id: string) => {
    const response = await api.delete(`/soar/secrets/${id}`);
    return response.data;
  },

  executeAction: async (params: {
    alertId?: string;
    caseId?: string;
    actionType: 'BLOCK_IP' | 'ISOLATE_HOST' | 'RESCIND_EMAIL' | 'KILL_PROCESS';
    provider: string;
    target: string;
  }) => {
    const response = await api.post('/soar/execute', params);
    return response.data;
  },

  getLogs: async () => {
    const response = await api.get('/soar/logs');
    return response.data.data as SOARActionLog[];
  }
};
