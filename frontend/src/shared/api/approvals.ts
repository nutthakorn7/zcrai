import { api } from './api';

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  executionId: string;
  stepId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  actedBy?: string;
  actedAt?: string;
  comments?: string;
  playbook?: {
    id: string;
    title: string;
  };
  step?: {
    id: string;
    name: string;
    description: string;
  };
}

export const ApprovalsAPI = {
  listPending: async (): Promise<ApprovalRequest[]> => {
    const res = await api.get('/approvals/pending');
    return res.data.data;
  },

  decide: async (id: string, decision: 'approved' | 'rejected', comments?: string) => {
    const res = await api.post(`/approvals/${id}/decide`, { decision, comments });
    return res.data;
  }
};
