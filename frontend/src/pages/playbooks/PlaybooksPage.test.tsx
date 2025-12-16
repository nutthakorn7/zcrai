import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlaybooksPage from './PlaybooksPage';
import { PlaybooksAPI } from '../../shared/api/playbooks';

// Mock API
vi.mock('../../shared/api/playbooks', () => ({
  PlaybooksAPI: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  }
}));

// Mock PlaybookEditor as it's complex and we just want to test entering it
vi.mock('./PlaybookEditor', () => ({
    default: ({ playbook, onClose, onDelete }: any) => (
        <div data-testid="playbook-editor">
            <h1>Editing: {playbook.title}</h1>
            <button onClick={onClose}>Close Editor</button>
            <button onClick={onDelete}>Delete Playbook</button>
        </div>
    )
}));

// Mock window.confirm
const mockConfirm = vi.fn();
window.confirm = mockConfirm;

describe('PlaybooksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  const mockPlaybooks = [
    { id: '1', title: 'Phishing Response', description: 'Auto-ban sender', isActive: true, steps: [] },
    { id: '2', title: 'Malware Cleanup', description: 'Isolate host', isActive: false, steps: [] }
  ];

  it('renders playbook list', async () => {
    (PlaybooksAPI.list as any).mockResolvedValue(mockPlaybooks);
    
    render(<PlaybooksPage />);

    // Initially loading
    expect(screen.getByText('Library')).toBeInTheDocument();
    
    // Wait for data
    await waitFor(() => {
        expect(screen.getByText('Phishing Response')).toBeInTheDocument();
        expect(screen.getByText('Malware Cleanup')).toBeInTheDocument();
    });
  });

  it('selects a playbook and opens editor', async () => {
    (PlaybooksAPI.list as any).mockResolvedValue(mockPlaybooks);
    
    render(<PlaybooksPage />);
    
    await waitFor(() => {
        expect(screen.getByText('Phishing Response')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Phishing Response')); // Click card

    await waitFor(() => {
        expect(screen.getByTestId('playbook-editor')).toBeInTheDocument();
        expect(screen.getByText('Editing: Phishing Response')).toBeInTheDocument();
    });
  });

  it('creates new playbook via manual button', async () => {
    (PlaybooksAPI.list as any).mockResolvedValue([]);
    const newPb = { id: '3', title: 'New Playbook', isActive: true, steps: [] };
    (PlaybooksAPI.create as any).mockResolvedValue(newPb);

    render(<PlaybooksPage />);

    const createBtn = screen.getByText('Create New');
    fireEvent.click(createBtn);

    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'New Playbook' } });
    
    const submitBtn = screen.getByRole('button', { name: 'Create Playbook' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
        expect(PlaybooksAPI.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Playbook' }));
    });
  });

  it('selects a template', async () => {
    (PlaybooksAPI.list as any).mockResolvedValue([]);
    render(<PlaybooksPage />);
     
    await waitFor(() => {
         expect(screen.getByText('Phishing Investigation')).toBeInTheDocument(); // Template
    });

    fireEvent.click(screen.getByText('Phishing Investigation'));

    // Modal should open pre-filled
    expect(screen.getByDisplayValue('Phishing Investigation')).toBeInTheDocument(); // Title input
    expect(screen.getByText('Steps Definition')).toBeInTheDocument();
  });
});
