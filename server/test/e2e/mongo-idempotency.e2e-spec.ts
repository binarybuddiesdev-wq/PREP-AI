import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executeMongoIdempotently } from '../../src/common/idempotency/mongo-idempotency.js';
import { createIdempotencyOperationId } from '../../src/common/idempotency/idempotency.js';
import {
  connectIsolationTestDatabases,
  disconnectIsolationTestDatabases,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;

describe('MongoDB create idempotency', () => {
  let database: TDatabase | undefined;

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
  }, 30_000);

  afterAll(async () => {
    if (database) await disconnectIsolationTestDatabases(database);
  }, 30_000);

  it('replays the original JSON response after a resource is later edited', async () => {
    const mongo = database!.mongo;
    const suffix = randomUUID();
    const input = {
      actorId: `admin-${suffix}`,
      scope: 'topic-create',
      key: 'create-topic-once',
      payload: { name: 'Original name', slug: `idem-${suffix}`, category: 'practice' },
    };
    const operationId = createIdempotencyOperationId(input.actorId, input.scope, input.key);
    let topicId: string | undefined;

    try {
      const first = await executeMongoIdempotently(mongo, input, (transaction) =>
        transaction.topic.create({ data: input.payload })
      );
      topicId = first.id;
      await mongo.topic.update({ where: { id: topicId }, data: { name: 'Edited name' } });

      const replay = await executeMongoIdempotently(mongo, input, (transaction) =>
        transaction.topic.create({ data: input.payload })
      );

      expect(replay).toEqual(first);
      expect(replay.name).toBe('Original name');
      await expect(mongo.topic.findUnique({ where: { id: topicId } })).resolves.toMatchObject({
        name: 'Edited name',
      });
    } finally {
      await mongo.idempotencyOperation.deleteMany({ where: { operationId } });
      if (topicId) await mongo.topic.deleteMany({ where: { id: topicId } });
    }
  });

  it('commits one resource for concurrent requests using the same key', async () => {
    const mongo = database!.mongo;
    const suffix = randomUUID();
    const input = {
      actorId: `admin-${suffix}`,
      scope: 'topic-create',
      key: 'concurrent-topic-create',
      payload: { name: 'Concurrent topic', slug: `idem-race-${suffix}`, category: 'practice' },
    };
    const operationId = createIdempotencyOperationId(input.actorId, input.scope, input.key);
    let topicId: string | undefined;

    try {
      const create = (transaction: Prisma.TransactionClient) =>
        transaction.topic.create({ data: input.payload });
      const [first, second] = await Promise.all([
        executeMongoIdempotently(mongo, input, create),
        executeMongoIdempotently(mongo, input, create),
      ]);
      topicId = first.id;

      expect(second).toEqual(first);
      await expect(mongo.topic.count({ where: { slug: input.payload.slug } })).resolves.toBe(1);
    } finally {
      await mongo.idempotencyOperation.deleteMany({ where: { operationId } });
      if (topicId) await mongo.topic.deleteMany({ where: { id: topicId } });
    }
  });

  it('rolls back a resource write when the idempotency transaction fails', async () => {
    const mongo = database!.mongo;
    const suffix = randomUUID();
    const input = {
      actorId: `admin-${suffix}`,
      scope: 'topic-create',
      key: 'transaction-rollback',
      payload: { name: 'Rolled back topic', slug: `idem-rollback-${suffix}`, category: 'practice' },
    };
    const operationId = createIdempotencyOperationId(input.actorId, input.scope, input.key);
    let topicId: string | undefined;

    try {
      await expect(
        executeMongoIdempotently(mongo, input, async (transaction) => {
          const topic = await transaction.topic.create({ data: input.payload });
          topicId = topic.id;
          throw new Error('force operation transaction rollback');
        })
      ).rejects.toThrow('force operation transaction rollback');

      if (topicId) {
        await expect(mongo.topic.findUnique({ where: { id: topicId } })).resolves.toBeNull();
      }
      await expect(
        mongo.idempotencyOperation.findUnique({ where: { operationId } })
      ).resolves.toBeNull();
    } finally {
      await mongo.idempotencyOperation.deleteMany({ where: { operationId } });
      if (topicId) await mongo.topic.deleteMany({ where: { id: topicId } });
    }
  });
});
