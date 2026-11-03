import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EmailReminderScheduler } from './email-reminder.scheduler.js';
import { NotificationsService } from './notifications.service.js';

describe('EmailReminderScheduler', () => {
  let notifications: {
    enqueueDueDailyReminders: ReturnType<typeof vi.fn>;
    cleanupExpiredInAppNotifications: ReturnType<typeof vi.fn>;
  };
  let logger: { error: ReturnType<typeof vi.fn> };
  let config: { get: ReturnType<typeof vi.fn> };
  let scheduler: EmailReminderScheduler;

  beforeEach(() => {
    notifications = {
      enqueueDueDailyReminders: vi.fn().mockResolvedValue(0),
      cleanupExpiredInAppNotifications: vi.fn().mockResolvedValue(0),
    };
    logger = { error: vi.fn() };
    config = { get: vi.fn((_key: string, fallback?: unknown) => fallback) };
    scheduler = new EmailReminderScheduler(
      notifications as unknown as NotificationsService,
      config as unknown as ConfigService,
      logger as never
    );
  });

  it('scans for due reminders once per scheduled tick', async () => {
    await scheduler.scheduleDueReminders();

    expect(notifications.enqueueDueDailyReminders).toHaveBeenCalledOnce();
  });

  it('logs a scan failure so later scheduled ticks can continue', async () => {
    notifications.enqueueDueDailyReminders.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(scheduler.scheduleDueReminders()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Failed to scan daily email reminders'
    );
  });

  it('does not create email jobs when the worker process is disabled', async () => {
    config.get.mockReturnValue(false);

    await scheduler.scheduleDueReminders();

    expect(notifications.enqueueDueDailyReminders).not.toHaveBeenCalled();
  });

  it('cleans up notifications older than ninety days on its daily schedule', async () => {
    await scheduler.cleanupExpiredNotifications();

    expect(notifications.cleanupExpiredInAppNotifications).toHaveBeenCalledOnce();
  });
});
