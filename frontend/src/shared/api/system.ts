import { api } from './api';

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

export interface LicenseInfo {
  key: string | null;
  status: 'active' | 'expired' | 'missing';
  users: number;
  retention: number;
  expiresAt: string;
}

export const SystemAPI = {
  getBackups: async (): Promise<BackupFile[]> => {
    const res = await api.get('/system/backups');
    return res.data.data;
  },

  triggerBackup: async () => {
    const res = await api.post('/system/backups');
    return res.data;
  },

  getLicense: async (): Promise<LicenseInfo> => {
    const res = await api.get('/system/license');
    return res.data.data;
  },

  updateLicense: async (key: string) => {
    const res = await api.post('/system/license', { key });
    return res.data;
  }
};
