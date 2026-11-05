import { MemoryRouter } from 'react-router';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { INotification } from '@/core';
import { NotificationPopover } from './NotificationPopover';
import type { INotificationPopoverProps } from './NotificationPopover.types';

const notification: INotification = {
  id: 'notice-one',
  category: 'reminder',
  title: 'Practice today',
  body: 'Take a few minutes to practice today.',
  link: '/dashboard',
  readAt: null,
  createdAt: '2026-11-05T06:00:00.000Z',
};

const createProps = (
  overrides: Partial<Omit<INotificationPopoverProps, 'isOpen' | 'onOpenChange'>> = {}
) => ({
  notifications: [notification],
  unreadCount: 100,
  unreadCountError: null,
  errorMessage: null,
  actionErrorMessage: null,
  hasLoaded: true,
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  pendingNotificationId: null,
  isMarkingAllRead: false,
  theme: 'dark' as const,
  onRetry: vi.fn(),
  onRetryUnreadCount: vi.fn(),
  onMarkRead: vi.fn(),
  onMarkAllRead: vi.fn(),
  onDelete: vi.fn(),
  onLoadMore: vi.fn(),
  onOpenNotification: vi.fn(),
  ...overrides,
});

const Harness = (props: ReturnType<typeof createProps>) => {
  const [isOpen, setIsOpen] = useState(false);
  return <NotificationPopover {...props} isOpen={isOpen} onOpenChange={setIsOpen} />;
};

const renderHarness = (props: ReturnType<typeof createProps>) =>
  render(
    <MemoryRouter>
      <Harness {...props} />
    </MemoryRouter>
  );

describe('NotificationPopover', () => {
  it('opens from the header bell, caps the unread badge, and shows safe notification links', async () => {
    const user = userEvent.setup();
    const props = createProps();
    renderHarness(props);

    const trigger = screen.getByRole('button', { name: 'Notifications, 99+ unread' });
    expect(within(trigger).getByText('99+')).toBeVisible();
    await user.click(trigger);

    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByRole('link', { name: /Practice today/ })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(within(panel).getByText('Take a few minutes to practice today.')).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Mark all as read' })).toBeEnabled();
    await user.click(within(panel).getByRole('link', { name: /Practice today/ }));
    expect(props.onOpenNotification).toHaveBeenCalledWith(notification, '/dashboard');
  });

  it('shows the empty state without a mark-all action', async () => {
    const user = userEvent.setup();
    renderHarness(createProps({ notifications: [], unreadCount: 0 }));
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('You are all caught up')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
  });

  it('shows a loading state while fetching notifications', async () => {
    const user = userEvent.setup();
    renderHarness(createProps({ isLoading: true, notifications: [], unreadCount: 0 }));
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Loading notifications');
  });

  it('shows a retriable list error', async () => {
    const user = userEvent.setup();
    const errorProps = createProps({ errorMessage: 'Notifications could not be loaded.' });
    renderHarness(errorProps);
    await user.click(screen.getByRole('button', { name: 'Notifications, 99+ unread' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Notifications could not be loaded.'
    );
    await user.click(screen.getByRole('button', { name: 'Retry notifications' }));
    expect(errorProps.onRetry).toHaveBeenCalledOnce();
  });

  it('does not show the successful empty state after the first page fails', async () => {
    const user = userEvent.setup();
    renderHarness(
      createProps({ notifications: [], errorMessage: 'Inbox request failed.', hasLoaded: false })
    );
    await user.click(screen.getByRole('button', { name: 'Notifications, 99+ unread' }));

    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByRole('alert')).toHaveTextContent('Inbox request failed.');
    expect(within(panel).queryByText('You are all caught up')).toBeNull();
  });

  it('forwards read, mark-all, delete, and load-more actions', async () => {
    const user = userEvent.setup();
    const props = createProps({ hasMore: true });
    renderHarness(props);
    await user.click(screen.getByRole('button', { name: 'Notifications, 99+ unread' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });

    await user.click(within(panel).getByRole('button', { name: 'Mark Practice today as read' }));
    await user.click(within(panel).getByRole('button', { name: 'Delete Practice today' }));
    await user.click(within(panel).getByRole('button', { name: 'Mark all as read' }));
    await user.click(within(panel).getByRole('button', { name: 'Load more notifications' }));

    expect(props.onMarkRead).toHaveBeenCalledWith(notification.id);
    expect(props.onDelete).toHaveBeenCalledWith(notification.id);
    expect(props.onMarkAllRead).toHaveBeenCalledOnce();
    expect(props.onLoadMore).toHaveBeenCalledOnce();
  });

  it('renders unsafe external destinations as text and closes with Escape restoring trigger focus', async () => {
    const user = userEvent.setup();
    renderHarness(
      createProps({ notifications: [{ ...notification, link: 'https://example.com/phishing' }] })
    );
    const trigger = screen.getByRole('button', { name: 'Notifications, 99+ unread' });
    await user.click(trigger);
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByText('Practice today')).toBeVisible();
    expect(within(panel).queryByRole('link', { name: /Practice today/ })).toBeNull();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes when the user clicks outside the notification popover', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Harness {...createProps()} />
        <button type="button">Outside target</button>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Notifications, 99+ unread' }));
    expect(await screen.findByRole('dialog', { name: 'Notifications' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Outside target' }));
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
  });

  it('shows unread-count errors with an independent retry action', async () => {
    const user = userEvent.setup();
    const props = createProps({
      unreadCount: null,
      unreadCountError: 'Unread count is unavailable.',
    });
    renderHarness(props);
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByText('Unread count is unavailable.')).toBeVisible();
    await user.click(within(panel).getByRole('button', { name: 'Retry unread count' }));
    expect(props.onRetryUnreadCount).toHaveBeenCalledOnce();
  });

  it('shows command failures without hiding the notification list', async () => {
    const user = userEvent.setup();
    renderHarness(
      createProps({
        actionErrorMessage: 'Could not update this notification. Try again.',
      })
    );
    await user.click(screen.getByRole('button', { name: 'Notifications, 99+ unread' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByRole('alert')).toHaveTextContent(
      'Could not update this notification. Try again.'
    );
    expect(within(panel).getByText('Practice today')).toBeVisible();
  });
});
