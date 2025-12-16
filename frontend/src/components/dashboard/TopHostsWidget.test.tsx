import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopHostsWidget } from './widgets';
import { api } from '../../shared/api/api';

// Mock API
vi.mock('../../shared/api/api', () => ({
  api: {
    get: vi.fn()
  }
}));

describe('TopHostsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockHosts = [
    { hostname: 'web-server-01', count: 50 },
    { hostname: 'db-server-02', count: 30 }
  ];

  it('renders loading state', () => {
    (api.get as any).mockReturnValue(new Promise(() => {}));
    render(<TopHostsWidget />);
    expect(screen.queryByText('Top Hosts')).not.toBeInTheDocument();
  });

  it('renders fetched hosts', async () => {
    (api.get as any).mockResolvedValue({ data: { topHosts: mockHosts } });

    render(<TopHostsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Top Hosts')).toBeInTheDocument();
    });

    expect(screen.getByText('web-server-01')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('db-server-02')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    (api.get as any).mockResolvedValue({ data: { topHosts: [] } });

    render(<TopHostsWidget />);

    await waitFor(() => {
      expect(screen.getByText('No host data')).toBeInTheDocument();
    });
  });
});
