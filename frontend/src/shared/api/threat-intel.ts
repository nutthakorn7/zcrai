import { api } from './api';

export const ThreatIntelAPI = {
  retroScan: async (type: 'ip' | 'hash' | 'domain', value: string, days: number = 90) => {
    const res = await api.post('/threat-intel/retro-scan', { type, value, days });
    return res.data.data;
  },

  lookup: async (type: 'ip' | 'hash' | 'domain', value: string) => {
    const res = await api.post('/threat-intel/lookup', { type, value });
    return res.data.data;
  }
};
