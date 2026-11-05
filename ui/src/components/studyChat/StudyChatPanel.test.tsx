import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StudyChatPanel } from './StudyChatPanel';
import type { IStudyChatPanelProps } from './StudyChatPanel.types';

const createProps = (overrides: Partial<IStudyChatPanelProps> = {}): IStudyChatPanelProps => ({
  isOpen: true,
  isFullscreen: false,
  view: 'transcript',
  theme: 'dark',
  children: <p>Transcript content</p>,
  onClose: vi.fn(),
  onToggleFullscreen: vi.fn(),
  onToggleView: vi.fn(),
  onNewConversation: vi.fn(),
  ...overrides,
});

describe('StudyChatPanel', () => {
  it('does not render while closed', () => {
    render(<StudyChatPanel {...createProps({ isOpen: false })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the conversation controls and emits their actions', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<StudyChatPanel {...props} />);

    expect(screen.getByRole('dialog', { name: 'PrepAI Assistant' })).toHaveTextContent(
      'Transcript content'
    );
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: 'New conversation' }));
    await user.click(screen.getByRole('button', { name: 'Expand chat' }));
    await user.click(screen.getByRole('button', { name: 'Close chat' }));

    expect(props.onToggleView).toHaveBeenCalledOnce();
    expect(props.onNewConversation).toHaveBeenCalledOnce();
    expect(props.onToggleFullscreen).toHaveBeenCalledOnce();
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('offers a return-to-chat control from the conversation list view', () => {
    render(<StudyChatPanel {...createProps({ view: 'list' })} />);
    expect(screen.getByRole('button', { name: 'Back to chat' })).toBeInTheDocument();
  });
});
