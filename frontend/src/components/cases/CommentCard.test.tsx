import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommentCard } from './CommentCard';

describe('CommentCard', () => {
  const mockComment = {
    id: '1',
    content: 'Testing @user mention',
    userEmail: 'test@zcr.ai',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  it('renders comment content with highlights', () => {
    render(
      <CommentCard 
        comment={mockComment}
        currentUserEmail="other@zcr.ai"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Check content
    expect(screen.getByText('testing', { exact: false })).toBeInTheDocument();
    // Check user info
    expect(screen.getByText('test@zcr.ai')).toBeInTheDocument();
  });

  it('shows edit/delete buttons for owner', () => {
    render(
      <CommentCard 
        comment={mockComment}
        currentUserEmail="test@zcr.ai"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );
     // Simulate hover if needed, or check if they exist in DOM (they are hidden with opacity-0 group-hover:opacity-100)
     // Start editing
     // Note: Heroui Buttons might be hard to select by role without proper labels, checking by icon or functionality.
     // In this specific component, buttons are only rendered if isOwner is true.
     const buttons = screen.getAllByRole('button');
     expect(buttons).toHaveLength(2); // Edit and Delete
  });

  it('does not show buttons for non-owner', () => {
    render(
      <CommentCard 
        comment={mockComment}
        currentUserEmail="other@zcr.ai"
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });
});
