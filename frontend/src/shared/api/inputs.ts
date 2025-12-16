import { api } from './api';

export interface InputRequest {
  id: string;
  tenantId: string;
  executionId: string;
  stepId: string;
  status: 'pending' | 'submitted';
  inputSchema: any;
  requestedAt: string;
  respondedBy?: string;
  respondedAt?: string;
  playbook?: {
    title: string;
  };
  step?: {
    name: string;
    description?: string;
  };
}

export const InputsAPI = {
  listPending: async (): Promise<InputRequest[]> => {
    const res = await api.get('/inputs/pending');
    return res.data.data;
  },

  submit: async (id: string, data: any) => {
    const res = await api.post(`/inputs/${id}/submit`, data);
    return res.data;
  }
};
