import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { INotification, INotificationListPage } from '@/core';
import { NotificationCenter } from './NotificationCenter';

const session = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  user: { id: 'user-one' as string | undefined },
}));

vi.mock('@/logic/api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/logic/auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  getNotifications: vi.fn(),
  getNotificationUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
}));

const first: INotification = {
  id: 'notice-one',
  category: 'reminder',
  title: 'Practice today',
  body: 'Short session',
  link: '/dashboard',
  readAt: null,
  createdAt: '2026-11-05T06:00:00.000Z',
};
const second: INotification = {
  ...first,
  id: 'notice-two',
  title: 'Review your progress',
};
const firstPage: INotificationListPage = {
  items: [first],
  nextCursor: 'cursor-one',
  unreadCount: 1,
};
const secondPage: INotificationListPage = { items: [second], nextCursor: null, unreadCount: 1 };
const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const getNotificationApi = () => import('@/service/api');
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => (resolve = resolvePromise));
  return { promise, resolve };
};
const CurrentPath = () => {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}</output>;
};
const createWrapper =
  (queryClient: QueryClient, initialPath = '/notifications') =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );

describe('NotificationCenter', () => {
  beforeEach(async () => {
    const { getNotificationUnreadCount, getNotifications, markNotificationRead } =
      await getNotificationApi();
    vi.clearAllMocks();
    session.isLoaded = true;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
    vi.mocked(getNotificationUnreadCount).mockResolvedValue(envelope({ count: 1 }));
    vi.mocked(getNotifications).mockResolvedValue(envelope(firstPage));
    vi.mocked(markNotificationRead).mockResolvedValue(
      envelope({ ...first, readAt: '2026-11-05T06:30:00.000Z' })
    );
  });

  it('loads the badge for a signed-in user but only fetches inbox items when the popover opens', async () => {
    render(<NotificationCenter theme="dark" />, {
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });

    const api = await getNotificationApi();
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible();
    expect(api.getNotificationUnreadCount).toHaveBeenCalledOnce();
    expect(api.getNotifications).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    expect(await screen.findByText('Practice today')).toBeVisible();
    expect(api.getNotifications).toHaveBeenCalledWith({}, { limit: 20 });
  });

  it('keeps loaded rows during pagination and refreshes unread count after marking a row read', async () => {
    const api = await getNotificationApi();
    const secondPageRequest = deferred<ReturnType<typeof envelope<INotificationListPage>>>();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(api.getNotificationUnreadCount)
      .mockResolvedValueOnce(envelope({ count: 1 }))
      .mockResolvedValue(envelope({ count: 0 }));
    vi.mocked(api.getNotifications).mockImplementation((_api, params) => {
      if (params.cursor) return secondPageRequest.promise;
      return Promise.resolve(envelope(firstPage));
    });
    render(<NotificationCenter theme="dark" />, { wrapper: createWrapper(queryClient) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    expect(await screen.findByText('Practice today')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Load more notifications' }));
    expect(screen.getByText('Practice today')).toBeVisible();
    expect(api.getNotifications).toHaveBeenLastCalledWith({}, { cursor: 'cursor-one', limit: 20 });

    await act(async () => secondPageRequest.resolve(envelope(secondPage)));
    expect(await screen.findByText('Review your progress')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Mark Practice today as read' }));
    await waitFor(() => expect(api.getNotificationUnreadCount).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeVisible();
  });

  it('does not query notifications before Clerk has loaded or when signed out', async () => {
    session.isLoaded = false;
    session.isSignedIn = false;
    session.user = { id: undefined };
    render(<NotificationCenter theme="dark" />, {
      wrapper: createWrapper(new QueryClient()),
    });

    const api = await getNotificationApi();
    expect(api.getNotifications).not.toHaveBeenCalled();
    expect(api.getNotificationUnreadCount).not.toHaveBeenCalled();
  });

  it('clears a previous command error when the user starts another notification action', async () => {
    const api = await getNotificationApi();
    vi.mocked(api.markNotificationRead).mockRejectedValue(new Error('Read failed'));
    vi.mocked(api.markAllNotificationsRead).mockResolvedValue(envelope({ updatedCount: 1 }));
    render(<NotificationCenter theme="dark" />, {
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await user.click(await screen.findByRole('button', { name: 'Mark Practice today as read' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update notifications. Read failed'
    );

    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('marks an unread item read before navigating to its destination', async () => {
    const api = await getNotificationApi();
    const readRequest = deferred<ReturnType<typeof envelope<INotification>>>();
    vi.mocked(api.markNotificationRead).mockReturnValue(readRequest.promise);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <>
        <NotificationCenter theme="dark" />
        <CurrentPath />
      </>,
      { wrapper: createWrapper(queryClient) }
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await user.click(await screen.findByRole('link', { name: /Practice today/ }));

    expect(api.markNotificationRead).toHaveBeenCalledWith({}, first.id);
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/notifications');
    await act(async () =>
      readRequest.resolve(envelope({ ...first, readAt: '2026-11-05T06:30:00.000Z' }))
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Current path')).toHaveTextContent('/dashboard')
    );
  });

  it('stays on the current route and keeps the popover open when marking read fails', async () => {
    const api = await getNotificationApi();
    vi.mocked(api.markNotificationRead).mockRejectedValue(new Error('Read failed'));
    render(
      <>
        <NotificationCenter theme="dark" />
        <CurrentPath />
      </>,
      { wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) }
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await user.click(await screen.findByRole('link', { name: /Practice today/ }));

    expect(screen.getByLabelText('Current path')).toHaveTextContent('/notifications');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update notifications. Read failed'
    );
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
  });
});
