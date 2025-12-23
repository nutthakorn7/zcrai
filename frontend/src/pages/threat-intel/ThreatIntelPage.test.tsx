import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ThreatIntelPage from './index';
import { ThreatIntelAPI } from '../../shared/api/threat-intel';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock API
vi.mock('../../shared/api/threat-intel', () => ({
  ThreatIntelAPI: {
    retroScan: vi.fn(),
    lookup: vi.fn()
  }
}));

describe('ThreatIntelPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        render(
            <BrowserRouter>
                <ThreatIntelPage />
            </BrowserRouter>
        );
    };

    it('renders input form with reputation tab by default', () => {
        renderComponent();
        expect(screen.getByLabelText('Value')).toBeInTheDocument();
        // Default tab is reputation, so button says "Check Reputation"
        expect(screen.getByText('Check Reputation')).toBeInTheDocument();
    });

    it('can switch to retro-scan tab', async () => {
        renderComponent();
        
        // Click the retro tab
        const retroTab = screen.getByText('Internal Retro-Scan');
        fireEvent.click(retroTab);
        
        await waitFor(() => {
            expect(screen.getByText('Scan Internal Logs')).toBeInTheDocument();
        });
    });

    it('performs reputation lookup', async () => {
        const mockRepResult = {
            verdict: 'malicious',
            confidenceScore: 85,
            malwareFamilies: ['trojan'],
            sources: [{ name: 'VirusTotal', found: true, risk: 'malicious' }]
        };
        vi.mocked(ThreatIntelAPI.lookup).mockResolvedValue(mockRepResult);

        renderComponent();

        const input = screen.getByLabelText('Value');
        fireEvent.change(input, { target: { value: '1.2.3.4' } });
        
        // Use getByRole for HeroUI Button
        const btn = screen.getByRole('button', { name: /check reputation/i });
        
        // Simulate pressing Enter on button or use pointerdown/pointerup
        fireEvent.pointerDown(btn);
        fireEvent.pointerUp(btn);

        // Check API was called - this is the core test
        await waitFor(() => {
            expect(ThreatIntelAPI.lookup).toHaveBeenCalledWith('ip', '1.2.3.4');
        }, { timeout: 2000 });
    });

    it('performs retro scan and shows threat found', async () => {
        const mockResult = {
            found: true,
            count: 1,
            matches: [
                { timestamp: '2023-01-01T12:00:00Z', host_name: 'host1', host_ip: '10.0.0.1', source: 'network', event_type: 'network_connection' }
            ]
        };
        vi.mocked(ThreatIntelAPI.retroScan).mockResolvedValue(mockResult);

        renderComponent();

        // Switch to retro tab
        fireEvent.click(screen.getByText('Internal Retro-Scan'));

        const input = screen.getByLabelText('Value');
        fireEvent.change(input, { target: { value: '1.2.3.4' } });
        
        await waitFor(() => {
            expect(screen.getByText('Scan Internal Logs')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('Scan Internal Logs'));

        await waitFor(() => {
            expect(ThreatIntelAPI.retroScan).toHaveBeenCalledWith('ip', '1.2.3.4', 90);
            expect(screen.getByText('THREAT FOUND')).toBeInTheDocument();
        });
    });

    it('handles clean retro scan results', async () => {
        const mockResult = {
            found: false,
            count: 0,
            matches: []
        };
        vi.mocked(ThreatIntelAPI.retroScan).mockResolvedValue(mockResult);

        renderComponent();

        // Switch to retro tab
        fireEvent.click(screen.getByText('Internal Retro-Scan'));

        const input = screen.getByLabelText('Value');
        fireEvent.change(input, { target: { value: '8.8.8.8' } });
        
        await waitFor(() => {
            expect(screen.getByText('Scan Internal Logs')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('Scan Internal Logs'));

        await waitFor(() => {
           expect(screen.getByText('CLEAN')).toBeInTheDocument();
        });
    });
});
