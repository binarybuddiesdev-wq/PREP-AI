import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from './apiClient.types';
import {
  deleteNotification,
  getNotificationUnreadCount,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.api';

const notification = {
  id: '507f1f77bcf86cd799439011',
  category: 'reminder',
  title: 'A little practice goes a long way',
  body: 'Take a few minutes to practice today.',
  link: '/dashboard',
  readAt: null,
  createdAt: '2026-11-05T06:00:00.000Z',
};

const createApi = () => {
  const getJson = vi.fn().mockResolvedValue({
    success: true,
    message: 'Notifications retrieved successfully',
    data: { items: [notification], nextCursor: null, unreadCount: 1 },
  });
  const unreadJson = vi.fn().mockResolvedValue({ success: true, message: '', data: { count: 1 } });
  const markJson = vi.fn().mockResolvedValue({
    success: true,
    message: 'Notification marked as read',
    data: { ...notification, readAt: '2026-11-05T06:30:00.000Z' },
  });
  const markAllJson = vi.fn().mockResolvedValue({
    success: true,
    message: 'Notifications marked as read',
    data: { updatedCount: 1 },
  });
  const deleteJson = vi.fn().mockResolvedValue({
    success: true,
    message: 'Notification deleted',
    data: null,
  });
  const get = vi.fn((route: string) => ({
    json: route === 'notifications/unread-count' ? unreadJson : getJson,
  }));
  const patch = vi.fn((route: string) => ({
    json: route === 'notifications/read-all' ? markAllJson : markJson,
  }));
  const deleteRequest = vi.fn().mockReturnValue({ json: deleteJson });
  const api = { get, patch, delete: deleteRequest } as unknown as ApiClient;

  return { api, get, patch, deleteRequest, getJson, unreadJson, markJson, markAllJson, deleteJson };
};

describe('notification API', () => {
  it('requests the first notification page without an empty cursor', async () => {
    const { api, get } = createApi();

    const response = await getNotifications(api, { limit: 20 });

    expect(get).toHaveBeenCalledWith('notifications', { searchParams: { limit: 20 } });
    expect(response.data.items).toEqual([notification]);
    expect(response.data.nextCursor).toBeNull();
    expect(response.data.unreadCount).toBe(1);
  });

  it('forwards the next cursor and requested page size', async () => {
    const { api, get } = createApi();

    await getNotifications(api, { cursor: '507f1f77bcf86cd799439011', limit: 10 });

    expect(get).toHaveBeenCalledWith('notifications', {
      searchParams: { cursor: '507f1f77bcf86cd799439011', limit: 10 },
    });
  });

  it('reads the authenticated user unread count', async () => {
    const { api, get } = createApi();

    const response = await getNotificationUnreadCount(api);

    expect(get).toHaveBeenCalledWith('notifications/unread-count');
    expect(response.data.count).toBe(1);
  });

  it('marks one notification read using its encoded ID', async () => {
    const { api, patch } = createApi();

    const response = await markNotificationRead(api, 'notification/1');

    expect(patch).toHaveBeenCalledWith('notifications/notification%2F1/read');
    expect(response.data.readAt).toBe('2026-11-05T06:30:00.000Z');
  });

  it('marks all notifications read', async () => {
    const { api, patch } = createApi();

    const response = await markAllNotificationsRead(api);

    expect(patch).toHaveBeenCalledWith('notifications/read-all');
    expect(response.data.updatedCount).toBe(1);
  });

  it('deletes one notification by its encoded ID', async () => {
    const { api, deleteRequest } = createApi();

    const response = await deleteNotification(api, 'notification/1');

    expect(deleteRequest).toHaveBeenCalledWith('notifications/notification%2F1');
    expect(response.data).toBeNull();
  });
});
