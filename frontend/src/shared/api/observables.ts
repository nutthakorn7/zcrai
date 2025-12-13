import { api } from './api';

export interface Observable {
  id: string;
  tenantId: string;
  caseId?: string;
  alertId?: string;
  type: string;
  value: string;
  isMalicious?: boolean;
  tlpLevel: string;
  tags: string[];
  firstSeen: string;
  lastSeen: string;
  sightingCount: string;
  enrichmentData?: any;
  enrichedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const ObservablesAPI = {
  list: async (params?: {
    type?: string[];
    caseId?: string;
    alertId?: string;
    isMalicious?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.set('type', params.type.join(','));
    if (params?.caseId) queryParams.set('caseId', params.caseId);
    if (params?.alertId) queryParams.set('alertId', params.alertId);
    if (params?.isMalicious !== undefined) queryParams.set('isMalicious', params.isMalicious.toString());
    if (params?.search) queryParams.set('search', params.search);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const response = await api.get(`/observables?${queryParams.toString()}`);
    return response.data.data as Observable[];
  },

  create: async (data: {
    type: string;
    value: string;
    caseId?: string;
    alertId?: string;
    isMalicious?: boolean;
    tags?: string[];
  }) => {
    const response = await api.post('/observables', data);
    return response.data.data as Observable;
  },

  extract: async (text: string, caseId?: string, alertId?: string) => {
    const response = await api.post('/observables/extract', { text, caseId, alertId });
    return response.data.data as Observable[];
  },

  getById: async (id: string) => {
    const response = await api.get(`/observables/${id}`);
    return response.data.data as Observable;
  },

  enrich: async (id: string) => {
    const response = await api.patch(`/observables/${id}/enrich`);
    return response.data.data;
  },

  getSightings: async (id: string) => {
    const response = await api.get(`/observables/${id}/sightings`);
    return response.data.data;
  },

  setStatus: async (id: string, isMalicious: boolean) => {
    const response = await api.patch(`/observables/${id}/status`, { isMalicious });
    return response.data.data as Observable;
  },

  addTag: async (id: string, tag: string) => {
    const response = await api.post(`/observables/${id}/tags`, { tag });
    return response.data.data as Observable;
  },

  removeTag: async (id: string, tag: string) => {
    const response = await api.delete(`/observables/${id}/tags/${tag}`);
    return response.data.data as Observable;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/observables/${id}`);
    return response.data.data;
  },
};
