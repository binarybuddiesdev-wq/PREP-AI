import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from './redis.service.js';

const redisMocks = vi.hoisted(() => ({
  client: {
    eval: vi.fn(),
    on: vi.fn(),
    disconnect: vi.fn(),
  },
  constructor: vi.fn(),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn(function RedisMock() {
    return redisMocks.client;
  }),
}));

describe('RedisService unique quota reservations', () => {
  let service: RedisService;
  const quotaKey = 'coding-solved:user_001:2026-11-02';
  const itemKey = 'coding-problem:user_001:problem_001';
  const limit = 5;
  const ttlSeconds = 3_600;

  beforeEach(async () => {
    redisMocks.client.eval.mockReset();
    redisMocks.client.on.mockReset();
    redisMocks.client.disconnect.mockReset();

    const config = {
      get: vi.fn((key: string) => (key === 'REDIS_HOST' ? '127.0.0.1' : 6379)),
    };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: ConfigService, useValue: config },
        { provide: 'PinoLogger:RedisService', useValue: logger },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it.each([
    [1, { status: 'reserved', count: 2 }],
    [2, { status: 'already_solved', count: 2 }],
    [3, { status: 'in_progress', count: 2 }],
    [0, { status: 'limit', count: 5 }],
  ])('maps Lua reservation response %i into its explicit outcome', async (luaStatus, expected) => {
    redisMocks.client.eval.mockResolvedValueOnce([luaStatus, expected.count]);

    await expect(service.reserveUniqueQuota(quotaKey, itemKey, limit, ttlSeconds)).resolves.toEqual(
      expected
    );

    const [script, keyCount, receivedQuotaKey, receivedItemKey, receivedLimit, receivedTtl] =
      redisMocks.client.eval.mock.calls[0];
    expect(script).toContain("redis.call('GET', KEYS[2])");
    expect(script).toContain("redis.call('INCR', KEYS[1])");
    expect(keyCount).toBe(2);
    expect(receivedQuotaKey).toBe(quotaKey);
    expect(receivedItemKey).toBe(itemKey);
    expect(receivedLimit).toBe(String(limit));
    expect(receivedTtl).toBe(String(ttlSeconds));
  });

  it('rejects malformed Lua reservation results instead of granting a quota slot', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([1]);

    await expect(service.reserveUniqueQuota(quotaKey, itemKey, limit, ttlSeconds)).rejects.toThrow(
      'invalid unique quota reservation result'
    );
  });

  it.each(['solved', 'release'] as const)(
    'dispatches the %s finalization outcome to the atomic two-key Lua script',
    async (outcome) => {
      redisMocks.client.eval.mockResolvedValueOnce(1);

      await expect(
        service.finalizeUniqueQuota(quotaKey, itemKey, outcome, ttlSeconds)
      ).resolves.toBeUndefined();

      const [script, keyCount, receivedQuotaKey, receivedItemKey, receivedOutcome, receivedTtl] =
        redisMocks.client.eval.mock.calls[0];
      expect(script).toContain("redis.call('GET', KEYS[2])");
      expect(keyCount).toBe(2);
      expect(receivedQuotaKey).toBe(quotaKey);
      expect(receivedItemKey).toBe(itemKey);
      expect(receivedOutcome).toBe(outcome);
      expect(receivedTtl).toBe(String(ttlSeconds));
    }
  );
});
