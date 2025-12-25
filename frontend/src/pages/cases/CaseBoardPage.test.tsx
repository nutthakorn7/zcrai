import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseBoardPage from './index';
import { CasesAPI } from '@/shared/api';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('../../shared/api/cases', () => ({
  CasesAPI: {
    list: vi.fn(),
    create: vi.fn()
  }
}));

// Mock react-force-graph-2d as it uses canvas which is hard to test in jsdom
vi.mock('react-force-graph-2d', () => ({
  default: () => <div data-testid="force-graph">Graph View</div>
}));

// Mock child components that are already tested/not focus of page test
vi.mock('../../components/DonutCard', () => ({
  DonutCard: ({ title }: any) => <div data-testid="donut-card">{title} Donut</div>
}));

vi.mock('../../components/FilterBar', () => ({
  FilterBar: ({ onSavedFilterChange }: any) => (
    <div data-testid="filter-bar">
      <button onClick={() => onSavedFilterChange('critical')}>Filter Critical</button>
    </div>
  )
}));

// Mock hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

describe('CaseBoardPage', () => {
  const mockCases = [
    { id: '1', title: 'Critical Case', severity: 'critical', status: 'open', assigneeName: 'John', createdAt: new Date().toISOString() },
    { id: '2', title: 'Medium Case', severity: 'medium', status: 'resolved', assigneeName: 'Jane', createdAt: new Date().toISOString() }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders table view by default and loads cases', async () => {
    (CasesAPI.list as any).mockResolvedValue(mockCases);

    render(
        <MemoryRouter>
            <CaseBoardPage />
        </MemoryRouter>
    );

    await waitFor(() => {
        expect(screen.getByText('Critical Case')).toBeInTheDocument();
    });

    expect(screen.getByText('Medium Case')).toBeInTheDocument();
    expect(screen.getByText('Medium Case')).toBeInTheDocument();
    // HeroUI Table often uses 'grid' role or just div structures. 
    // We check if the table header is present instead.
    expect(screen.getByText('SEVERITY')).toBeInTheDocument(); 
    expect(screen.getByText('TITLE')).toBeInTheDocument();
    expect(CasesAPI.list).toHaveBeenCalledTimes(1);
    
    // Check Donut Cards render
    expect(screen.getByText('Severity Donut')).toBeInTheDocument();
  });

  it('switches to Kanban view', async () => {
    (CasesAPI.list as any).mockResolvedValue(mockCases);

    render(
        <MemoryRouter>
            <CaseBoardPage />
        </MemoryRouter>
    );

    const kanbanBtn = screen.getByText('Kanban');
    fireEvent.click(kanbanBtn);

    await waitFor(() => {
        // Check for Kanban specific elements like "Show Closed" button or columns
        expect(screen.getByText(/Hiding closed cases|Showing all statuses/)).toBeInTheDocument();
    });
    
    // In Kanban, cases are Cards, not table rows.
    // We can check if status columns are present
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Investigating')).toBeInTheDocument();
  });

  it('switches to Graph view', async () => {
    (CasesAPI.list as any).mockResolvedValue(mockCases);

    render(
        <MemoryRouter>
            <CaseBoardPage />
        </MemoryRouter>
    );

    const graphBtn = screen.getByText('Graph');
    fireEvent.click(graphBtn);

    await waitFor(() => {
        expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    });
  });

  it('handles empty state', async () => {
    (CasesAPI.list as any).mockResolvedValue([]);

    render(
        <MemoryRouter>
            <CaseBoardPage />
        </MemoryRouter>
    );

    await waitFor(() => {
        expect(screen.getByText('No cases found.')).toBeInTheDocument();
    });
  });

  it('opens create modal', async () => {
    (CasesAPI.list as any).mockResolvedValue(mockCases);
    
    render(
        <MemoryRouter>
            <CaseBoardPage />
        </MemoryRouter>
    );
    
    const newCaseBtn = screen.getByText('New Case');
    fireEvent.click(newCaseBtn);
    
    await waitFor(() => {
        expect(screen.getByText('Create New Case')).toBeInTheDocument();
    });
  });
});
