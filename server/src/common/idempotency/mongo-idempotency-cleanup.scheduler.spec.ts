import { describe, expect, it, vi } from 'vitest';
import { MongoIdempotencyCleanupScheduler } from './mongo-idempotency-cleanup.scheduler.js';

describe('MongoIdempotencyCleanupScheduler', () => {
  it('removes expired response snapshots and returns the deleted count', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const scheduler = new MongoIdempotencyCleanupScheduler({
      idempotencyOperation: { deleteMany },
    } as never);

    await expect(scheduler.cleanupExpiredOperations()).resolves.toBe(3);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it('keeps cleanup failures from affecting application startup or other jobs', async () => {
    const deleteMany = vi.fn().mockRejectedValue(new Error('Mongo unavailable'));
    const scheduler = new MongoIdempotencyCleanupScheduler({
      idempotencyOperation: { deleteMany },
    } as never);

    await expect(scheduler.cleanupExpiredOperations()).resolves.toBe(0);
  });
});
