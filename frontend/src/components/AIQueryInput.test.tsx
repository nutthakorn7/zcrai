import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AIQueryInput } from './AIQueryInput';
import { AIAPI } from '../shared/api/ai';

// Mock AIAPI
vi.mock('../shared/api/ai', () => ({
    AIAPI: {
        generateQuery: vi.fn(),
    },
}));

describe('AIQueryInput', () => {
    it('renders input and button', () => {
        render(<AIQueryInput onFiltersApplied={vi.fn()} />);
        expect(screen.getByPlaceholderText(/Ask AI/i)).toBeInTheDocument();
        expect(screen.getByText(/Generate Filters/i)).toBeInTheDocument();
    });

    it('calls API and applies filters on success', async () => {
        const onFiltersApplied = vi.fn();
        const mockResponse = {
            data: {
                data: {
                    filters: { severity: 'critical' },
                    explanation: 'Found critical alerts'
                }
            }
        };
        (AIAPI.generateQuery as any).mockResolvedValue(mockResponse);

        render(<AIQueryInput onFiltersApplied={onFiltersApplied} />);

        const input = screen.getByPlaceholderText(/Ask AI/i);
        fireEvent.change(input, { target: { value: 'critical alerts' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(AIAPI.generateQuery).toHaveBeenCalledWith('critical alerts');
            expect(onFiltersApplied).toHaveBeenCalledWith({ severity: 'critical' });
        });
    });

    it('handles API error', async () => {
        (AIAPI.generateQuery as any).mockRejectedValue(new Error('API Error'));
        render(<AIQueryInput onFiltersApplied={vi.fn()} />);

        const input = screen.getByPlaceholderText(/Ask AI/i);
        fireEvent.change(input, { target: { value: 'error case' } });
        fireEvent.click(screen.getByText(/Generate Filters/i));

        await waitFor(() => {
            expect(screen.getByText(/Failed to generate query/i)).toBeInTheDocument();
        });
    });
});
