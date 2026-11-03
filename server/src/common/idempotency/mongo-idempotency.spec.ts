import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { executeMongoIdempotently } from './mongo-idempotency.js';
import {
  createIdempotencyOperationId,
  createIdempotencyRequestFingerprint,
} from './idempotency.js';

function createIdempotencyDatabase() {
  const records = new Map<
    string,
    { operationId: string; requestFingerprint: string; response: unknown; expiresAt: Date }
  >();
  let transactionTail = Promise.resolve();
  const transactionClient = {
    idempotencyOperation: {
      findUnique: vi.fn(async ({ where }: { where: { operationId: string } }) =>
        records.get(where.operationId)
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: (typeof records extends Map<string, infer T> ? T : never) & {
            id?: string;
            createdAt?: Date;
          };
        }) => {
          if (records.has(data.operationId)) throw { code: 'P2002' };
          records.set(data.operationId, data);
          return data;
        }
      ),
      deleteMany: vi.fn(async ({ where }: { where: { operationId: string } }) => {
        const existed = records.delete(where.operationId);
        return { count: existed ? 1 : 0 };
      }),
    },
  };
  const prisma = {
    idempotencyOperation: transactionClient.idempotencyOperation,
    $transaction: vi.fn(<T>(operation: (tx: typeof transactionClient) => Promise<T>) => {
      const result = transactionTail.then(() => operation(transactionClient));
      transactionTail = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    }),
  } as unknown as PrismaClient;

  return { prisma, records, transactionClient };
}

