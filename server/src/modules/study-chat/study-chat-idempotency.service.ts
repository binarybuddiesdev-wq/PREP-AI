import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service.js';
import { createIdempotencyOperationId, requireIdempotencyKey } from '@/common/idempotency/index.js';

const OPERATION_LEASE_MS = 5 * 60 * 1_000;
const OPERATION_PROCESSING = 'PROCESSING';
const OPERATION_COMPLETED = 'COMPLETED';
const KEY_REUSE_ERROR = 'Idempotency-Key was already used with a different request';
const OPERATION_ACTIVE_ERROR = 'An identical request is still processing';

export interface StudyChatOperationInput {
  clerkUserId: string;
  userId: string;
  scope: string;
  key: string;
  requestFingerprint: string;
  conversationId?: string;
}

export interface StudyChatOperationClaim {
  userId: string;
  operationId: string;
  leaseToken: string;
}

export type StudyChatOperationClaimResult =
  | { kind: 'claimed'; claim: StudyChatOperationClaim }
  | { kind: 'replay'; response: Prisma.JsonValue };

@Injectable()
export class StudyChatIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async claim(
    input: StudyChatOperationInput,
    now = new Date()
  ): Promise<StudyChatOperationClaimResult> {
    const key = requireIdempotencyKey(input.key);
    const operationId = createIdempotencyOperationId(input.clerkUserId, input.scope, key);
    const existing = await this.prisma.studyChatOperation.findUnique({
      where: { userId_operationId: { userId: input.userId, operationId } },
    });
    if (existing) return this.claimExisting(existing, input, operationId, now);

    const leaseToken = randomUUID();
    try {
      await this.prisma.studyChatOperation.create({
        data: {
          userId: input.userId,
          operationId,
          scope: input.scope,
          requestFingerprint: input.requestFingerprint,
          status: OPERATION_PROCESSING,
          leaseToken,
          leaseExpiresAt: new Date(now.getTime() + OPERATION_LEASE_MS),
          ...(input.conversationId ? { conversationId: input.conversationId } : {}),
        },
      });
      return { kind: 'claimed', claim: { userId: input.userId, operationId, leaseToken } };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const concurrent = await this.prisma.studyChatOperation.findUnique({
        where: { userId_operationId: { userId: input.userId, operationId } },
      });
      if (!concurrent) throw error;
      return this.claimExisting(concurrent, input, operationId, now);
    }
  }

  async complete(claim: StudyChatOperationClaim, response: Prisma.InputJsonValue): Promise<void> {
    const result = await this.prisma.studyChatOperation.updateMany({
      where: {
        userId: claim.userId,
        operationId: claim.operationId,
        status: OPERATION_PROCESSING,
        leaseToken: claim.leaseToken,
      },
      data: { status: OPERATION_COMPLETED, response },
    });
    if (!result.count) throw new ConflictException(OPERATION_ACTIVE_ERROR);
  }

  async renew(claim: StudyChatOperationClaim, now = new Date()): Promise<void> {
    const result = await this.prisma.studyChatOperation.updateMany({
      where: {
        userId: claim.userId,
        operationId: claim.operationId,
        status: OPERATION_PROCESSING,
        leaseToken: claim.leaseToken,
      },
      data: { leaseExpiresAt: new Date(now.getTime() + OPERATION_LEASE_MS) },
    });
    if (!result.count) throw new ConflictException(OPERATION_ACTIVE_ERROR);
  }

  async release(claim: StudyChatOperationClaim): Promise<void> {
    await this.prisma.studyChatOperation.deleteMany({
      where: {
        userId: claim.userId,
        operationId: claim.operationId,
        status: OPERATION_PROCESSING,
        leaseToken: claim.leaseToken,
      },
    });
  }

  async deleteForConversation(userId: string, conversationId: string): Promise<void> {
    await this.prisma.studyChatOperation.deleteMany({
      where: { userId, conversationId },
    });
  }

  private async claimExisting(
    existing: Prisma.StudyChatOperationGetPayload<object>,
    input: StudyChatOperationInput,
    operationId: string,
    now: Date
  ): Promise<StudyChatOperationClaimResult> {
    if (
      existing.scope !== input.scope ||
      existing.requestFingerprint !== input.requestFingerprint
    ) {
      throw new ConflictException(KEY_REUSE_ERROR);
    }
    if (existing.status === OPERATION_COMPLETED) {
      if (existing.response === null) {
        throw new ServiceUnavailableException(
          'Completed Study Chat operation has no saved response'
        );
      }
      return { kind: 'replay', response: existing.response };
    }
    if (existing.leaseExpiresAt > now) throw new ConflictException(OPERATION_ACTIVE_ERROR);

    const leaseToken = randomUUID();
    const result = await this.prisma.studyChatOperation.updateMany({
      where: {
        id: existing.id,
        userId: input.userId,
        status: OPERATION_PROCESSING,
        leaseToken: existing.leaseToken,
        leaseExpiresAt: { lte: now },
      },
      data: { leaseToken, leaseExpiresAt: new Date(now.getTime() + OPERATION_LEASE_MS) },
    });
    if (!result.count) throw new ConflictException(OPERATION_ACTIVE_ERROR);
    return { kind: 'claimed', claim: { userId: input.userId, operationId, leaseToken } };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
