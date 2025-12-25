import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsWidget } from './widgets';
import { api } from '../../shared/api';

// Mock API
vi.mock('../../shared/api', () => ({
  api: {
    get: vi.fn()
  }
}));

describe('StatsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    // Return a promise that doesn't resolve immediately to check loading state
    (api.get as any).mockReturnValue(new Promise(() => {}));
    
    render(<StatsWidget />);
    
    // Since Spinner doesn't have text, look for it by role or class if possible, 
    // or check that content is NOT present.
    expect(screen.queryByText('Total Alerts')).not.toBeInTheDocument();
  });

  it('renders stats after data fetch', async () => {
    const mockData = {
      alertCount: 150,
      bySeverity: {
        critical: 5,
        high: 10,
        medium: 20,
        low: 115
      },
      caseCount: 12
    };

    (api.get as any).mockResolvedValue({ data: mockData });

    render(<StatsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Total Alerts')).toBeInTheDocument();
    });

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Critical count
    expect(screen.getByText('Active Cases')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (api.get as any).mockRejectedValue(new Error('API Error'));

    render(<StatsWidget />);

    await waitFor(() => {
        // Even on error, it currently sets loading to false.
        // And if data is null, it renders stats with 0 values.
        expect(screen.getByText('Total Alerts')).toBeInTheDocument();
    });

    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0); // Check that at least one '0' is displayed

    consoleSpy.mockRestore();
  });
});
