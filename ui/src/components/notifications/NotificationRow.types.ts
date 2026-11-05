import type { INotification, Theme } from '@/core';

export interface INotificationRowProps {
  notification: INotification;
  theme: Theme;
  isBusy: boolean;
  onMarkRead: (notificationId: string) => void;
  onDelete: (notificationId: string) => void;
  onOpenNotification: (href: string) => void;
}
