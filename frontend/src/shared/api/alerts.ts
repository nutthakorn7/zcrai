import { api } from './api';

export interface Alert {
  id: string;
  tenantId: string;
  source: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  rawData?: any;
  correlationId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  dismissReason?: string;
  promotedCaseId?: string;
  createdAt: string;
  updatedAt: string;
  fingerprint?: string;
  duplicateCount?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  
  // AI Auto-Triage
  aiAnalysis?: {
    classification: 'FALSE_POSITIVE' | 'TRUE_POSITIVE';
    confidence: number;
    reasoning: string;
    suggested_action: string;
    investigationReport?: string; // Phase 3: Investigation Summary
    actionTaken?: {
      type: string;
      target: string;
      status: string;
      details: string;
      timestamp: string;
      multipleActions?: Array<{
        type: string;
        target: string;
        status: string;
        details: string;
        timestamp: string;
      }>;
    };
    swarmFindings?: Array<{
      agent: string;
      status: string;
      summary: string;
      data?: any;
    }>;
  };
  aiTriageStatus?: 'pending' | 'processed' | 'failed';
}

export interface AlertCorrelation {
  id: string;
  tenantId: string;
  primaryAlertId: string;
  relatedAlertIds: string[];
  reason: 'time_window' | 'same_source_severity' | 'same_ioc';
  confidence: string; // Stored as string in DB, e.g. "0.75"
  createdAt: string;
  relatedAlerts?: Alert[]; // Populated by API
}


export const AlertsAPI = {
  list: async (params?: {
    status?: string[];
    severity?: string[];
    source?: string[];
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status.join(','));
    if (params?.severity) queryParams.set('severity', params.severity.join(','));
    if (params?.source) queryParams.set('source', params.source.join(','));
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const response = await api.get(`/alerts?${queryParams.toString()}`);
    return response.data.data as Alert[];
  },

  create: async (data: {
    source: string;
    severity: string;
    title: string;
    description: string;
    rawData?: any;
  }) => {
    const response = await api.post('/alerts', data);
    return response.data.data as Alert;
  },

  getById: async (id: string) => {
    const response = await api.get(`/alerts/${id}`);
    return response.data.data as Alert & { correlations?: any[] };
  },

  review: async (id: string) => {
    const response = await api.patch(`/alerts/${id}/review`);
    return response.data.data as Alert;
  },

  dismiss: async (id: string, reason: string) => {
    const response = await api.patch(`/alerts/${id}/dismiss`, { reason });
    return response.data.data as Alert;
  },

  promoteToCase: async (id: string, caseData?: {
    title?: string;
    description?: string;
    priority?: string;
  }) => {
    const response = await api.post(`/alerts/${id}/promote`, caseData || {});
    return response.data.data;
  },

  bulkDismiss: async (alertIds: string[], reason: string) => {
    const response = await api.post('/alerts/bulk-dismiss', { alertIds, reason });
    return response.data.data as Alert[];
  },

  bulkPromote: async (alertIds: string[], caseData: {
    title: string;
    description: string;
    priority?: string;
  }) => {
    const response = await api.post('/alerts/bulk-promote', { alertIds, caseData });
    return response.data.data;
  },

  getCorrelations: async (id: string) => {
    const response = await api.get(`/alerts/${id}/correlations`);
    return response.data.data as AlertCorrelation[];
  },

  getStats: async () => {
    const response = await api.get('/alerts/stats/summary');
    return response.data.data;
  },
};
