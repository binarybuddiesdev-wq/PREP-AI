import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailWorker } from './email.worker.js';
import { NotificationsService } from './notifications.service.js';
import { EmailReminderJob } from './email.types.js';

const bullMocks = vi.hoisted(() => ({ on: vi.fn(), close: vi.fn() }));

vi.mock('bullmq', () => ({
  Worker: vi.fn(function WorkerMock() {
    return { on: bullMocks.on, close: bullMocks.close };
  }),
}));

describe('EmailWorker', () => {
  let config: { get: ReturnType<typeof vi.fn> };
  let notifications: { sendDailyReminder: ReturnType<typeof vi.fn> };
  let logger: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const data: EmailReminderJob = {
    idempotencyKey: 'daily-reminder:user-1:2026-11-03',
    userId: 'user-1',
    localDate: '2026-11-03',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bullMocks.close.mockResolvedValue(undefined);
    config = {
      get: vi.fn((key: string, fallback?: unknown) => {
        if (
          key === 'RESEND_API_KEY' ||
          key === 'RESEND_FROM_EMAIL' ||
          key === 'EMAIL_UNSUBSCRIBE_SECRET' ||
          key === 'API_BASE_URL'
        )
          return 'configured';
        if (key === 'JOBS_WORKER_ENABLED') return fallback;
        return key === 'REDIS_PORT' ? 6379 : key === 'REDIS_HOST' ? 'redis.local' : fallback;
      }),
    };
    notifications = { sendDailyReminder: vi.fn().mockResolvedValue(undefined) };
    logger = { warn: vi.fn(), error: vi.fn() };
  });

  const createWorker = () =>
    new EmailWorker(
      config as unknown as ConfigService,
      notifications as unknown as NotificationsService,
      logger as never
    );

  it('consumes email jobs with queue policy and delegates only user ID and local date', async () => {
    const worker = createWorker();
    await worker.onModuleInit();

    expect(Worker).toHaveBeenCalledWith(
      'email-queue',
      expect.any(Function),
      expect.objectContaining({ concurrency: 10, maxStalledCount: 1 })
    );
    const processJob = vi.mocked(Worker).mock.calls[0]?.[1] as (job: {
      data: EmailReminderJob;
    }) => Promise<void>;
    await processJob({ data });
    expect(notifications.sendDailyReminder).toHaveBeenCalledWith(data.userId, data.localDate);
    await worker.onModuleDestroy();
  });

  it('does not start when email credentials or workers are disabled', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'JOBS_WORKER_ENABLED' ? fallback : key === 'RESEND_API_KEY' ? undefined : fallback
    );
    const worker = createWorker();

    await worker.onModuleInit();
    await worker.onModuleDestroy();

    expect(Worker).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('honors the global worker-disabled setting without requiring provider credentials', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'JOBS_WORKER_ENABLED' ? false : fallback
    );
    const worker = createWorker();

    await worker.onModuleInit();
    await worker.onModuleDestroy();

    expect(Worker).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('includes the originating request ID in failed reminder logs', async () => {
    const worker = createWorker();
    await worker.onModuleInit();
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: Job<EmailReminderJob>,
      error: Error
    ) => void;
    const requestId = '8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3';

    failedHandler(
      { data: { ...data, requestId } } as Job<EmailReminderJob>,
      new Error('mail provider unavailable')
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ requestId }),
      'Email reminder job failed'
    );
    await worker.onModuleDestroy();
  });
});
