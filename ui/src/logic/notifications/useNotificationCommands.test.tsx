import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteNotification, markAllNotificationsRead, markNotificationRead } from '@/service/api';
import { notificationKeys } from './notification.keys';
import { useNotificationCommands } from './useNotificationCommands';

vi.mock('../auth', () => ({ useSessionReader: () => ({ user: { id: 'user-one' } }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
}));

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('notification commands', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['mark one read', markNotificationRead, 'markRead'],
    ['mark all read', markAllNotificationsRead, 'markAllRead'],
    ['delete one', deleteNotification, 'deleteNotification'],
  ] as const)(
    '%s invalidates this user inbox and unread count on success',
    async (_label, _api, command) => {
      if (command === 'markRead')
        vi.mocked(markNotificationRead).mockResolvedValue(
          envelope({
            id: 'notice-one',
            category: 'reminder',
            title: 'Practice today',
            body: 'Do a short session today.',
            link: '/dashboard',
            readAt: '2026-11-05T06:30:00.000Z',
            createdAt: '2026-11-05T06:00:00.000Z',
          })
        );
      if (command === 'markAllRead')
        vi.mocked(markAllNotificationsRead).mockResolvedValue(envelope({ updatedCount: 1 }));
      if (command === 'deleteNotification')
        vi.mocked(deleteNotification).mockResolvedValue(envelope(null));
      const queryClient = new QueryClient();
      const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useNotificationCommands(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        if (command === 'markRead') await result.current.markRead.mutateAsync('notice-one');
        if (command === 'markAllRead') await result.current.markAllRead.mutateAsync();
        if (command === 'deleteNotification')
          await result.current.deleteNotification.mutateAsync('notice-one');
      });

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: notificationKeys.inbox('user-one'),
      });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: notificationKeys.unreadCount('user-one'),
      });
    }
  );

  it('forwards a notification ID and does not invalidate queries when the command fails', async () => {
    const error = new Error('Notification update failed');
    vi.mocked(markNotificationRead).mockRejectedValue(error);
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useNotificationCommands(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.markRead.mutateAsync('notice-one')).rejects.toBe(error);
    });

    expect(markNotificationRead).toHaveBeenCalledWith({}, 'notice-one');
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
