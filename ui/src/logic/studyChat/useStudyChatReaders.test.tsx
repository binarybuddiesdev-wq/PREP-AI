import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IStudyChatConversation, IStudyChatConversationListPage } from '@/core';
import { getStudyChatConversation, getStudyChatConversations } from '@/service/api';
import { studyChatKeys } from './studyChat.keys';
import {
  useStudyChatConversationReader,
  useStudyChatConversationsReader,
} from './useStudyChatReaders';

const session = vi.hoisted(() => ({
  isLoaded: false,
  isSignedIn: true,
  user: { id: 'user-one' as string | undefined },
}));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  getStudyChatConversation: vi.fn(),
  getStudyChatConversations: vi.fn(),
}));

const summary = {
  id: 'conversation-one',
  title: 'React effects',
  turnCount: 1,
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:01.000Z',
};
const conversation: IStudyChatConversation = {
  ...summary,
  messages: [
    { role: 'user', content: 'Explain React effects.', createdAt: summary.createdAt },
    {
      role: 'assistant',
      content: 'They synchronize with external systems.',
      createdAt: summary.updatedAt,
    },
  ],
};
const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('Study Chat readers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = false;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it('waits for Clerk and fetches cursor pages into the signed-in user cache', async () => {
    const firstPage: IStudyChatConversationListPage = {
      items: [summary],
      nextCursor: 'cursor-one',
    };
    const secondPage: IStudyChatConversationListPage = { items: [], nextCursor: null };
    vi.mocked(getStudyChatConversations)
      .mockResolvedValueOnce(envelope(firstPage))
      .mockResolvedValueOnce(envelope(secondPage));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(() => useStudyChatConversationsReader(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getStudyChatConversations).not.toHaveBeenCalled();

    session.isLoaded = true;
    await act(async () => rerender());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getStudyChatConversations).toHaveBeenNthCalledWith(
      1,
      {},
      {
        cursor: undefined,
        limit: 20,
      }
    );
    expect(result.current.data?.pages).toEqual([firstPage]);
    expect(
      queryClient.getQueryCache().find({ queryKey: studyChatKeys.conversations('user-one') })
    ).toBeDefined();

    await act(async () => result.current.fetchNextPage());
    expect(getStudyChatConversations).toHaveBeenNthCalledWith(
      2,
      {},
      {
        cursor: 'cursor-one',
        limit: 20,
      }
    );
    await waitFor(() => expect(result.current.data?.pages).toEqual([firstPage, secondPage]));
  });

  it('keeps the conversation list idle when the view is closed', () => {
    session.isLoaded = true;
    const { result } = renderHook(() => useStudyChatConversationsReader(false), {
      wrapper: createWrapper(new QueryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getStudyChatConversations).not.toHaveBeenCalled();
  });

  it('loads an authenticated conversation transcript into the user-scoped cache', async () => {
    vi.mocked(getStudyChatConversation).mockResolvedValue(envelope(conversation));
    session.isLoaded = true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(
      ({ conversationId }) => useStudyChatConversationReader(conversationId),
      { initialProps: { conversationId: '' }, wrapper: createWrapper(queryClient) }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(getStudyChatConversation).not.toHaveBeenCalled();
    await act(async () => rerender({ conversationId: conversation.id }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getStudyChatConversation).toHaveBeenCalledWith({}, conversation.id);
    expect(result.current.data).toEqual(conversation);
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: studyChatKeys.conversation('user-one', conversation.id) })
    ).toBeDefined();
  });

  it('does not request a transcript without a loaded authenticated user and conversation ID', () => {
    session.isLoaded = true;
    session.isSignedIn = false;
    session.user = { id: undefined };
    const { result } = renderHook(() => useStudyChatConversationReader('conversation-one'), {
      wrapper: createWrapper(new QueryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getStudyChatConversation).not.toHaveBeenCalled();
  });

  it('does not fetch a selected transcript while the chat is closed', () => {
    session.isLoaded = true;
    const { result } = renderHook(() => useStudyChatConversationReader('conversation-one', false), {
      wrapper: createWrapper(new QueryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getStudyChatConversation).not.toHaveBeenCalled();
  });

  it('exposes conversation list failures to the view retry action', async () => {
    const error = new Error('Conversation list unavailable.');
    vi.mocked(getStudyChatConversations).mockRejectedValue(error);
    session.isLoaded = true;
    const { result } = renderHook(() => useStudyChatConversationsReader(), {
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(result.current.refetch).toBeTypeOf('function');
  });
});
