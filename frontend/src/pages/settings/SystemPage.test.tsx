import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SystemPage from './SystemPage';
import { SystemAPI } from '../../shared/api/system';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock SystemAPI
vi.mock('../../shared/api/system', () => ({
  SystemAPI: {
    getBackups: vi.fn(),
    triggerBackup: vi.fn(),
    getLicense: vi.fn(),
    updateLicense: vi.fn(),
  }
}));

describe('SystemPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders tabs', async () => {
        // Mock empty responses
        vi.mocked(SystemAPI.getBackups).mockResolvedValue([]);
        vi.mocked(SystemAPI.getLicense).mockResolvedValue({} as any);

        render(<SystemPage />);
        expect(screen.getByText('Backups')).toBeInTheDocument();
        expect(screen.getByText('License')).toBeInTheDocument();
    });

    it('displays backups list', async () => {
        const mockBackups = [
            { name: 'backup1.sql', size: 1024 * 1024, createdAt: '2023-01-01T10:00:00Z' },
            { name: 'backup2.sql', size: 2 * 1024 * 1024, createdAt: '2023-01-02T10:00:00Z' }
        ];
        vi.mocked(SystemAPI.getBackups).mockResolvedValue(mockBackups);

        render(<SystemPage />);

        await waitFor(() => {
            expect(screen.getByText('backup1.sql')).toBeInTheDocument();
            expect(screen.getByText('1.00 MB')).toBeInTheDocument();
        });
    });

    it('triggers backup', async () => {
        vi.mocked(SystemAPI.getBackups).mockResolvedValue([]);
        vi.mocked(SystemAPI.triggerBackup).mockResolvedValue({ success: true });
        
        // Mock alert
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

        render(<SystemPage />);
        
        const triggerBtn = screen.getByText('Trigger Backup');
        fireEvent.click(triggerBtn);

        await waitFor(() => {
            expect(SystemAPI.triggerBackup).toHaveBeenCalled();
            expect(alertMock).toHaveBeenCalledWith('Backup started');
        });
    });

    it('displays license info', async () => {
        vi.mocked(SystemAPI.getBackups).mockResolvedValue([]);
        const mockLicense = {
            key: 'LICENSE-KEY-123',
            status: 'active',
            users: 10,
            retention: 90,
            expiresAt: '2025-12-31'
        };
        vi.mocked(SystemAPI.getLicense).mockResolvedValue(mockLicense as any);

        render(<SystemPage />);
        
        // Switch to License tab
        fireEvent.click(screen.getByText('License'));

        await waitFor(() => {
            expect(screen.getByText('LICENSE-KEY-123')).toBeInTheDocument();
            expect(screen.getByText('ACTIVE')).toBeInTheDocument();
        });
    });
});
