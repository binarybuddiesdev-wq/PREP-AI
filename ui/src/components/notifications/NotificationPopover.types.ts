import type { INotification, Theme } from '@/core';

export interface INotificationPopoverProps {
  isOpen: boolean;
  notifications: INotification[];
  unreadCount: number | null;
  unreadCountError: string | null;
  errorMessage: string | null;
  actionErrorMessage: string | null;
  hasLoaded: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  pendingNotificationId: string | null;
  isMarkingAllRead: boolean;
  theme: Theme;
  onOpenChange: (isOpen: boolean) => void;
  onRetry: () => void;
  onRetryUnreadCount: () => void;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onDelete: (notificationId: string) => void;
  onOpenNotification: (notification: INotification, href: string) => void;
  onLoadMore: () => void;
}
