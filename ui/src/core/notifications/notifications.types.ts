export interface INotification {
  id: string;
  category: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface INotificationListPage {
  items: INotification[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface INotificationUnreadCount {
  count: number;
}

export interface INotificationMarkAllReadResult {
  updatedCount: number;
}

export interface INotificationsRequest {
  cursor?: string;
  limit: number;
}
