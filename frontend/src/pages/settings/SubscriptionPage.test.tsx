import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SubscriptionPage from './SubscriptionPage';
import { BillingAPI } from '@/shared/api';

// Mock API
vi.mock('../../shared/api/billing', () => ({
  BillingAPI: {
    getSubscription: vi.fn(),
    subscribe: vi.fn(),
  }
}));

// Mock Confirm and Alert
const mockConfirm = vi.fn();
const mockAlert = vi.fn();
window.confirm = mockConfirm;
window.alert = mockAlert;

describe('SubscriptionPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConfirm.mockReturnValue(true); // Default Yes
    });

    const mockData = {
        subscription: {
            tier: 'free',
            status: 'active',
            currentPeriodEnd: '2025-12-31T23:59:59Z',
            limits: { maxUsers: 5, maxDataVolumeGB: 10, maxRetentionDays: 7 }
        },
        usage: {
            users: 2,
            dataVolumeGB: 5.5
        }
    };

    it('renders subscription info and usage stats', async () => {
        (BillingAPI.getSubscription as any).mockResolvedValue({ data: mockData });

        render(<SubscriptionPage />);

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.getByText('Subscription & Billing')).toBeInTheDocument();
        });

        // Check Plan Info
        expect(screen.getAllByText(/FREE/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);

        // Check Usage
        expect(screen.getByText(/2.*\/.*5/)).toBeInTheDocument(); // Users
        expect(screen.getByText(/5\.50.*GB.*\/.*10.*GB/)).toBeInTheDocument(); // Data
    });

    it('handles plan upgrade interaction', async () => {
        (BillingAPI.getSubscription as any).mockResolvedValue({ data: mockData });
        (BillingAPI.subscribe as any).mockResolvedValue({ success: true });

        render(<SubscriptionPage />);

        await waitFor(() => {
            expect(screen.getByText('Pro')).toBeInTheDocument();
        });

        // Click Upgrade Button
        const upgradeButtons = screen.getAllByText('Upgrade');
        fireEvent.click(upgradeButtons[0]); // Pro Plan

        // Expect ConfirmDialog to appear
        await waitFor(() => {
            expect(screen.getByText('Change Subscription Plan')).toBeInTheDocument();
            expect(screen.getByText(/Are you sure you want to switch to the PRO plan/i)).toBeInTheDocument();
        });

        // Click Confirm inside the dialog
        // Assuming ConfirmDialog renders a button with "Confirm Change"
        fireEvent.click(screen.getByText('Confirm Change'));

        await waitFor(() => {
            expect(BillingAPI.subscribe).toHaveBeenCalledWith('pro');
            expect(mockAlert).toHaveBeenCalledWith('Subscription updated successfully!');
        });
    });

    it('shows unlimited limits correctly', async () => {
        const unlimitedData = {
            subscription: {
                tier: 'enterprise',
                status: 'active',
                limits: { maxUsers: null, maxDataVolumeGB: null, maxRetentionDays: 365 }
            },
            usage: { users: 100, dataVolumeGB: 500 }
        };
        (BillingAPI.getSubscription as any).mockResolvedValue({ data: unlimitedData });

        render(<SubscriptionPage />);

        await waitFor(() => {
             const elements = screen.getAllByText(/ENTERPRISE/i);
             expect(elements.length).toBeGreaterThan(0);
        });

        // Check infinity rendering
        expect(screen.getByText(/100.*\/.*∞/)).toBeInTheDocument();
        expect(screen.getByText(/500\.00.*GB.*\/.*∞/)).toBeInTheDocument();
    });
});
