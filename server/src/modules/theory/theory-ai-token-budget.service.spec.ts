import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@/prisma/prisma.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { TheoryAiTokenBudgetService } from './theory-ai-token-budget.service.js';

describe('TheoryAiTokenBudgetService', () => {
  const reserveTokenQuota = vi.fn();
  const settleTokenQuota = vi.fn();
  const userFindUnique = vi.fn();
  let service: TheoryAiTokenBudgetService;

  beforeEach(() => {
    vi.clearAllMocks();
    reserveTokenQuota.mockResolvedValue({ allowed: true, count: 1200 });
    settleTokenQuota.mockResolvedValue({ settled: true, count: 640 });
    userFindUnique.mockResolvedValue({ role: 'USER' });
    service = new TheoryAiTokenBudgetService(
      { user: { findUnique: userFindUnique } } as unknown as PrismaService,
      { reserveTokenQuota, settleTokenQuota } as unknown as RedisService,
      { get: vi.fn(() => undefined) } as unknown as ConfigService
    );
  });

  it('reserves against the user’s UTC-day role budget before provider calls', async () => {
    await expect(
      service.reserve('user_001', 'attempt_1', 1200, new Date('2026-11-02T23:59:00.000Z'))
    ).resolves.toMatchObject({
      allowed: true,
      quotaKey: 'quota:user_001:2026-11-02:ai_tokens',
      reservationKey: 'quota:user_001:2026-11-02:ai_tokens:reservation:attempt_1',
      ttlSeconds: 60,
    });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_001' },
      select: { role: true },
    });
    expect(reserveTokenQuota).toHaveBeenCalledWith(
      'quota:user_001:2026-11-02:ai_tokens',
      'quota:user_001:2026-11-02:ai_tokens:reservation:attempt_1',
      1200,
      400_000,
      60
    );
  });

  it('uses the configured premium budget for premium users', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'PREMIUM' });
    const premium = new TheoryAiTokenBudgetService(
      { user: { findUnique: userFindUnique } } as unknown as PrismaService,
      { reserveTokenQuota, settleTokenQuota } as unknown as RedisService,
      {
        get: vi.fn((key: string) => (key === 'AI_DAILY_TOKENS_PREMIUM' ? 900_000 : undefined)),
      } as unknown as ConfigService
    );
    await premium.reserve('user_001', 'attempt_2', 1000, new Date('2026-11-02T12:00:00.000Z'));
    expect(reserveTokenQuota).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      1000,
      900_000,
      expect.any(Number)
    );
  });

  it('applies the least-privileged budget when the Mongo account is missing', async () => {
    userFindUnique.mockResolvedValueOnce(null);
    await service.reserve('user_001', 'attempt_orphan', 1000, new Date('2026-11-02T12:00:00.000Z'));
    expect(reserveTokenQuota).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      1000,
      400_000,
      expect.any(Number)
    );
  });

  it('settles actual provider usage against the original day reservation', async () => {
    const reservation = await service.reserve(
      'user_001',
      'attempt_3',
      1200,
      new Date('2026-11-02T23:59:00.000Z')
    );
    await service.settle(reservation, 640);
    expect(settleTokenQuota).toHaveBeenCalledWith(
      reservation.quotaKey,
      reservation.reservationKey,
      640,
      reservation.ttlSeconds
    );
  });

  it('propagates Mongo or Redis errors so evaluation can fail closed', async () => {
    userFindUnique.mockRejectedValueOnce(new Error('Mongo unavailable'));
    await expect(service.reserve('user_001', 'attempt_4', 1000)).rejects.toThrow(
      'Mongo unavailable'
    );
    userFindUnique.mockResolvedValueOnce({ role: 'USER' });
    reserveTokenQuota.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(service.reserve('user_001', 'attempt_5', 1000)).rejects.toThrow(
      'Redis unavailable'
    );
  });
});
