import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from './useAuth';
import { api } from '../api/api';

// Mock the API module
vi.mock('../api/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useAuth.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true
    });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAuth());
    
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('should login successfully', async () => {
    const mockUser = {
      id: '123',
      email: 'test@zcr.ai',
      role: 'admin',
      tenantId: 'tenant-1'
    };
    
    // Setup mock response
    (api.post as any).mockResolvedValueOnce({
      data: {
        user: mockUser,
        requireMFA: false
      }
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login({ email: 'test@zcr.ai', password: 'password' });
    });

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'test@zcr.ai',
      password: 'password'
    });
    
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle MFA requirement during login', async () => {
    (api.post as any).mockResolvedValueOnce({
      data: {
        requireMFA: true
      }
    });

    const { result } = renderHook(() => useAuth());
    
    let loginResponse;
    await act(async () => {
      loginResponse = await result.current.login({ email: 'test@zcr.ai', password: 'password' });
    });

    expect(loginResponse).toEqual({ requireMFA: true });
    // User should not be set yet if MFA is required
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should logout successfully', async () => {
    // Set initial logged in state
    useAuth.setState({
      user: { id: '1', email: 'test@test.com', role: 'user', tenantId: '1' },
      isAuthenticated: true,
      isLoading: false
    });

    (api.post as any).mockResolvedValueOnce({});

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(api.post).toHaveBeenCalledWith('/auth/logout');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should check auth successfully', async () => {
    const mockUser = { id: '1', email: 'test@test.com', role: 'user', tenantId: '1' };
    (api.get as any).mockResolvedValueOnce({ data: mockUser });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle check auth failure', async () => {
    (api.get as any).mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
