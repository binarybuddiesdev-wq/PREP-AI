import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { getAiTokenBudgetLimit } from '@/common/utils/role-limits.js';

export interface TheoryAiTokenReservation {
  allowed: boolean;
  count: number;
  quotaKey: string;
  reservationKey: string;
  ttlSeconds: number;
}

@Injectable()
export class TheoryAiTokenBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService
  ) {}

  async reserve(
    userId: string,
    reservationId: string,
    estimatedTokens: number,
    now = new Date()
  ): Promise<TheoryAiTokenReservation> {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });
    const role = user?.role ?? 'USER';
    const utcDay = now.toISOString().slice(0, 10);
    const utcMidnight = new Date(`${utcDay}T00:00:00.000Z`).getTime();
    const ttlSeconds = Math.max(1, Math.ceil((utcMidnight + 86_400_000 - now.getTime()) / 1000));
    const quotaKey = `quota:${userId}:${utcDay}:ai_tokens`;
    const reservationKey = `${quotaKey}:reservation:${reservationId}`;
    const reservation = await this.redis.reserveTokenQuota(
      quotaKey,
      reservationKey,
      estimatedTokens,
      getAiTokenBudgetLimit(role, this.config),
      ttlSeconds
    );
    return { ...reservation, quotaKey, reservationKey, ttlSeconds };
  }

  async settle(reservation: TheoryAiTokenReservation, actualTokens: number): Promise<void> {
    await this.redis.settleTokenQuota(
      reservation.quotaKey,
      reservation.reservationKey,
      actualTokens,
      reservation.ttlSeconds
    );
  }
}
