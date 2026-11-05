import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { IStudyChatConversationSummary } from '@/core';
import { StudyChatConversationList } from './StudyChatConversationList';

const conversations: IStudyChatConversationSummary[] = [
  {
    id: 'conversation-one',
    title: 'React closures',
    turnCount: 2,
    createdAt: '2026-11-05T10:00:00.000Z',
    updatedAt: '2026-11-05T10:00:02.000Z',
  },
];

describe('StudyChatConversationList', () => {
  it('shows the saved conversation and handles select, delete, and pagination actions', async () => {
    const user = userEvent.setup();
    const props = {
      conversations,
      selectedConversationId: 'conversation-one',
      hasMore: true,
      isLoadingMore: false,
      onSelect: vi.fn(),
      onDelete: vi.fn(),
      onLoadMore: vi.fn(),
      onNewConversation: vi.fn(),
    };
    render(<StudyChatConversationList {...props} />);

    expect(screen.getByRole('button', { name: /React closures\s*2 turns/ })).toHaveAttribute(
      'aria-current',
      'true'
    );
    await user.click(screen.getByRole('button', { name: /React closures\s*2 turns/ }));
    await user.click(screen.getByRole('button', { name: 'Delete React closures' }));
    await user.click(screen.getByRole('button', { name: 'Load more conversations' }));

    expect(props.onSelect).toHaveBeenCalledWith('conversation-one');
    expect(props.onDelete).toHaveBeenCalledWith(conversations[0]);
    expect(props.onLoadMore).toHaveBeenCalledOnce();
  });

  it('shows loading, error retry, and empty states', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <StudyChatConversationList
        conversations={[]}
        hasMore={false}
        isLoading
        isLoadingMore={false}
        onDelete={vi.fn()}
        onLoadMore={vi.fn()}
        onNewConversation={vi.fn()}
        onRetry={onRetry}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading conversations');

    rerender(
      <StudyChatConversationList
        conversations={[]}
        errorMessage="Your conversations could not be loaded."
        hasMore={false}
        isLoading={false}
        isLoadingMore={false}
        onDelete={vi.fn()}
        onLoadMore={vi.fn()}
        onNewConversation={vi.fn()}
        onRetry={onRetry}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Your conversations could not be loaded.');
    await user.click(screen.getByRole('button', { name: 'Retry conversations' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <StudyChatConversationList
        conversations={[]}
        hasMore={false}
        isLoading={false}
        isLoadingMore={false}
        onDelete={vi.fn()}
        onLoadMore={vi.fn()}
        onNewConversation={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });
});
