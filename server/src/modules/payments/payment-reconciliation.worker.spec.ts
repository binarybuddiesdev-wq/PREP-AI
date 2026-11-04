import { beforeEach, describe, expect, it, vi } from 'vitest';

const bullMocks = vi.hoisted(() => ({
  processor: undefined as
    undefined | ((job: { data: Record<string, unknown> }) => Promise<unknown>),
  worker: { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('bullmq', () => ({
  Worker: class {
    constructor(_name: string, processor: typeof bullMocks.processor) {
      bullMocks.processor = processor;
      return bullMocks.worker;
    }
  },
}));

import { PaymentReconciliationWorker } from './payment-reconciliation.worker.js';

describe('PaymentReconciliationWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bullMocks.processor = undefined;
  });

  it('does not connect a worker when workers are disabled', async () => {
    const service = { processWebhookEvent: vi.fn() };
    const worker = new PaymentReconciliationWorker(
      {
        get: (key: string, fallback?: unknown) =>
          key === 'JOBS_WORKER_ENABLED' ? false : fallback,
      } as never,
      service as never
    );
    await worker.onModuleInit();
    await worker.onModuleDestroy();
    expect(bullMocks.processor).toBeUndefined();
    expect(bullMocks.worker.close).not.toHaveBeenCalled();
  });

  it('processes valid jobs, records attempts, and closes its worker', async () => {
    const service = { processWebhookEvent: vi.fn().mockResolvedValue(undefined) };
    const metrics = { recordWorkerJobAttempt: vi.fn() };
    const config = {
      get: (key: string, fallback?: unknown) => (key === 'JOBS_WORKER_ENABLED' ? true : fallback),
    };
    const worker = new PaymentReconciliationWorker(
      config as never,
      service as never,
      metrics as never
    );
    await worker.onModuleInit();
    const failedHandler = bullMocks.worker.on.mock.calls.find(([event]) => event === 'failed')?.[1];
    const errorHandler = bullMocks.worker.on.mock.calls.find(([event]) => event === 'error')?.[1];
    failedHandler?.({ id: 'job_1', attemptsMade: 1 }, new Error('job failed'));
    errorHandler?.(new Error('worker error'));
    await bullMocks.processor!({ data: { userId: 'user_1', idempotencyKey: 'evt_1' } });
    await new Promise((resolve) => setImmediate(resolve));
    await worker.onModuleDestroy();

    expect(service.processWebhookEvent).toHaveBeenCalledWith('user_1', 'evt_1');
    expect(metrics.recordWorkerJobAttempt).toHaveBeenCalledWith(
      'payment-reconcile-queue',
      'success',
      expect.any(Number)
    );
    expect(bullMocks.worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(bullMocks.worker.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(bullMocks.worker.close).toHaveBeenCalledOnce();
  });

  it('rejects malformed jobs so BullMQ can retry them', async () => {
    const service = { processWebhookEvent: vi.fn() };
    const config = {
      get: (key: string, fallback?: unknown) => (key === 'JOBS_WORKER_ENABLED' ? true : fallback),
    };
    const worker = new PaymentReconciliationWorker(config as never, service as never);
    await worker.onModuleInit();
    await expect(
      bullMocks.processor!({ data: { userId: '', idempotencyKey: 'evt_1' } })
    ).rejects.toThrow('Invalid payment reconciliation job');
    expect(service.processWebhookEvent).not.toHaveBeenCalled();
    await worker.onModuleDestroy();
  });
});
