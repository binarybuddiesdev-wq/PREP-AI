import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from './redis.service.js';

const redisMocks = vi.hoisted(() => ({
  client: {
    eval: vi.fn(),
    on: vi.fn(),
    disconnect: vi.fn(),
    ping: vi.fn(),
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
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  const quotaKey = 'coding-solved:user_001:2026-11-02';
  const itemKey = 'coding-problem:user_001:problem_001';
  const reservationToken = 'execution_001';
  const limit = 5;
  const ttlSeconds = 3_600;

  beforeEach(async () => {
    redisMocks.client.eval.mockReset();
    redisMocks.client.on.mockReset();
    redisMocks.client.disconnect.mockReset();
    redisMocks.client.ping.mockReset();

    const config = {
      get: vi.fn((key: string) => (key === 'REDIS_HOST' ? '127.0.0.1' : 6379)),
    };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
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
    [[1, 2], { allowed: true, count: 2 }],
    [[0, 5], { allowed: false, count: 5 }],
  ])('maps quota reservation result %j', async (result, expected) => {
    redisMocks.client.eval.mockResolvedValueOnce(result);

    await expect(service.reserveQuota(quotaKey, limit, ttlSeconds)).resolves.toEqual(expected);

    expect(redisMocks.client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      1,
      quotaKey,
      String(limit),
      String(ttlSeconds)
    );
  });

  it('rejects a malformed quota reservation result', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([1]);

    await expect(service.reserveQuota(quotaKey, limit, ttlSeconds)).rejects.toThrow(
      'Redis returned an invalid quota reservation result'
    );
  });

  it('atomically reserves estimated tokens against a daily token cap', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([1, 12_000]);

    await expect(
      service.reserveTokenQuota(quotaKey, `${quotaKey}:attempt_1`, 2_000, 20_000, ttlSeconds)
    ).resolves.toEqual({ allowed: true, count: 12_000 });
    expect(redisMocks.client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCRBY', KEYS[1], requested)"),
      2,
      quotaKey,
      `${quotaKey}:attempt_1`,
      '2000',
      '20000',
      String(ttlSeconds)
    );
  });

  it('denies token reservations that exceed the daily cap', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([0, 19_000]);
    await expect(
      service.reserveTokenQuota(quotaKey, `${quotaKey}:attempt_2`, 2_000, 20_000, ttlSeconds)
    ).resolves.toEqual({ allowed: false, count: 19_000 });
  });

  it('settles a reservation to actual token usage only once', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([1, 10_640]);
    await expect(
      service.settleTokenQuota(quotaKey, `${quotaKey}:attempt_1`, 640, ttlSeconds)
    ).resolves.toEqual({ settled: true, count: 10_640 });
    expect(redisMocks.client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCRBY', KEYS[1], actual - reserved)"),
      2,
      quotaKey,
      `${quotaKey}:attempt_1`,
      '640',
      String(ttlSeconds)
    );
  });

  it('treats an already settled token reservation as idempotent', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([2, 10_640]);
    await expect(
      service.settleTokenQuota(quotaKey, `${quotaKey}:attempt_1`, 640, ttlSeconds)
    ).resolves.toEqual({ settled: true, count: 10_640 });
  });

  it('rejects malformed token reservation and settlement responses', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([1]);
    await expect(
      service.reserveTokenQuota(quotaKey, `${quotaKey}:attempt_3`, 100, 1_000, ttlSeconds)
    ).rejects.toThrow('invalid token quota reservation result');
    redisMocks.client.eval.mockResolvedValueOnce('invalid');
    await expect(
      service.settleTokenQuota(quotaKey, `${quotaKey}:attempt_3`, 50, ttlSeconds)
    ).rejects.toThrow('invalid token quota settlement result');
  });

  it.each([
    [0, 100, 60],
    [100, 0, 60],
    [100, 100, 0],
  ])('rejects invalid weighted reservation parameters %j', async (tokens, limit, ttl) => {
    await expect(
      service.reserveTokenQuota(quotaKey, `${quotaKey}:invalid`, tokens, limit, ttl)
    ).rejects.toThrow('invalid token quota reservation parameters');
  });

  it('rejects out-of-range weighted reservation responses', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([3, 1]);
    await expect(
      service.reserveTokenQuota(quotaKey, `${quotaKey}:invalid`, 100, 1000, ttlSeconds)
    ).rejects.toThrow('invalid token quota reservation result');
    redisMocks.client.eval.mockResolvedValueOnce([1, -1]);
    await expect(
      service.reserveTokenQuota(quotaKey, `${quotaKey}:invalid`, 100, 1000, ttlSeconds)
    ).rejects.toThrow('invalid token quota reservation result');
  });

  it('rejects out-of-range settlement responses', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([3, 1]);
    await expect(
      service.settleTokenQuota(quotaKey, `${quotaKey}:invalid`, 100, ttlSeconds)
    ).rejects.toThrow('invalid token quota settlement result');
    redisMocks.client.eval.mockResolvedValueOnce([1, -1]);
    await expect(
      service.settleTokenQuota(quotaKey, `${quotaKey}:invalid`, 100, ttlSeconds)
    ).rejects.toThrow('invalid token quota settlement result');
  });

  it.each([
    [-1, 60],
    [0, 0],
  ])('rejects invalid weighted settlement parameters %j', async (tokens, ttl) => {
    await expect(
      service.settleTokenQuota(quotaKey, `${quotaKey}:invalid`, tokens, ttl)
    ).rejects.toThrow('invalid token quota settlement parameters');
  });

  it('releases quota, pings Redis, and disconnects on shutdown', async () => {
    redisMocks.client.eval.mockResolvedValueOnce(1);
    redisMocks.client.ping.mockResolvedValueOnce('PONG');

    await service.releaseQuota(quotaKey);
    await expect(service.ping()).resolves.toBe('PONG');
    service.onModuleDestroy();

    expect(redisMocks.client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('DECR', KEYS[1])"),
      1,
      quotaKey
    );
    expect(redisMocks.client.disconnect).toHaveBeenCalledOnce();
  });

  it('logs only the first Redis error until the client becomes ready again', () => {
    const onError = redisMocks.client.on.mock.calls.find(([event]) => event === 'error')?.[1] as (
      error: Error
    ) => void;
    const onReady = redisMocks.client.on.mock.calls.find(
      ([event]) => event === 'ready'
    )?.[1] as () => void;

    onError(new Error('first failure'));
    onError(new Error('repeated failure'));
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith({ error: 'first failure' }, 'Redis is unavailable');

    onReady();
    onError(new Error('failure after recovery'));
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it.each([
    [1, { status: 'reserved', count: 2 }],
    [2, { status: 'already_solved', count: 2 }],
    [3, { status: 'in_progress', count: 2 }],
    [0, { status: 'limit', count: 5 }],
  ])('maps Lua reservation response %i into its explicit outcome', async (luaStatus, expected) => {
    redisMocks.client.eval.mockResolvedValueOnce([luaStatus, expected.count]);

    await expect(
      service.reserveUniqueQuota(quotaKey, itemKey, limit, ttlSeconds, reservationToken)
    ).resolves.toEqual(expected);

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

  it('stores reservation ownership so a retry cannot finalize a newer reservation', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([1, 2]);

    await service.reserveUniqueQuota(quotaKey, itemKey, limit, ttlSeconds, reservationToken);

    const [reserveScript, , , , , , receivedToken] = redisMocks.client.eval.mock.calls[0];
    expect(reserveScript).toContain("'reserved:' .. ARGV[3]");
    expect(receivedToken).toBe(reservationToken);

    redisMocks.client.eval.mockResolvedValueOnce(0);
    await service.finalizeUniqueQuota(quotaKey, itemKey, 'release', ttlSeconds, 'older_execution');

    const [finalizeScript, , , , , , receivedFinalizeToken] = redisMocks.client.eval.mock.calls[1];
    expect(finalizeScript).toContain("'reserved:' .. ARGV[3]");
    expect(receivedFinalizeToken).toBe('older_execution');
  });

  it('rejects malformed Lua reservation results instead of granting a quota slot', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([1]);

    await expect(
      service.reserveUniqueQuota(quotaKey, itemKey, limit, ttlSeconds, reservationToken)
    ).rejects.toThrow('invalid unique quota reservation result');
  });

  it('rejects unknown Lua reservation statuses and invalid counters', async () => {
    redisMocks.client.eval.mockResolvedValueOnce([99, 2]);
    await expect(
      service.reserveUniqueQuota(quotaKey, itemKey, limit, ttlSeconds, reservationToken)
    ).rejects.toThrow('invalid unique quota reservation result');
    redisMocks.client.eval.mockResolvedValueOnce([1, Number.NaN]);
    await expect(
      service.reserveUniqueQuota(quotaKey, itemKey, limit, ttlSeconds, reservationToken)
    ).rejects.toThrow('invalid unique quota reservation result');
  });

  it.each(['solved', 'release'] as const)(
    'dispatches the %s finalization outcome to the atomic two-key Lua script',
    async (outcome) => {
      redisMocks.client.eval.mockResolvedValueOnce(1);

      await expect(
        service.finalizeUniqueQuota(quotaKey, itemKey, outcome, ttlSeconds, reservationToken)
      ).resolves.toBeUndefined();

      const [
        script,
        keyCount,
        receivedQuotaKey,
        receivedItemKey,
        receivedOutcome,
        receivedTtl,
        receivedToken,
      ] = redisMocks.client.eval.mock.calls[0];
      expect(script).toContain("'reserved:' .. ARGV[3]");
      expect(keyCount).toBe(2);
      expect(receivedQuotaKey).toBe(quotaKey);
      expect(receivedItemKey).toBe(itemKey);
      expect(receivedOutcome).toBe(outcome);
      expect(receivedTtl).toBe(String(ttlSeconds));
      expect(receivedToken).toBe(reservationToken);
    }
  );
});
