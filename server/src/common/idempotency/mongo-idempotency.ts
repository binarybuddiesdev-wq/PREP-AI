import { ConflictException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  createIdempotencyOperationId,
  createIdempotencyRequestFingerprint,
  requireIdempotencyKey,
} from './idempotency.js';

interface IMongoIdempotencyInput {
  actorId: string;
  scope: string;
  key: string;
  payload: unknown;
}

type TIdempotencyOperation = Prisma.IdempotencyOperationGetPayload<object>;
const IDEMPOTENCY_REPLAY_WINDOW_MS = 24 * 60 * 60 * 1_000;

export async function executeMongoIdempotently<T extends object>(
  prisma: PrismaClient,
  input: IMongoIdempotencyInput,
  create: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const key = requireIdempotencyKey(input.key);
  const operationId = createIdempotencyOperationId(input.actorId, input.scope, key);
  const requestFingerprint = createIdempotencyRequestFingerprint(input.scope, input.payload);
  const where = { operationId };
  const existing = await prisma.idempotencyOperation.findUnique({ where });
  if (existing && existing.expiresAt.getTime() > Date.now()) {
    return replay<T>(existing, requestFingerprint);
  }
  if (existing) {
    await prisma.idempotencyOperation.deleteMany({
      where: { operationId, expiresAt: { lte: new Date() } },
    });
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const concurrent = await transaction.idempotencyOperation.findUnique({ where });
      if (concurrent && concurrent.expiresAt.getTime() > Date.now()) {
        return replay<T>(concurrent, requestFingerprint);
      }
      if (concurrent) {
        await transaction.idempotencyOperation.deleteMany({
          where: { operationId, expiresAt: { lte: new Date() } },
        });
      }

      const response = await create(transaction);
      const responseSnapshot = JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue;
      await transaction.idempotencyOperation.create({
        data: {
          operationId,
          requestFingerprint,
          response: responseSnapshot,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_REPLAY_WINDOW_MS),
        },
      });
      return responseSnapshot as T;
    });
  } catch (error) {
    const committed = await prisma.idempotencyOperation.findUnique({ where }).catch(() => null);
    if (committed && committed.expiresAt.getTime() > Date.now()) {
      return replay<T>(committed, requestFingerprint);
    }
    throw error;
  }
}

function replay<T>(operation: TIdempotencyOperation, requestFingerprint: string): T {
  if (operation.requestFingerprint !== requestFingerprint) {
    throw new ConflictException('Idempotency-Key was already used with a different request');
  }
  return operation.response as T;
}
