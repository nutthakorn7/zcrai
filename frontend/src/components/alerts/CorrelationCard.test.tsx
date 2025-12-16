import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CorrelationCard } from './CorrelationCard';
import { AlertCorrelation } from '../../shared/api/alerts';

describe('CorrelationCard', () => {
    const mockCorrelation: AlertCorrelation = {
        id: '1',
        reason: 'time_window',
        confidence: '0.85',
        relatedAlertIds: ['alert1'],
        relatedAlerts: [
            {
                id: 'alert1',
                title: 'Suspicious Login',
                description: 'Failed login attempt',
                severity: 'high',
                source: 'sentinelone',
                event_type: 'login',
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            }
        ]
    };

    const mockOnViewAlert = vi.fn();

    it('renders correlation details correctly', () => {
        render(<CorrelationCard correlation={mockCorrelation} onViewAlert={mockOnViewAlert} />);

        expect(screen.getByText(/Occurred within 1 hour/i)).toBeInTheDocument();
        expect(screen.getByText('85% confidence')).toBeInTheDocument();
        expect(screen.getByText('Suspicious Login')).toBeInTheDocument();
        expect(screen.getByText('sentinelone')).toBeInTheDocument();
    });

    it('renders empty state when relatedAlerts is empty', () => {
        const emptyCorrelation = { 
            ...mockCorrelation, 
            relatedAlerts: [] 
        };
        
        render(<CorrelationCard correlation={emptyCorrelation} onViewAlert={mockOnViewAlert} />);

        expect(screen.getByText(/related alert\(s\), details unavailable/i)).toBeInTheDocument();
    });

    it('calls onViewAlert when alert is clicked', () => {
        render(<CorrelationCard correlation={mockCorrelation} onViewAlert={mockOnViewAlert} />);

        const alertCard = screen.getByText('Suspicious Login').closest('div');
        // Find click handling element (the card itself or button)
        // Since Heroui Card uses onPress, and we can't easily simulate that with basic fireEvent if it's complex,
        // we'll try to click the text which usually propagates.
        
        fireEvent.click(screen.getByText('Suspicious Login'));
        expect(mockOnViewAlert).toHaveBeenCalledWith('alert1');
    });
});
