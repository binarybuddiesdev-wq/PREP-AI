const NOTIFICATION_ROOT_KEY = ['prepai', 'notifications'] as const;

export const notificationKeys = {
  all: NOTIFICATION_ROOT_KEY,
  inbox: (userId: string) => [...NOTIFICATION_ROOT_KEY, userId, 'inbox'] as const,
  unreadCount: (userId: string) => [...NOTIFICATION_ROOT_KEY, userId, 'unread-count'] as const,
};
