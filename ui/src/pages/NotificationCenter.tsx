import { useState } from 'react';
import { useNavigate } from 'react-router';

import { NotificationPopover } from '@/components/notifications';
import {
  useNotificationCommands,
  useNotificationUnreadCountReader,
  useNotificationsReader,
} from '@/logic/notifications';
import type { INotification, Theme } from '@/core';

interface INotificationCenterProps {
  theme: Theme;
}

const errorText = (error: Error | null, fallback: string): string | null => {
  if (!error) return null;
  const message = error.message.trim();
  return message ? `${fallback} ${message}` : fallback;
};

export const NotificationCenter = ({ theme }: INotificationCenterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const inbox = useNotificationsReader(isOpen);
  const unreadCount = useNotificationUnreadCountReader();
  const commands = useNotificationCommands();
  const notifications = inbox.data?.pages.flatMap((page) => page.items) ?? [];
  const count = unreadCount.data?.count ?? inbox.data?.pages[0]?.unreadCount ?? null;
  const commandError =
    commands.markRead.error ?? commands.markAllRead.error ?? commands.deleteNotification.error;
  const clearCommandErrors = () => {
    commands.markRead.reset();
    commands.markAllRead.reset();
    commands.deleteNotification.reset();
  };
  const handleOpenNotification = async (notification: INotification, href: string) => {
    clearCommandErrors();
    if (!notification.readAt) {
      try {
        await commands.markRead.mutateAsync(notification.id);
      } catch {
        return;
      }
    }
    setIsOpen(false);
    navigate(href);
  };

  return (
    <NotificationPopover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      notifications={notifications}
      unreadCount={count}
      unreadCountError={errorText(unreadCount.error, 'Unread count is unavailable.')}
      errorMessage={errorText(inbox.error, 'Notifications could not be loaded.')}
      hasLoaded={inbox.data !== undefined}
      actionErrorMessage={errorText(commandError, 'Could not update notifications.')}
      isLoading={inbox.isPending}
      isLoadingMore={inbox.isFetchingNextPage}
      hasMore={Boolean(inbox.hasNextPage)}
      pendingNotificationId={
        commands.markRead.isPending
          ? commands.markRead.variables
          : commands.deleteNotification.isPending
            ? commands.deleteNotification.variables
            : null
      }
      isMarkingAllRead={commands.markAllRead.isPending}
      theme={theme}
      onRetry={() => void inbox.refetch()}
      onRetryUnreadCount={() => void unreadCount.refetch()}
      onMarkRead={(notificationId) => {
        clearCommandErrors();
        commands.markRead.mutate(notificationId);
      }}
      onMarkAllRead={() => {
        clearCommandErrors();
        commands.markAllRead.mutate();
      }}
      onDelete={(notificationId) => {
        clearCommandErrors();
        commands.deleteNotification.mutate(notificationId);
      }}
      onLoadMore={() => void inbox.fetchNextPage()}
      onOpenNotification={(notification, href) => void handleOpenNotification(notification, href)}
    />
  );
};
