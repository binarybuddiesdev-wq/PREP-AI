import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HTTPError } from 'ky';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IStudyChatConversation } from '@/core';
import { StudyChatWidget } from './StudyChatWidget';

const state = vi.hoisted(() => ({
  createConversation: vi.fn(),
  sendMessage: vi.fn(),
  deleteConversation: vi.fn(),
  createKey: vi.fn(),
  conversationDetail: null as IStudyChatConversation | null,
  conversations: [] as Array<{
    id: string;
    title: string;
    turnCount: number;
    createdAt: string;
    updatedAt: string;
  }>,
  listStatus: {
    isPending: false,
    isError: false,
    error: null as Error | null,
    hasNextPage: false,
    isFetchingNextPage: false,
  },
  detailStatus: { isPending: false, isError: false, error: null as Error | null, refetch: vi.fn() },
}));

vi.mock('@/logic/studyChat/studyChatIdempotency', () => ({
  createStudyChatIdempotencyKey: state.createKey,
}));

vi.mock('@/logic/studyChat/studyChatError', () => ({
  getStudyChatErrorMessage: (
    error: unknown,
    context?: { operation?: 'create' | 'send' | 'delete' }
  ) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 429) {
      return "You've reached today's AI usage limit. Your draft is kept; try again later.";
    }
    if (status === 503) {
      return 'The assistant is temporarily unavailable. Your draft is kept; please retry.';
    }
    if (status === 409) {
      if (context?.operation === 'create') {
        return 'A conversation request is already being processed. Wait a moment, then retry your message.';
      }
      return 'This conversation changed while you were sending. Refresh it and retry your message.';
    }
    return error instanceof Error ? error.message : 'Something went wrong.';
  },
}));

