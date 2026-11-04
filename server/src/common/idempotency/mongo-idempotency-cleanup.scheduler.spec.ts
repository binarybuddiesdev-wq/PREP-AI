import { describe, expect, it, vi } from 'vitest';
import { MongoIdempotencyCleanupScheduler } from './mongo-idempotency-cleanup.scheduler.js';

describe('MongoIdempotencyCleanupScheduler', () => {
  it('removes expired response snapshots and returns the deleted count', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const deleteStudyChatOperations = vi.fn().mockResolvedValue({ count: 4 });
    const scheduler = new MongoIdempotencyCleanupScheduler({
      idempotencyOperation: { deleteMany },
      studyChatOperation: { deleteMany: deleteStudyChatOperations },
    } as never);

    await expect(scheduler.cleanupExpiredOperations()).resolves.toBe(7);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
    expect(deleteStudyChatOperations).toHaveBeenCalledWith({
      where: {
        status: 'COMPLETED',
        OR: [
          { expiresAt: { lt: expect.any(Date) } },
          { expiresAt: { isSet: false }, updatedAt: { lt: expect.any(Date) } },
        ],
      },
    });
  });

  it('keeps cleanup failures from affecting application startup or other jobs', async () => {
    const deleteMany = vi.fn().mockRejectedValue(new Error('Mongo unavailable'));
    const scheduler = new MongoIdempotencyCleanupScheduler({
      idempotencyOperation: { deleteMany },
      studyChatOperation: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    } as never);

    await expect(scheduler.cleanupExpiredOperations()).resolves.toBe(0);
  });
});
