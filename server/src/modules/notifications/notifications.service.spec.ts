import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import { createUnsubscribeToken } from './email-unsubscribe-token.js';

describe('NotificationsService', () => {
  let settings: { findMany: ReturnType<typeof vi.fn> };
  let prisma: {
    userSettings: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    user: { findUnique: ReturnType<typeof vi.fn> };
  };
  let jobs: { enqueue: ReturnType<typeof vi.fn> };
  let config: { get: ReturnType<typeof vi.fn> };
  let logger: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    settings = {
      findMany: vi.fn().mockResolvedValue([
        {
          userId: 'user-kolkata',
          dailyReminderEnabled: true,
          dailyReminderTime: '19:00',
          timezone: 'Asia/Kolkata',
        },
        {
          userId: 'user-la',
          dailyReminderEnabled: true,
          dailyReminderTime: '21:00',
          timezone: 'America/Los_Angeles',
        },
      ]),
    };
    prisma = {
      userSettings: {
        ...settings,
        findUnique: vi.fn().mockResolvedValue({
          userId: 'user-1',
          dailyReminderEnabled: true,
          dailyReminderTime: '19:00',
          timezone: 'Asia/Kolkata',
          notifications: { email: true, dailyReminder: true },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'user-1', email: 'user@example.test', name: '<Alex>' }),
      },
    };
    jobs = { enqueue: vi.fn().mockResolvedValue('job-id') };
    config = {
      get: vi.fn(
        (key: string) =>
          ({
            RESEND_API_KEY: 're_test',
            RESEND_FROM_EMAIL: 'PrepAI <noreply@example.test>',
            EMAIL_UNSUBSCRIBE_SECRET: 'x'.repeat(32),
            API_BASE_URL: 'https://api.example.test',
          })[key]
      ),
    };
    logger = { warn: vi.fn(), error: vi.fn() };
  });

  const createService = (resend: { emails: { send: ReturnType<typeof vi.fn> } } | null = null) =>
    new NotificationsService(
      prisma as never,
      jobs as never,
      config as never,
      logger as never,
      resend as never
    );

  it('queues each opted-in reminder at the selected local time with a per-local-day key', async () => {
    const service = createService();

    await expect(service.enqueueDueDailyReminders(new Date('2026-11-03T13:30:00Z'))).resolves.toBe(
      1
    );

    expect(settings.findMany).toHaveBeenCalledWith({
      where: { dailyReminderEnabled: true },
      select: { userId: true, dailyReminderEnabled: true, dailyReminderTime: true, timezone: true },
    });
    expect(jobs.enqueue).toHaveBeenCalledWith(
      'email-queue',
      {
        idempotencyKey: 'daily-reminder:user-kolkata:2026-11-03',
        userId: 'user-kolkata',
        localDate: '2026-11-03',
      },
      'daily-reminder'
    );
  });

  it('does not enqueue when the email provider configuration is incomplete', async () => {
    config.get.mockReturnValue(undefined);
    const service = createService();

    await expect(service.enqueueDueDailyReminders(new Date())).resolves.toBe(0);

    expect(settings.findMany).not.toHaveBeenCalled();
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('uses default local time and timezone for settings created before reminder fields existed', async () => {
    settings.findMany.mockResolvedValueOnce([
      {
        userId: 'legacy-user',
        dailyReminderEnabled: true,
        dailyReminderTime: null,
        timezone: null,
      },
    ]);
    const service = createService();

    await expect(service.enqueueDueDailyReminders(new Date('2026-11-03T19:00:00Z'))).resolves.toBe(
      1
    );

    expect(jobs.enqueue).toHaveBeenCalledWith(
      'email-queue',
      expect.objectContaining({ idempotencyKey: 'daily-reminder:legacy-user:2026-11-03' }),
      'daily-reminder'
    );
  });

  it('sends an escaped reminder with a one-click unsubscribe URL and stable provider key', async () => {
    const resend = {
      emails: { send: vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null }) },
    };
    const service = createService(resend);

    await service.sendDailyReminder('user-1', '2026-11-03');

    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.test',
        html: expect.stringContaining('Hi &lt;Alex&gt;'),
        headers: expect.objectContaining({ 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }),
      }),
      { idempotencyKey: 'daily-reminder:user-1:2026-11-03' }
    );
    expect(resend.emails.send.mock.calls[0]?.[0].headers['List-Unsubscribe']).toContain(
      '/api/v1/notifications/unsubscribe?token='
    );
  });

  it('skips users who opted out after the reminder job was queued', async () => {
    prisma.userSettings.findUnique.mockResolvedValueOnce({
      dailyReminderEnabled: false,
      notifications: { email: true },
    });
    const resend = { emails: { send: vi.fn() } };
    const service = createService(resend);

    await expect(service.sendDailyReminder('user-1', '2026-11-03')).resolves.toBeUndefined();

    expect(resend.emails.send).not.toHaveBeenCalled();
  });

  it('skips opted-out email channels, missing users, and missing settings', async () => {
    const resend = { emails: { send: vi.fn() } };
    const service = createService(resend);
    prisma.userSettings.findUnique.mockResolvedValueOnce({
      dailyReminderEnabled: true,
      notifications: { email: false },
    });
    await service.sendDailyReminder('user-1', '2026-11-03');

    prisma.userSettings.findUnique.mockResolvedValueOnce(null);
    await service.sendDailyReminder('user-1', '2026-11-03');

    prisma.userSettings.findUnique.mockResolvedValueOnce({
      dailyReminderEnabled: true,
      notifications: null,
    });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await service.sendDailyReminder('user-1', '2026-11-03');

    expect(resend.emails.send).not.toHaveBeenCalled();
  });

  it('throws a retryable error when Resend rejects a reminder', async () => {
    const resend = {
      emails: { send: vi.fn().mockResolvedValue({ data: null, error: { message: 'failed' } }) },
    };
    const service = createService(resend);

    await expect(service.sendDailyReminder('user-1', '2026-11-03')).rejects.toThrow(
      'Email provider rejected the reminder'
    );
  });

  it('skips unsubscribe updates when no settings document remains', async () => {
    prisma.userSettings.findUnique.mockResolvedValueOnce(null);
    const service = createService();
    const token = createUnsubscribeToken('user-1', 'x'.repeat(32));

    await expect(service.unsubscribe(token)).resolves.toBeUndefined();

    expect(prisma.userSettings.updateMany).not.toHaveBeenCalled();
  });

  it('rejects invalid reminder dates and unsubscribe tokens', async () => {
    const service = createService({ emails: { send: vi.fn() } });

    await expect(service.sendDailyReminder('user-1', 'not-a-date')).rejects.toThrow(
      'Invalid reminder date'
    );
    await expect(service.sendDailyReminder('user-1', '2026-02-31')).rejects.toThrow(
      'Invalid reminder date'
    );
    await expect(service.unsubscribe('tampered')).rejects.toThrow('Invalid unsubscribe token');
  });

  it('disables only the daily reminder preference using the signed unsubscribe identity', async () => {
    const service = createService();
    const token = createUnsubscribeToken('user-1', 'x'.repeat(32));

    await expect(service.unsubscribe(token)).resolves.toBeUndefined();

    expect(prisma.userSettings.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        dailyReminderEnabled: false,
        notifications: { email: true, dailyReminder: false },
      },
    });
  });

  it('validates an unsubscribe token only when its signing secret is configured', () => {
    const service = createService();
    const token = createUnsubscribeToken('user-1', 'x'.repeat(32));
    expect(service.isUnsubscribeTokenValid(token)).toBe(true);

    config.get.mockReturnValue(undefined);
    expect(service.isUnsubscribeTokenValid(token)).toBe(false);
  });

  it('requires a Resend client even when other delivery settings are configured', async () => {
    const service = createService(null);

    await expect(service.sendDailyReminder('user-1', '2026-11-03')).rejects.toThrow(
      'Email delivery is not configured'
    );
  });
});
