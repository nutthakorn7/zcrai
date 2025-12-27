import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminDashboard from './index';
import { api } from '../../shared/api';
import { BrowserRouter } from 'react-router-dom';

// Mock API
vi.mock('../../shared/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

// Mock Recharts (ResizeObserver issue often happens in tests)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTenants = [
    { id: '1', name: 'Acme Corp', status: 'active', userCount: 10, integrationCount: 2, eventCount: 1000, createdAt: '2023-01-01' },
    { id: '2', name: 'Beta Ltd', status: 'inactive', userCount: 5, integrationCount: 0, eventCount: 0, createdAt: '2023-02-01' }
  ];

  const mockSummary = {
    tenants: 2, users: 15, integrations: 2, events: 1000
  };

  const mockHealth = {
    database: 'connected', clickhouse: 'connected', redis: 'connected', status: 'healthy'
  };

  it('renders dashboard with stats', async () => {
    (api.get as any).mockImplementation((url: string) => {
        if (url === '/admin/tenants') return Promise.resolve({ data: mockTenants });
        if (url === '/admin/summary') return Promise.resolve({ data: mockSummary });
        if (url === '/admin/health') return Promise.resolve({ data: mockHealth });
        return Promise.resolve({ data: {} });
    });

    render(
        <BrowserRouter>
            <AdminDashboard />
        </BrowserRouter>
    );

    await waitFor(() => {
        expect(screen.getByText('Super Admin Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Ltd')).toBeInTheDocument();
    
    // Check Status Chips
    expect(screen.getByText('DB: connected')).toBeInTheDocument();
  });

  it('opens tenant details modal', async () => {
    (api.get as any).mockImplementation((url: string) => {
        if (url === '/admin/tenants') return Promise.resolve({ data: mockTenants });
        if (url === '/admin/summary') return Promise.resolve({ data: mockSummary });
        if (url === '/admin/health') return Promise.resolve({ data: mockHealth });
        // Tenant details
        if (url.includes('/users')) return Promise.resolve({ data: [{ id: 'u1', email: 'admin@acme.com', role: 'tenant_admin', status: 'active' }] });
        if (url.includes('/usage')) return Promise.resolve({ data: [] });
        return Promise.resolve({ data: {} });
    });

    render(
        <BrowserRouter>
            <AdminDashboard />
        </BrowserRouter>
    );

    await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    const detailsBtns = screen.getAllByText('Details');
    fireEvent.click(detailsBtns[0]); // Click first tenant details

    await waitFor(() => {
        expect(screen.getByText('Tenant Details: Acme Corp')).toBeInTheDocument();
        expect(screen.getByText('admin@acme.com')).toBeInTheDocument(); // User loaded
    });
  });

  it('impersonates tenant', async () => {
    (api.get as any).mockResolvedValue({ data: [] }); // Default
    (api.get as any).mockImplementation((url: string) => {
        if (url === '/admin/tenants') return Promise.resolve({ data: mockTenants });
        return Promise.resolve({ data: {} });
    });
    
    // Mock location reload
    const originalReload = window.location.reload;
    Object.defineProperty(window, 'location', {
        writable: true,
        value: { reload: vi.fn() }
    });

    render(
        <BrowserRouter>
            <AdminDashboard />
        </BrowserRouter>
    );

    await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    const viewAsBtns = screen.getAllByText('View As');
    fireEvent.click(viewAsBtns[0]);

    expect(api.post).toHaveBeenCalledWith('/admin/impersonate/1');
    
    // Restore
    window.location.reload = originalReload;
  });
});
