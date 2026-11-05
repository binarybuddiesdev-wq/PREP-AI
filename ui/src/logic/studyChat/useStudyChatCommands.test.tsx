import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPError } from 'ky';

import type { IStudyChatConversation } from '@/core';
import {
  createStudyChatConversation,
  deleteStudyChatConversation,
  sendStudyChatMessage,
} from '@/service/api';
import { studyChatKeys } from './studyChat.keys';
import { useStudyChatCommands } from './useStudyChatCommands';

vi.mock('../auth', () => ({ useSessionReader: () => ({ user: { id: 'user-one' } }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  createStudyChatConversation: vi.fn(),
  deleteStudyChatConversation: vi.fn(),
  sendStudyChatMessage: vi.fn(),
}));

const conversation: IStudyChatConversation = {
  id: 'conversation-one',
  title: 'React effects',
  turnCount: 1,
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:01.000Z',
  messages: [
    { role: 'user', content: 'Explain React effects.', createdAt: '2026-11-05T10:00:00.000Z' },
    {
      role: 'assistant',
      content: 'They synchronize with external systems.',
      createdAt: '2026-11-05T10:00:01.000Z',
    },
  ],
};
const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('Study Chat commands', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards a create operation snapshot and key, caches the returned transcript, and refreshes the list', async () => {
    vi.mocked(createStudyChatConversation).mockResolvedValue(envelope(conversation));
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useStudyChatCommands(), {
      wrapper: createWrapper(queryClient),
    });
    const variables = {
      body: { message: 'Explain React effects.' },
      idempotencyKey: 'create-key-1',
    };

    await act(async () => result.current.createConversation.mutateAsync(variables));

    expect(createStudyChatConversation).toHaveBeenCalledWith({}, variables.body, 'create-key-1');
    expect(
      queryClient.getQueryData(studyChatKeys.conversation('user-one', conversation.id))
    ).toEqual(conversation);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: studyChatKeys.conversations('user-one'),
    });
  });

  it('forwards a send operation snapshot and key, then updates transcript and invalidates the list', async () => {
    const updated = { ...conversation, turnCount: 2 };
    vi.mocked(sendStudyChatMessage).mockResolvedValue(envelope(updated));
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useStudyChatCommands(), {
      wrapper: createWrapper(queryClient),
    });
    const variables = {
      conversationId: conversation.id,
      body: { message: 'Give me another example.' },
      idempotencyKey: 'send-key-1',
    };

    await act(async () => result.current.sendMessage.mutateAsync(variables));

    expect(sendStudyChatMessage).toHaveBeenCalledWith(
      {},
      conversation.id,
      variables.body,
      'send-key-1'
    );
    expect(
      queryClient.getQueryData(studyChatKeys.conversation('user-one', conversation.id))
    ).toEqual(updated);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: studyChatKeys.conversations('user-one'),
    });
  });

  it('refreshes the transcript after a revision conflict so the same variables remain retryable', async () => {
    vi.mocked(sendStudyChatMessage).mockRejectedValue(
      new HTTPError(
        new Response(null, { status: 409 }),
        new Request('http://api.test'),
        {} as never
      )
    );
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useStudyChatCommands(), {
      wrapper: createWrapper(queryClient),
    });
    const variables = {
      conversationId: conversation.id,
      body: { message: 'Try this again.' },
      idempotencyKey: 'retry-with-same-key',
    };

    await act(async () => {
      await expect(result.current.sendMessage.mutateAsync(variables)).rejects.toBeInstanceOf(
        HTTPError
      );
    });

    expect(sendStudyChatMessage).toHaveBeenCalledWith(
      {},
      conversation.id,
      variables.body,
      'retry-with-same-key'
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: studyChatKeys.conversation('user-one', conversation.id),
    });
  });

  it('removes deleted transcript data and refreshes the conversation list', async () => {
    vi.mocked(deleteStudyChatConversation).mockResolvedValue(envelope(null));
    const queryClient = new QueryClient();
    const detailKey = studyChatKeys.conversation('user-one', conversation.id);
    queryClient.setQueryData(detailKey, conversation);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useStudyChatCommands(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => result.current.deleteConversation.mutateAsync(conversation.id));

    expect(deleteStudyChatConversation).toHaveBeenCalledWith({}, conversation.id);
    expect(queryClient.getQueryData(detailKey)).toBeUndefined();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: studyChatKeys.conversations('user-one'),
    });
  });
});
