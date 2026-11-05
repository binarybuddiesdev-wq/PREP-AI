import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { IStudyChatConversationSummary } from '@/core';
import { StudyChatDeleteDialog } from './StudyChatDeleteDialog';

const conversation: IStudyChatConversationSummary = {
  id: 'conversation-one',
  title: 'React closures',
  turnCount: 2,
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:02.000Z',
};

describe('StudyChatDeleteDialog', () => {
  it('keeps the title readable on both dark and light surfaces', async () => {
    const { rerender } = render(
      <StudyChatDeleteDialog
        conversation={conversation}
        isPending={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        theme="dark"
      />
    );

    expect(await screen.findByRole('heading', { name: 'Delete conversation?' })).toHaveClass(
      'text-zinc-100'
    );

    rerender(
      <StudyChatDeleteDialog
        conversation={conversation}
        isPending={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        theme="light"
      />
    );

    expect(screen.getByRole('heading', { name: 'Delete conversation?' })).toHaveClass(
      'text-zinc-900'
    );
  });

  it('requires explicit confirmation and allows cancellation', async () => {
    const user = userEvent.setup();
    const props = {
      conversation,
      isPending: false,
      onClose: vi.fn(),
      onConfirm: vi.fn(),
    };
    render(<StudyChatDeleteDialog {...props} />);

    expect(await screen.findByRole('dialog', { name: 'Delete conversation?' })).toHaveTextContent(
      'React closures'
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Delete conversation' }));
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it('does not render without a selected conversation and blocks duplicate delete requests', () => {
    const { rerender } = render(
      <StudyChatDeleteDialog
        conversation={null}
        isPending={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <StudyChatDeleteDialog
        conversation={conversation}
        isPending
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Deleting conversation' })).toBeDisabled();
  });

  it('keeps a failed delete open and offers a retry', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <StudyChatDeleteDialog
        conversation={conversation}
        errorMessage="The conversation could not be deleted."
        isPending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be deleted');
    await user.click(screen.getByRole('button', { name: 'Retry delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
