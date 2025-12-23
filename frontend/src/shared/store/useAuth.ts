import { create } from 'zustand';
import { api } from '../api/api';

interface User {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  name?: string;
  jobTitle?: string;
  bio?: string;
  phoneNumber?: string;
}

interface LoginResponse {
  message?: string;
  user?: User;
  requireMFA?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: { email: string; password?: string; mfaCode?: string }) => Promise<LoginResponse>;
  register: (data: { email: string; password?: string; tenantName: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // เริ่มต้น true รอ checkAuth เสร็จก่อน

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', credentials);
      
      // ถ้าต้องการ MFA ยังไม่ set user
      if (data.requireMFA) {
        return data;
      }
      
      if (data.user) {
        set({ user: data.user, isAuthenticated: true });
      }
      return data;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (credentials) => {
    set({ isLoading: true });
    try {
      await api.post('/auth/register', credentials);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      set({ user: null, isAuthenticated: false });
    }
  },
  
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<User>('/auth/me');
      set({ user: data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  }
}));
