import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertDetailModal } from './AlertDetailModal';
import { AlertsAPI } from '../../shared/api/alerts';

// Mock API
vi.mock('../../shared/api/alerts', () => ({
  AlertsAPI: {
    getCorrelations: vi.fn()
  }
}));

// Mock child component CorrelationCard to simplify test
vi.mock('./CorrelationCard', () => ({
  CorrelationCard: ({ correlation }: any) => (
    <div data-testid="correlation-card">{correlation.reason}</div>
  )
}));

describe('AlertDetailModal', () => {
  const mockAlert = {
    id: '1',
    title: 'Test Alert',
    description: 'Test Description',
    severity: 'critical',
    status: 'new',
    source: 'sentinelone',
    createdAt: new Date().toISOString(),
    event_type: 'test',
    timestamp: new Date().toISOString(),
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    render(<AlertDetailModal alert={mockAlert} isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('Test Alert')).not.toBeInTheDocument();
  });

  it('renders alert details when open', async () => {
    (AlertsAPI.getCorrelations as any).mockResolvedValue([]);
    
    render(<AlertDetailModal alert={mockAlert} isOpen={true} onClose={mockOnClose} />);

    // Heroui Modal might render in portal, but testing-library screen usually finds it.
    await waitFor(() => {
      expect(screen.getByText('Test Alert')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('loads and displays correlations', async () => {
    const mockCorrelations = [{ id: 'c1', reason: 'same_source', relatedAlerts: [] }];
    (AlertsAPI.getCorrelations as any).mockResolvedValue(mockCorrelations);

    render(<AlertDetailModal alert={mockAlert} isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('correlation-card')).toBeInTheDocument();
    });
    
    expect(screen.getByText('same_source')).toBeInTheDocument();
  });

  it('displays no correlations message when empty', async () => {
    (AlertsAPI.getCorrelations as any).mockResolvedValue([]);

    render(<AlertDetailModal alert={mockAlert} isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('No related alerts found')).toBeInTheDocument();
    });
  });
});
