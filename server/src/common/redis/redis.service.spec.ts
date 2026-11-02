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
