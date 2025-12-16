import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ActionsPage from './index';
import { ApprovalsAPI } from '../../shared/api/approvals';
import { InputsAPI } from '../../shared/api/inputs';

// Mock API
vi.mock('../../shared/api/approvals', () => ({
  ApprovalsAPI: {
    listPending: vi.fn(),
    decide: vi.fn(),
  },
}));

vi.mock('../../shared/api/inputs', () => ({
  InputsAPI: {
    listPending: vi.fn(),
    submit: vi.fn(),
  },
}));

describe('ActionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (ApprovalsAPI.listPending as any).mockResolvedValue([]);
    (InputsAPI.listPending as any).mockResolvedValue([]);
    render(<ActionsPage />);
  });

  it('renders approvals list by default', async () => {
    const mockApprovals = [
      {
        id: '1',
        executionId: 'exec-1',
        stepId: 'step-1',
        status: 'pending',
        requestedAt: new Date().toISOString(),
        playbook: { title: 'Phishing Check' },
        step: { name: 'Approval Step' }
      }
    ];
    (ApprovalsAPI.listPending as any).mockResolvedValue(mockApprovals);
    (InputsAPI.listPending as any).mockResolvedValue([]);
    render(<ActionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Phishing Check')).toBeInTheDocument();
      expect(screen.getByText('Approval Step')).toBeInTheDocument();
    });
  });

  it('switches to inputs tab and renders inputs', async () => {
    const mockInputs = [
        {
          id: '2',
          executionId: 'exec-2',
          stepId: 'step-2',
          status: 'pending',
          requestedAt: new Date().toISOString(),
          playbook: { title: 'Incident Response' },
          step: { name: 'Input Ticket ID' }
        }
      ];
    (ApprovalsAPI.listPending as any).mockResolvedValue([]);
    (InputsAPI.listPending as any).mockResolvedValue(mockInputs);
    
    render(<ActionsPage />);

    // Wait for load
    await waitFor(() => screen.getByText('Approvals'));

    // Switch Tab (Assuming Heroui Tabs render accessible buttons/tabs)
    const inputsTab = screen.getByText('Inputs');
    fireEvent.click(inputsTab);

    await waitFor(() => {
        expect(screen.getByText('Incident Response')).toBeInTheDocument();
        expect(screen.getByText('Input Ticket ID')).toBeInTheDocument();
    });
  });

  it('opens input modal', async () => {
    const mockInputs = [
        {
          id: '2',
          executionId: 'exec-2',
          stepId: 'step-2',
          status: 'pending',
          requestedAt: new Date().toISOString(),
          playbook: { title: 'IR Playbook' },
          step: { name: 'Input Data' },
          inputSchema: {
            properties: {
                ticketId: { type: 'string', title: 'Ticket ID' }
            }
          }
        }
      ];
    (ApprovalsAPI.listPending as any).mockResolvedValue([]);
    (InputsAPI.listPending as any).mockResolvedValue(mockInputs);
    
    render(<ActionsPage />);
    await waitFor(() => screen.getByText('Inputs'));
    fireEvent.click(screen.getByText('Inputs'));

    await waitFor(() => screen.getByText('Provide Input'));
    fireEvent.click(screen.getByText('Provide Input'));

    await waitFor(() => {
        expect(screen.getByLabelText('Ticket ID')).toBeInTheDocument();
    });
  });
});
