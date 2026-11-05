import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { INotificationListPage } from '@/core';
import { getNotificationUnreadCount, getNotifications } from '@/service/api';
import { notificationKeys } from './notification.keys';
import { useNotificationUnreadCountReader, useNotificationsReader } from './useNotificationReaders';

const session = vi.hoisted(() => ({
  isLoaded: false,
  isSignedIn: true,
  user: { id: 'user-one' as string | undefined },
}));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  getNotifications: vi.fn(),
  getNotificationUnreadCount: vi.fn(),
}));

const item = {
  id: 'notice-one',
  category: 'reminder',
  title: 'Practice today',
  body: 'Do a short session today.',
  link: '/dashboard',
  readAt: null,
  createdAt: '2026-11-05T06:00:00.000Z',
};
const firstPage: INotificationListPage = {
  items: [item],
  nextCursor: 'cursor-one',
  unreadCount: 1,
};
const secondPage: INotificationListPage = { items: [], nextCursor: null, unreadCount: 1 };
const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('notification readers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = false;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it('waits for Clerk and requests each inbox page with the server cursor', async () => {
    vi.mocked(getNotifications)
      .mockResolvedValueOnce(envelope(firstPage))
      .mockResolvedValueOnce(envelope(secondPage));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(() => useNotificationsReader(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getNotifications).not.toHaveBeenCalled();
    session.isLoaded = true;
    await act(async () => rerender());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getNotifications).toHaveBeenNthCalledWith(1, {}, { limit: 20 });
    expect(result.current.data?.pages).toEqual([firstPage]);

    await act(async () => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.data?.pages).toEqual([firstPage, secondPage]));
    expect(getNotifications).toHaveBeenNthCalledWith(2, {}, { cursor: 'cursor-one', limit: 20 });
  });

  it('does not fetch inbox pages while the popover is closed or user is signed out', () => {
    session.isLoaded = true;
    const { result, rerender } = renderHook(({ open }) => useNotificationsReader(open), {
      initialProps: { open: false },
      wrapper: createWrapper(new QueryClient()),
    });
    expect(result.current.fetchStatus).toBe('idle');

    session.isSignedIn = false;
    session.user = { id: undefined };
    rerender({ open: true });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getNotifications).not.toHaveBeenCalled();
  });

  it('loads the unread count only for a ready signed-in user and exposes retry after errors', async () => {
    const error = new Error('Unread count unavailable');
    vi.mocked(getNotificationUnreadCount).mockRejectedValue(error);
    session.isLoaded = true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useNotificationUnreadCountReader(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getNotificationUnreadCount).toHaveBeenCalledWith({});
    expect(result.current.error).toBe(error);
    expect(result.current.refetch).toBeTypeOf('function');
    expect(
      queryClient.getQueryCache().find({ queryKey: notificationKeys.unreadCount('user-one') })
    ).toBeDefined();
  });
});
