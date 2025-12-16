import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ThreatIntelPage from './index';
import { ThreatIntelAPI } from '../../shared/api/threat-intel';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock API
vi.mock('../../shared/api/threat-intel', () => ({
  ThreatIntelAPI: {
    retroScan: vi.fn()
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

    it('renders input form', () => {
        renderComponent();
        expect(screen.getByLabelText('Value')).toBeInTheDocument();
        expect(screen.getByText('Scan History')).toBeInTheDocument();
    });

    it('submits scan and displays results', async () => {
        const mockResult = {
            found: true,
            count: 1,
            matches: [
                { timestamp: '2023-01-01T12:00:00Z', event_type: 'network_connection', summary: 'Connection to bad IP' }
            ]
        };
        vi.mocked(ThreatIntelAPI.retroScan).mockResolvedValue(mockResult);

        renderComponent();

        const input = screen.getByLabelText('Value');
        fireEvent.change(input, { target: { value: '1.2.3.4' } });
        
        const btn = screen.getByText('Scan History');
        fireEvent.click(btn);

        await waitFor(() => {
            expect(ThreatIntelAPI.retroScan).toHaveBeenCalledWith('ip', '1.2.3.4', 90);
            expect(screen.getByText('THREAT FOUND')).toBeInTheDocument();
        });
    });

    it('handles no results', async () => {
        const mockResult = {
            found: false,
            count: 0,
            matches: []
        };
        vi.mocked(ThreatIntelAPI.retroScan).mockResolvedValue(mockResult);

        renderComponent();

        const input = screen.getByLabelText('Value');
        fireEvent.change(input, { target: { value: '8.8.8.8' } });
        
        fireEvent.click(screen.getByText('Scan History'));

        await waitFor(() => {
           expect(screen.getByText('CLEAN')).toBeInTheDocument();
        });
    });
});
