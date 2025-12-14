import { api } from './api';

export interface Case {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  assigneeId: string | null;
  assigneeName?: string;
  reporterId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCasePayload {
  title: string;
  description?: string;
  severity?: string;
  priority?: string;
  assigneeId?: string;
  tags?: string[];
}

export const CasesAPI = {
  list: async (params?: { status?: string, assigneeId?: string }) => {
    const res = await api.get<Case[]>('/cases', { params });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await api.get(`/cases/${id}`);
    return res.data;
  },

  create: async (data: CreateCasePayload) => {
    const res = await api.post<Case>('/cases', data);
    return res.data;
  },

  update: async (id: string, data: Partial<CreateCasePayload & { status: string }>) => {
    const res = await api.put<Case>(`/cases/${id}`, data);
    return res.data;
  },

  addComment: async (id: string, content: string) => {
    const res = await api.post(`/cases/${id}/comments`, { content });
    return res.data;
  },

  exportPDF: async (id: string) => {
    const res = await api.get(`/reports/cases/${id}/pdf`, {
      responseType: 'blob'
    });
    return res.data;
  },

  summarize: async (id: string) => {
    const res = await api.post<{ success: boolean; data: { summary: string } }>(`/cases/${id}/ai/summarize`);
    return res.data;
  },

  suggestPlaybook: async (id: string) => {
    const res = await api.post<{ success: boolean; data: { playbookId: string | null; confidence: number; reasoning: string } }>(`/cases/${id}/ai/suggest-playbook`);
    return res.data;
  }
};
