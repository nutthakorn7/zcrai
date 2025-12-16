import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  const defaultProps = {
    savedFilter: '',
    onSavedFilterChange: vi.fn(),
    severityFilter: [],
    onSeverityFilterChange: vi.fn(),
    statusFilter: [],
    onStatusFilterChange: vi.fn(),
    assigneeFilter: '',
    onAssigneeFilterChange: vi.fn(),
    assignees: ['User A', 'User B'],
    searchQuery: '',
    onSearchQueryChange: vi.fn(),
    onSubmit: vi.fn(),
    onClearFilters: vi.fn()
  };

  it('renders all filter options', () => {
    render(<FilterBar {...defaultProps} />);
    
    // Check for labels (Heroui Select might put label in a label element or similar)
    // Using getAllByText because HeroUI might render duplicates (hidden/visible)
    expect(screen.getAllByText('Saved Filters')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Severity')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Status')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Owner')[0]).toBeInTheDocument();
    
    // Search input usually has a clear label or placeholder
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('calls onSearchQueryChange when typing', () => {
    render(<FilterBar {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    expect(defaultProps.onSearchQueryChange).toHaveBeenCalledWith('test query');
  });

  it('calls onSubmit when Submit button is clicked', () => {
    render(<FilterBar {...defaultProps} />);
    
    const submitBtn = screen.getByText('Submit');
    fireEvent.click(submitBtn);
    
    expect(defaultProps.onSubmit).toHaveBeenCalled();
  });

  it('calls onClearFilters when clear button is clicked', () => {
    render(<FilterBar {...defaultProps} />);
    
    const clearBtn = screen.getByLabelText('Clear filters');
    fireEvent.click(clearBtn);
    
    expect(defaultProps.onClearFilters).toHaveBeenCalled();
  });
  
  // Note: Testing Select interactions in Heroui/HeadlessUI often implies checking role='combobox' 
  // or clicking triggers. For simplicity, we verify rendering and basic inputs first.
});