describe('executeMongoIdempotently', () => {
  it('persists and replays the original response without rerunning the create', async () => {
    const { prisma } = createIdempotencyDatabase();
    const create = vi.fn(async () => ({
      id: 'topic-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }));
    const input = {
      actorId: 'clerk-admin-1',
      scope: 'topic-create',
      key: 'request-1',
      payload: { slug: 'react', name: 'React' },
    };

    const first = await executeMongoIdempotently(prisma, input, create);
    const replay = await executeMongoIdempotently(prisma, input, create);

    expect(first).toEqual({ id: 'topic-1', createdAt: '2026-01-01T00:00:00.000Z' });
    expect(replay).toEqual(first);
    expect(create).toHaveBeenCalledOnce();
  });

  it('rejects reuse of a key with a different request payload', async () => {
    const { prisma } = createIdempotencyDatabase();
    const create = vi.fn(async () => ({ id: 'topic-1' }));

    await executeMongoIdempotently(
      prisma,
      {
        actorId: 'clerk-admin-1',
        scope: 'topic-create',
        key: 'request-1',
        payload: { slug: 'react' },
      },
      create
    );

    await expect(
      executeMongoIdempotently(
        prisma,
        {
          actorId: 'clerk-admin-1',
          scope: 'topic-create',
          key: 'request-1',
          payload: { slug: 'vue' },
        },
        create
      )
    ).rejects.toBeInstanceOf(ConflictException);
    expect(create).toHaveBeenCalledOnce();
  });

  it('creates only one resource for concurrent requests with the same key', async () => {
    const { prisma } = createIdempotencyDatabase();
    const create = vi.fn(async () => ({ id: 'question-1' }));
    const input = {
      actorId: 'clerk-admin-1',
      scope: 'question-create',
      key: 'request-1',
      payload: { question: 'What is JSX?' },
    };

    const [first, second] = await Promise.all([
      executeMongoIdempotently(prisma, input, create),
      executeMongoIdempotently(prisma, input, create),
    ]);

    expect(first).toEqual({ id: 'question-1' });
    expect(second).toEqual(first);
    expect(create).toHaveBeenCalledOnce();
  });

  it('does not save an operation when the resource transaction fails', async () => {
    const { prisma, records } = createIdempotencyDatabase();

    await expect(
      executeMongoIdempotently(
        prisma,
        {
          actorId: 'clerk-admin-1',
          scope: 'topic-create',
          key: 'request-1',
          payload: { slug: 'react' },
        },
        async () => {
          throw new Error('database write failed');
        }
      )
    ).rejects.toThrow('database write failed');

    expect(records.size).toBe(0);
  });

  it('allows a new operation after the 24-hour replay window expires', async () => {
    const { prisma, records } = createIdempotencyDatabase();
    const input = {
      actorId: 'clerk-admin-1',
      scope: 'topic-create',
      key: 'request-expired',
      payload: { slug: 'react' },
    };
    const operationId = createIdempotencyOperationId(input.actorId, input.scope, input.key);
    records.set(operationId, {
      operationId,
      requestFingerprint: createIdempotencyRequestFingerprint(input.scope, input.payload),
      response: { id: 'expired-topic' },
      expiresAt: new Date(Date.now() - 1_000),
    });
    const create = vi.fn(async () => ({ id: 'new-topic' }));

    const result = await executeMongoIdempotently(prisma, input, create);

    expect(result).toEqual({ id: 'new-topic' });
    expect(create).toHaveBeenCalledOnce();
    expect(records.get(operationId)?.response).toEqual({ id: 'new-topic' });
  });

  it('removes an expired record found inside the transaction before creating again', async () => {
    const { prisma, records, transactionClient } = createIdempotencyDatabase();
    const input = {
      actorId: 'clerk-admin-1',
      scope: 'topic-create',
      key: 'request-expired-in-transaction',
      payload: { slug: 'react' },
    };
    const operationId = createIdempotencyOperationId(input.actorId, input.scope, input.key);
    const expired = {
      operationId,
      requestFingerprint: createIdempotencyRequestFingerprint(input.scope, input.payload),
      response: { id: 'expired-topic' },
      expiresAt: new Date(Date.now() - 1_000),
    };
    const findUnique = transactionClient.idempotencyOperation.findUnique as ReturnType<
      typeof vi.fn
    >;
    findUnique.mockResolvedValueOnce(undefined).mockResolvedValueOnce(expired);
    const create = vi.fn(async () => ({ id: 'new-topic' }));

    await expect(executeMongoIdempotently(prisma, input, create)).resolves.toEqual({
      id: 'new-topic',
    });

    expect(transactionClient.idempotencyOperation.deleteMany).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(records.get(operationId)?.response).toEqual({ id: 'new-topic' });
  });

  it('replays a response committed by a concurrent transaction after a write conflict', async () => {
    const { prisma, transactionClient } = createIdempotencyDatabase();
    const input = {
      actorId: 'clerk-admin-1',
      scope: 'topic-create',
      key: 'request-raced',
      payload: { slug: 'react' },
    };
    const committed = {
      operationId: createIdempotencyOperationId(input.actorId, input.scope, input.key),
      requestFingerprint: createIdempotencyRequestFingerprint(input.scope, input.payload),
      response: { id: 'committed-topic' },
      expiresAt: new Date(Date.now() + 60_000),
    };
    const outerFindUnique = prisma.idempotencyOperation.findUnique as ReturnType<typeof vi.fn>;
    outerFindUnique.mockResolvedValueOnce(undefined).mockResolvedValueOnce(committed);
    const transactionalFindUnique = transactionClient.idempotencyOperation.findUnique as ReturnType<
      typeof vi.fn
    >;
    transactionalFindUnique.mockResolvedValueOnce(undefined);
    const transaction = prisma.$transaction as ReturnType<typeof vi.fn>;
    transaction.mockImplementationOnce(async () => {
      throw new Error('duplicate concurrent write');
    });
    const create = vi.fn(async () => ({ id: 'uncommitted-topic' }));

    await expect(executeMongoIdempotently(prisma, input, create)).resolves.toEqual({
      id: 'committed-topic',
    });
    expect(create).not.toHaveBeenCalled();
  });
});
