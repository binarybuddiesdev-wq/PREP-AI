import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connectIsolationTestDatabases,
  disconnectIsolationTestDatabases,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;

describe('PostgreSQL row-level security', () => {
  let database: TDatabase | undefined;
  let userA: string;
  let userB: string;
  let sessionA: { id: string };
  let sessionB: { id: string };

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
    const fixtureId = randomUUID();
    userA = `rls-user-a-${fixtureId}`;
    userB = `rls-user-b-${fixtureId}`;
    [sessionA, sessionB] = await Promise.all([createSession(userA), createSession(userB)]);
  }, 30_000);

  async function createSession(userId: string) {
    return database!.postgresProvider.client_!.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      return tx.theorySession.create({
        data: {
          userId,
          mode: 'weak',
          difficulty: 'Junior',
          totalQuestions: 1,
        },
        select: { id: true },
      });
    });
  }

  afterAll(async () => {
    if (!database) return;
    await Promise.all([
      database.postgresProvider.client_!.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userA}, true)`;
        await tx.theorySession.deleteMany({ where: { userId: userA } });
      }),
      database.postgresProvider.client_!.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userB}, true)`;
        await tx.theorySession.deleteMany({ where: { userId: userB } });
      }),
    ]);
    await disconnectIsolationTestDatabases(database);
  }, 30_000);

  it('connects with a non-superuser role that does not bypass RLS', async () => {
    const role = await database!.postgresProvider.client_!.$queryRaw<
      Array<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>
    >`SELECT current_user, rolsuper, rolbypassrls
      FROM pg_roles WHERE rolname = current_user`;

    expect(role).toEqual([{ current_user: 'prepai_api', rolsuper: false, rolbypassrls: false }]);
  });

  it('keeps the worker role non-privileged and denies tenant rows without a job context', async () => {
    const worker = database!.worker;
    const role = await worker.$queryRaw<
      Array<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>
    >`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;

    expect(role).toEqual([{ current_user: 'prepai_worker', rolsuper: false, rolbypassrls: false }]);
    await expect(worker.theorySession.findMany({ where: { id: sessionA.id } })).resolves.toEqual(
      []
    );
    await expect(
      database!.postgresProvider.withWorkerJobContext('worker-test-job', async (transaction) => {
        await database!.postgresProvider.setTenantContext(transaction, userA);
        return transaction.theorySession.findMany({ where: { id: sessionA.id } });
      })
    ).resolves.toMatchObject([{ id: sessionA.id, userId: userA }]);
  });

  it('hides tenant rows without context and limits reads and writes to the current tenant', async () => {
    const client = database!.postgresProvider.client_!;

    await expect(client.theorySession.findMany({ where: { id: sessionA.id } })).resolves.toEqual(
      []
    );
    await expect(
      client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userA}, true)`;
        return tx.theorySession.findMany({ orderBy: { id: 'asc' } });
      })
    ).resolves.toMatchObject([{ id: sessionA.id, userId: userA }]);
    await expect(
      client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userA}, true)`;
        return tx.theorySession.create({
          data: {
            userId: userB,
            mode: 'weak',
            difficulty: 'Junior',
            totalQuestions: 1,
          },
        });
      })
    ).rejects.toThrow();
    await expect(client.theorySession.findUnique({ where: { id: sessionB.id } })).resolves.toBe(
      null
    );
  });

  it('clears user context after rollback before the pooled connection is reused', async () => {
    const client = database!.postgresProvider.client_!;

    await expect(
      client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userA}, true)`;
        await tx.theorySession.findMany({ where: { id: sessionA.id } });
        throw new Error('rollback the context transaction');
      })
    ).rejects.toThrow('rollback the context transaction');

    await expect(client.theorySession.findMany({ where: { id: sessionA.id } })).resolves.toEqual(
      []
    );
  });
});
