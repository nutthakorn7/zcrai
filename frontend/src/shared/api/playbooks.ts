import { api } from './api';

export interface PlaybookStep {
  id?: string;
  name: string;
  type: 'manual' | 'automation';
  order?: number;
  description?: string;
  actionId?: string;
  config?: any;
}

export interface Playbook {
  id: string;
  title: string;
  description?: string; // API sends string | null, frontend expects string | undefined usually?
  isActive: boolean;
  triggerType: 'manual' | 'auto_case_created';
  targetTag?: string;
  steps: PlaybookStep[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaybookExecution {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  playbook: Playbook;
  steps: PlaybookExecutionStep[];
  startedAt: string;
  completedAt?: string;
}

export interface PlaybookExecutionStep {
  id: string;
  stepId: string;
  step: PlaybookStep; // Include original step details
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: any;
  completedAt?: string;
}

export const PlaybooksAPI = {
  list: async () => {
    const res = await api.get<Playbook[]>('/playbooks');
    return res.data;
  },

  getById: async (id: string) => {
    const res = await api.get<Playbook>(`/playbooks/${id}`);
    return res.data;
  },

  create: async (data: Partial<Playbook>) => {
    const res = await api.post<Playbook>('/playbooks', data);
    return res.data;
  },

  update: async (id: string, data: Partial<Playbook>) => {
    const res = await api.put<Playbook>(`/playbooks/${id}`, data);
    return res.data;
  },

  delete: async (id: string) => {
    const res = await api.delete<Playbook>(`/playbooks/${id}`);
    return res.data;
  },

  run: async (caseId: string, playbookId: string) => {
    const res = await api.post<PlaybookExecution>('/playbooks/run', { caseId, playbookId });
    return res.data;
  },

  listExecutions: async (caseId: string) => {
    const res = await api.get<PlaybookExecution[]>(`/playbooks/executions?caseId=${caseId}`);
    return res.data;
  },

  updateStepStatus: async (executionId: string, stepId: string, status: string, result?: any) => {
    const res = await api.put(`/playbooks/executions/${executionId}/steps/${stepId}`, { status, result });
    return res.data;
  }
};