vi.mock('@/logic/studyChat/useStudyChatReaders', () => ({
  useStudyChatConversationsReader: () => ({
    data: { pages: [{ items: state.conversations, nextCursor: null }] },
    ...state.listStatus,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useStudyChatConversationReader: (conversationId: string) => {
    return {
      data: conversationId ? state.conversationDetail : undefined,
      ...state.detailStatus,
    };
  },
}));

vi.mock('@/logic/studyChat/useStudyChatCommands', () => ({
  useStudyChatCommands: () => ({
    createConversation: { mutateAsync: state.createConversation, isPending: false },
    sendMessage: { mutateAsync: state.sendMessage, isPending: false },
    deleteConversation: { mutateAsync: state.deleteConversation, isPending: false },
  }),
}));

const conversation: IStudyChatConversation = {
  id: 'conversation-one',
  title: 'React closures',
  turnCount: 1,
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:01.000Z',
  messages: [
    { role: 'user', content: 'Explain closures.', createdAt: '2026-11-05T10:00:00.000Z' },
    {
      role: 'assistant',
      content: 'A closure retains lexical scope.',
      createdAt: '2026-11-05T10:00:01.000Z',
    },
  ],
};
const secondConversation = {
  ...conversation,
  id: 'conversation-two',
  title: 'TypeScript generics',
};

const openChat = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Open PrepAI Assistant' }));
};

describe('StudyChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.createConversation.mockReset();
    state.sendMessage.mockReset();
    state.deleteConversation.mockReset();
    state.createKey.mockReset();
    state.createKey.mockImplementation(() => 'study-chat-key-1');
    state.conversationDetail = conversation;
    state.conversations = [
      {
        id: conversation.id,
        title: conversation.title,
        turnCount: conversation.turnCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      {
        id: secondConversation.id,
        title: secondConversation.title,
        turnCount: secondConversation.turnCount,
        createdAt: secondConversation.createdAt,
        updatedAt: secondConversation.updatedAt,
      },
    ];
    state.listStatus = {
      isPending: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
    };
    state.detailStatus = { isPending: false, isError: false, error: null, refetch: vi.fn() };
  });

  it('opens the panel, switches views, selects a saved conversation, and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);

    expect(screen.getByRole('dialog', { name: 'PrepAI Assistant' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    expect(screen.getByText('Your conversations')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /React closures\s*1 turn/ }));
    expect(screen.getByText('A closure retains lexical scope.')).toBeVisible();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open PrepAI Assistant' })).toHaveFocus();
  });

  it('creates a conversation from the first message and displays only the returned transcript', async () => {
    const user = userEvent.setup();
    state.createConversation.mockResolvedValue(conversation);
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);

    await user.type(
      screen.getByRole('textbox', { name: 'Message PrepAI Assistant' }),
      '  Explain closures.  '
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(screen.getByText('A closure retains lexical scope.')).toBeVisible());
    expect(state.createConversation).toHaveBeenCalledWith({
      body: { message: 'Explain closures.' },
      idempotencyKey: 'study-chat-key-1',
    });
    expect(state.sendMessage).not.toHaveBeenCalled();
  });

  it('does not let a pending create replace a new conversation or erase its draft', async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: IStudyChatConversation) => void) | undefined;
    state.createConversation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);
    await user.type(
      screen.getByRole('textbox', { name: 'Message PrepAI Assistant' }),
      'First topic.'
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await user.click(screen.getByRole('button', { name: 'New conversation' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Message PrepAI Assistant' }),
      'New draft.'
    );

    resolveCreate?.(conversation);

    await waitFor(() => expect(state.createConversation).toHaveBeenCalledOnce());
    expect(screen.getByRole('textbox', { name: 'Message PrepAI Assistant' })).toHaveValue(
      'New draft.'
    );
    expect(screen.getByText(/Hi! I'm PrepAI's assistant/)).toBeVisible();
    expect(screen.queryByText('A closure retains lexical scope.')).not.toBeInTheDocument();
  });

  it('keeps the failed request snapshot and reuses its idempotency key on explicit retry', async () => {
    const user = userEvent.setup();
    state.createConversation
      .mockRejectedValueOnce(
        new HTTPError(
          new Response(null, { status: 503 }),
          new Request('http://api.test'),
          {} as never
        )
      )
      .mockResolvedValueOnce(conversation);
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);
    await user.type(
      screen.getByRole('textbox', { name: 'Message PrepAI Assistant' }),
      'Explain closures.'
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    expect(screen.getByRole('textbox', { name: 'Message PrepAI Assistant' })).toHaveValue(
      'Explain closures.'
    );
    await user.click(screen.getByRole('button', { name: 'Retry message' }));

    await waitFor(() => expect(screen.getByText('A closure retains lexical scope.')).toBeVisible());
    expect(state.createKey).toHaveBeenCalledOnce();
    expect(state.createConversation).toHaveBeenNthCalledWith(1, {
      body: { message: 'Explain closures.' },
      idempotencyKey: 'study-chat-key-1',
    });
    expect(state.createConversation).toHaveBeenNthCalledWith(2, {
      body: { message: 'Explain closures.' },
      idempotencyKey: 'study-chat-key-1',
    });
  });

  it('shows create-specific guidance for a conflict before a conversation exists', async () => {
    const user = userEvent.setup();
    state.createConversation.mockRejectedValue(
      new HTTPError(
        new Response(null, { status: 409 }),
        new Request('http://api.test'),
        {} as never
      )
    );
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);
    await user.type(
      screen.getByRole('textbox', { name: 'Message PrepAI Assistant' }),
      'Help me study.'
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A conversation request is already being processed.'
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('Refresh it');
  });

  it('continues a selected conversation with a new key and refreshed returned transcript', async () => {
    const user = userEvent.setup();
    state.createKey.mockReturnValue('new-send-key');
    state.sendMessage.mockResolvedValue({ ...conversation, turnCount: 2 });
    render(<StudyChatWidget theme="light" />);
    await openChat(user);
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: /React closures\s*1 turn/ }));
    await user.type(
      screen.getByRole('textbox', { name: 'Message PrepAI Assistant' }),
      'Give me an example.'
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(state.sendMessage).toHaveBeenCalledOnce());
    expect(state.sendMessage).toHaveBeenCalledWith({
      conversationId: conversation.id,
      body: { message: 'Give me an example.' },
      idempotencyKey: 'new-send-key',
    });
    expect(state.createConversation).not.toHaveBeenCalled();
  });

  it('retries a failed follow-up with the same text, conversation, and idempotency key', async () => {
    const user = userEvent.setup();
    state.createKey.mockReturnValue('follow-up-key');
    state.sendMessage
      .mockRejectedValueOnce(
        new HTTPError(
          new Response(null, { status: 409 }),
          new Request('http://api.test'),
          {} as never
        )
      )
      .mockResolvedValueOnce({ ...conversation, turnCount: 2 });
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: /React closures\s*1 turn/ }));
    await user.type(
      screen.getByRole('textbox', { name: 'Message PrepAI Assistant' }),
      'One more example.'
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('conversation changed');
    await user.click(screen.getByRole('button', { name: 'Retry message' }));

    await waitFor(() => expect(state.sendMessage).toHaveBeenCalledTimes(2));
    expect(state.createKey).toHaveBeenCalledOnce();
    const variables = {
      conversationId: conversation.id,
      body: { message: 'One more example.' },
      idempotencyKey: 'follow-up-key',
    };
    expect(state.sendMessage).toHaveBeenNthCalledWith(1, variables);
    expect(state.sendMessage).toHaveBeenNthCalledWith(2, variables);
  });

  it('keeps the transcript readable and disables sending after the 30-turn limit', async () => {
    const user = userEvent.setup();
    state.conversationDetail = { ...conversation, turnCount: 30 };
    state.conversations = state.conversations.map((item) =>
      item.id === conversation.id ? { ...item, turnCount: 30 } : item
    );
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: /React closures\s*30 turns/ }));

    expect(screen.getByText('A closure retains lexical scope.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Message PrepAI Assistant' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    expect(screen.getByText(/Ask me anything about coding/)).toBeVisible();
  });

  it('confirms deleting the selected conversation and clears that selection only after success', async () => {
    const user = userEvent.setup();
    state.deleteConversation.mockResolvedValue(undefined);
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: /React closures\s*1 turn/ }));
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: 'Delete React closures' }));
    await user.click(await screen.findByRole('button', { name: 'Delete conversation' }));

    await waitFor(() => expect(state.deleteConversation).toHaveBeenCalledWith('conversation-one'));
    expect(screen.getByRole('dialog', { name: 'PrepAI Assistant' })).toBeVisible();
    expect(screen.queryByText('A closure retains lexical scope.')).not.toBeInTheDocument();
    expect(screen.getByText('Your conversations')).toBeVisible();
  });

  it('keeps the active conversation selected when a different conversation is deleted', async () => {
    const user = userEvent.setup();
    state.deleteConversation.mockResolvedValue(undefined);
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: /React closures\s*1 turn/ }));
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: 'Delete TypeScript generics' }));
    await user.click(await screen.findByRole('button', { name: 'Delete conversation' }));

    await waitFor(() => expect(state.deleteConversation).toHaveBeenCalledWith('conversation-two'));
    await user.click(screen.getByRole('button', { name: 'Back to chat' }));
    expect(screen.getByText('A closure retains lexical scope.')).toBeVisible();
  });

  it('ignores a pending send failure after its selected conversation is deleted', async () => {
    const user = userEvent.setup();
    let rejectSend: ((error: Error) => void) | undefined;
    state.sendMessage.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSend = reject;
        })
    );
    state.deleteConversation.mockResolvedValue(undefined);
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: /React closures\s*1 turn/ }));
    await user.type(
      screen.getByRole('textbox', { name: 'Message PrepAI Assistant' }),
      'One more example.'
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: 'Delete React closures' }));
    await user.click(await screen.findByRole('button', { name: 'Delete conversation' }));
    await waitFor(() => expect(state.deleteConversation).toHaveBeenCalledWith(conversation.id));

    rejectSend?.(new Error('The conversation no longer exists.'));
    await user.click(screen.getByRole('button', { name: 'Back to chat' }));

    expect(screen.getByText(/Hi! I'm PrepAI's assistant/)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the selected conversation after delete fails and retries the same deletion', async () => {
    const user = userEvent.setup();
    state.deleteConversation
      .mockRejectedValueOnce(new Error('The conversation could not be deleted.'))
      .mockResolvedValueOnce(undefined);
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: /React closures\s*1 turn/ }));
    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: 'Delete React closures' }));

    await user.click(await screen.findByRole('button', { name: 'Delete conversation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The conversation could not be deleted.'
    );
    expect(screen.getByRole('button', { name: 'Retry delete' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Back to chat' }));
    expect(screen.getByText('A closure retains lexical scope.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Conversations' }));
    await user.click(screen.getByRole('button', { name: 'Delete React closures' }));
    await user.click(await screen.findByRole('button', { name: 'Delete conversation' }));

    await waitFor(() => expect(state.deleteConversation).toHaveBeenCalledTimes(2));
    expect(state.deleteConversation).toHaveBeenNthCalledWith(1, conversation.id);
    expect(state.deleteConversation).toHaveBeenNthCalledWith(2, conversation.id);
    expect(screen.queryByRole('dialog', { name: 'Delete conversation?' })).not.toBeInTheDocument();
  });

  it('retains the draft and reports a daily quota limit without inventing a reset time', async () => {
    const user = userEvent.setup();
    state.createConversation.mockRejectedValue(
      new HTTPError(
        new Response(null, { status: 429 }),
        new Request('http://api.test'),
        {} as never
      )
    );
    render(<StudyChatWidget theme="dark" />);
    await openChat(user);
    await user.type(
      screen.getByRole('textbox', { name: 'Message PrepAI Assistant' }),
      'Help me study.'
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You've reached today's AI usage limit"
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      /midnight|tomorrow|\d+\s*(hour|minute)/i
    );
    expect(screen.getByRole('textbox', { name: 'Message PrepAI Assistant' })).toHaveValue(
      'Help me study.'
    );
  });
});
