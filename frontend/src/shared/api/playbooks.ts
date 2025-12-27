import { api } from './api';

export interface PlaybookStep {
  id?: string;
  name: string;
  type: 'manual' | 'automation' | 'condition';
  order?: number;
  description?: string;
  actionId?: string;
  config?: any;
  positionX?: number;
  positionY?: number;
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

export interface Action {
  id: string;
  name: string;
  description: string;
  version: string;
  schema: any;
}

export const PlaybooksAPI = {
  // ... existing methods ...
  list: async () => {
    const res = await api.get<{success: boolean, data: Playbook[]}>('/playbooks');
    return res.data.data || [];
  },
  
  // ...
  
  getActions: async () => {
    const res = await api.get<{success: boolean, data: Action[]}>('/playbooks/actions');
    return res.data.data || [];
  },

  getById: async (id: string) => {
    const res = await api.get<{success: boolean, data: Playbook}>(`/playbooks/${id}`);
    return res.data.data;
  },

  create: async (data: Partial<Playbook>) => {
    const res = await api.post<{success: boolean, data: Playbook}>('/playbooks', data);
    return res.data.data;
  },

  update: async (id: string, data: Partial<Playbook>) => {
    const res = await api.put<{success: boolean, data: Playbook}>(`/playbooks/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string) => {
    const res = await api.delete<{success: boolean, data: any}>(`/playbooks/${id}`);
    return res.data.data;
  },

  run: async (caseId: string, playbookId: string) => {
    const res = await api.post<{success: boolean, data: PlaybookExecution}>('/playbooks/run', { caseId, playbookId });
    return res.data.data;
  },

  listExecutions: async (caseId: string) => {
    const res = await api.get<{success: boolean, data: PlaybookExecution[]}>(`/playbooks/executions?caseId=${caseId}`);
    return res.data.data || [];
  },

  listExecutionsByPlaybook: async (playbookId: string) => {
    const res = await api.get<{success: boolean, data: PlaybookExecution[]}>(`/playbooks/executions?playbookId=${playbookId}`);
    return res.data.data || [];
  },

  updateStepStatus: async (executionId: string, stepId: string, status: string, result?: any) => {
    const res = await api.put<{success: boolean, data: any}>(`/playbooks/executions/${executionId}/steps/${stepId}`, { status, result });
    return res.data.data;
  }
};
