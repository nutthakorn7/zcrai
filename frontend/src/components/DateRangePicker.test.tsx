import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DateRangePicker } from './DateRangePicker';

describe('DateRangePicker', () => {
  const mockOnChange = vi.fn();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const defaultProps = {
    startDate: yesterday,
    endDate: today,
    onChange: mockOnChange,
  };

  it('renders initial date range', () => {
    render(<DateRangePicker {...defaultProps} />);
    
    // Check if button displays formatted date
    // Note: The component formats like "Jan 1, 2023 - Jan 2, 2023"
    // We check for partial text or specific format depending on implementation
    
    const startDateStr = yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // We expect the button to exist with some date text
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(startDateStr);
  });

  it('opens popover on click', () => {
    render(<DateRangePicker {...defaultProps} />);
    
    const triggerBtn = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('-'); 
    });
    
    fireEvent.click(triggerBtn);
    
    // Check for "Quick Select" or Calendar elements
    expect(screen.getByText('Quick Select')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('calls onChange when a preset is selected', () => {
    render(<DateRangePicker {...defaultProps} />);
    
    const triggerBtn = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('-'); 
    });
    fireEvent.click(triggerBtn);
    
    const todayBtn = screen.getByText('Today');
    fireEvent.click(todayBtn);
    
    expect(mockOnChange).toHaveBeenCalled();
  });
});
