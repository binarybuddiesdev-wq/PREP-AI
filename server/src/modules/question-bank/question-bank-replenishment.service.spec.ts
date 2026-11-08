import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionBankReplenishmentService } from './question-bank-replenishment.service.js';

describe('QuestionBankReplenishmentService', () => {
  const config = { get: vi.fn() };
  const jobs = { enqueue: vi.fn().mockResolvedValue('job-id') };
  const repository = { count: vi.fn() };
  const redis = { reserveQuota: vi.fn() };
  let service: QuestionBankReplenishmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockReturnValue(true);
    repository.count.mockResolvedValue(20);
    redis.reserveQuota.mockResolvedValue({ allowed: true });
    service = new QuestionBankReplenishmentService(
      config as never,
      jobs as never,
      repository as never,
      redis as never
    );
  });

  it('queues an idempotent refill at the low-water mark', async () => {
    repository.count.mockResolvedValue(20);
    await expect(
      service.request({ kind: 'theory', topic: 'react', difficulty: 'Junior' })
    ).resolves.toBe(true);
    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        kind: 'theory',
        topic: 'react',
        difficulty: 'Junior',
        idempotencyKey: expect.stringMatching(/^theory:react:junior:/),
      }),
      'replenish',
      true
    );
  });

  it('does not enqueue while the pool is above low water', async () => {
    repository.count.mockResolvedValue(21);
    await expect(
      service.request({ kind: 'theory', topic: 'react', difficulty: 'Junior' })
    ).resolves.toBe(false);
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('does not enqueue when background workers are disabled', async () => {
    config.get.mockReturnValue(false);
    await expect(
      service.request({ kind: 'coding', topic: 'Arrays', difficulty: 'Easy' })
    ).resolves.toBe(false);
    expect(repository.count).not.toHaveBeenCalled();
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('enforces the daily batch ceiling through Redis', async () => {
    config.get.mockReturnValue(40);
    redis.reserveQuota.mockResolvedValue({ allowed: false });
    await expect(service.reserveDailyBatch()).resolves.toBe(false);
    expect(redis.reserveQuota).toHaveBeenCalledWith(
      expect.stringMatching(/^question-bank-batches:\d{4}-\d{2}-\d{2}$/),
      40,
      86_400
    );
  });
});
