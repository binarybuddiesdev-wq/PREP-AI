import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClerkAuthGuard } from '@/common/guards/clerk-auth.guard.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsController', () => {
  let notifications: {
    isUnsubscribeTokenValid: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    listInAppNotifications: ReturnType<typeof vi.fn>;
    getUnreadNotificationCount: ReturnType<typeof vi.fn>;
    markInAppNotificationRead: ReturnType<typeof vi.fn>;
    markAllInAppNotificationsRead: ReturnType<typeof vi.fn>;
    deleteInAppNotification: ReturnType<typeof vi.fn>;
  };
  let logger: { info: ReturnType<typeof vi.fn> };
  let reply: {
    status: ReturnType<typeof vi.fn>;
    type: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    notifications = {
      isUnsubscribeTokenValid: vi.fn().mockReturnValue(true),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      listInAppNotifications: vi
        .fn()
        .mockResolvedValue({ items: [], nextCursor: null, unreadCount: 0 }),
      getUnreadNotificationCount: vi.fn().mockResolvedValue(4),
      markInAppNotificationRead: vi.fn().mockResolvedValue({ id: 'notice-1', readAt: new Date() }),
      markAllInAppNotificationsRead: vi.fn().mockResolvedValue(4),
      deleteInAppNotification: vi.fn().mockResolvedValue(undefined),
    };
    logger = { info: vi.fn() };
    reply = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  const createController = () =>
    new NotificationsController(notifications as unknown as NotificationsService, logger as never);

  it('shows a confirmation form on GET and does not unsubscribe automatically', async () => {
    const controller = createController();

    await controller.confirmUnsubscribe('signed-token', reply as never);

    expect(reply.type).toHaveBeenCalledWith('text/html');
    expect(reply.send).toHaveBeenCalledWith(expect.stringContaining('method="post"'));
    expect(reply.send).toHaveBeenCalledWith(expect.stringContaining('signed-token'));
    expect(notifications.unsubscribe).not.toHaveBeenCalled();
  });

  it('rejects invalid unsubscribe links without changing preferences', async () => {
    notifications.isUnsubscribeTokenValid.mockReturnValueOnce(false);
    const controller = createController();

    await controller.confirmUnsubscribe('bad-token', reply as never);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(expect.stringContaining('Link unavailable'));
    expect(notifications.unsubscribe).not.toHaveBeenCalled();
  });

  it('treats a missing token as an invalid link without mutating settings', async () => {
    notifications.isUnsubscribeTokenValid.mockReturnValueOnce(false);
    const controller = createController();

    await controller.confirmUnsubscribe(undefined as never, reply as never);

    expect(notifications.isUnsubscribeTokenValid).toHaveBeenCalledWith('');
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it('applies the opt-out only on POST', async () => {
    const controller = createController();

    await controller.unsubscribe('signed-token', reply as never);

    expect(notifications.unsubscribe).toHaveBeenCalledWith('signed-token');
    expect(reply.send).toHaveBeenCalledWith(expect.stringContaining('Reminder emails disabled'));
  });

  it('passes a missing POST token through as empty so service validation rejects it', async () => {
    notifications.unsubscribe.mockRejectedValueOnce(new Error('invalid token'));
    const controller = createController();

    await expect(controller.unsubscribe(undefined as never, reply as never)).rejects.toThrow(
      'invalid token'
    );
    expect(notifications.unsubscribe).toHaveBeenCalledWith('');
  });

  it('lists notifications for the authenticated Clerk subject with pagination', async () => {
    const controller = createController();

    await expect(
      controller.list('clerk-user-1', { cursor: undefined, limit: 20 })
    ).resolves.toEqual({
      message: 'Notifications retrieved successfully',
      data: { items: [], nextCursor: null, unreadCount: 0 },
    });
    expect(notifications.listInAppNotifications).toHaveBeenCalledWith(
      'clerk-user-1',
      undefined,
      20
    );
  });

  it('returns unread count and delegates owner-scoped inbox mutations', async () => {
    const controller = createController();

    await expect(controller.unreadCount('clerk-user-1')).resolves.toEqual({ data: { count: 4 } });
    await controller.markRead('507f1f77bcf86cd799439011', 'clerk-user-1');
    await controller.markAllRead('clerk-user-1');
    await controller.deleteNotification('507f1f77bcf86cd799439011', 'clerk-user-1');

    expect(notifications.markInAppNotificationRead).toHaveBeenCalledWith(
      'clerk-user-1',
      '507f1f77bcf86cd799439011'
    );
    expect(notifications.markAllInAppNotificationsRead).toHaveBeenCalledWith('clerk-user-1');
    expect(notifications.deleteInAppNotification).toHaveBeenCalledWith(
      'clerk-user-1',
      '507f1f77bcf86cd799439011'
    );
  });

  it('protects every inbox route with Clerk auth while keeping unsubscribe public', () => {
    const inboxRoutes = ['list', 'unreadCount', 'markAllRead', 'markRead', 'deleteNotification'];
    const handlers = NotificationsController.prototype as unknown as Record<string, object>;
    for (const route of inboxRoutes) {
      expect(Reflect.getMetadata('__guards__', handlers[route])).toContain(ClerkAuthGuard);
    }
    expect(Reflect.getMetadata('__guards__', handlers['confirmUnsubscribe'])).toBeUndefined();
    expect(Reflect.getMetadata('__guards__', handlers['unsubscribe'])).toBeUndefined();
  });
});
