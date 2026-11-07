import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { IStudyChatMessage } from '@/core';
import { StudyChatTranscript } from './StudyChatTranscript';

const messages: IStudyChatMessage[] = [
  { role: 'user', content: 'Explain closures.', createdAt: '2026-11-05T10:00:00.000Z' },
  {
    role: 'assistant',
    content: 'A closure keeps lexical scope.',
    createdAt: '2026-11-05T10:00:01.000Z',
  },
];

describe('StudyChatTranscript', () => {
  it('shows purposeful guidance when a conversation has no messages', () => {
    render(<StudyChatTranscript messages={[]} />);
    expect(screen.getByText(/Hi! I'm PrepAI's assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/Ask me anything about coding/i)).toBeInTheDocument();
  });

  it('shows saved messages and announces a pending assistant response', () => {
    render(<StudyChatTranscript messages={messages} isSending />);
    expect(screen.getByText('Explain closures.')).toBeInTheDocument();
    expect(screen.getByText('A closure keeps lexical scope.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('PrepAI is thinking');
  });

  it('shows a loading status while the selected transcript is loading', () => {
    render(<StudyChatTranscript isLoading messages={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading conversation');
  });

  it('shows a retryable transcript error', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <StudyChatTranscript
        errorMessage="This conversation could not be loaded."
        messages={[]}
        onRetry={onRetry}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('This conversation could not be loaded.');
    await user.click(screen.getByRole('button', { name: 'Retry loading conversation' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('keeps the transcript visible after a failed send and exposes retry and dismiss actions', async () => {
    const user = userEvent.setup();
    const onRetrySend = vi.fn();
    const onDismissSendError = vi.fn();
    render(
      <StudyChatTranscript
        messages={messages}
        sendErrorMessage="The assistant is temporarily unavailable."
        onRetrySend={onRetrySend}
        onDismissSendError={onDismissSendError}
      />
    );

    expect(screen.getByText('A closure keeps lexical scope.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry message' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss send error' }));
    expect(onRetrySend).toHaveBeenCalledOnce();
    expect(onDismissSendError).toHaveBeenCalledOnce();
  });

  it('keeps a full transcript readable and offers a new conversation at the turn limit', async () => {
    const user = userEvent.setup();
    const onNewConversation = vi.fn();
    render(
      <StudyChatTranscript
        isTurnLimitReached
        messages={messages}
        onNewConversation={onNewConversation}
      />
    );

    expect(screen.getByText('A closure keeps lexical scope.')).toBeInTheDocument();
    expect(screen.getByText('This conversation reached its 30-turn limit.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    expect(onNewConversation).toHaveBeenCalledOnce();
  });
});
