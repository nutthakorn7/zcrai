import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertsFeedWidget } from './widgets';
import { api } from '../../shared/api/api';

// Mock API
vi.mock('../../shared/api/api', () => ({
  api: {
    get: vi.fn()
  }
}));

describe('AlertsFeedWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAlerts = [
    { id: '1', name: 'Ransomware Detected', severity: 'critical', description: 'Encrypted files found' },
    { id: '2', name: 'Failed Login', severity: 'medium', description: 'Multiple attempts' }
  ];

  it('renders loading state initially', () => {
    (api.get as any).mockReturnValue(new Promise(() => {}));
    render(<AlertsFeedWidget />);
    expect(screen.queryByText('Recent Alerts')).not.toBeInTheDocument();
  });

  it('renders alerts after fetch', async () => {
    (api.get as any).mockResolvedValue({ data: { data: mockAlerts } });

    render(<AlertsFeedWidget />);

    await waitFor(() => {
      expect(screen.getByText('Recent Alerts')).toBeInTheDocument();
    });

    expect(screen.getByText('Ransomware Detected')).toBeInTheDocument();
    expect(screen.getByText('Failed Login')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    (api.get as any).mockResolvedValue({ data: { data: [] } });

    render(<AlertsFeedWidget />);

    await waitFor(() => {
      expect(screen.getByText('No recent alerts')).toBeInTheDocument();
    });
  });

  it('handles API errors', async () => {
    // Suppress console error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (api.get as any).mockRejectedValue(new Error('Network error'));

    render(<AlertsFeedWidget />);

    await waitFor(() => {
       expect(screen.getByText('Recent Alerts')).toBeInTheDocument();
    });
    
    // Should show empty state or just the container
    expect(screen.getByText('No recent alerts')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
