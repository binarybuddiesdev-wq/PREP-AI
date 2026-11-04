import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connectIsolationTestDatabases,
  disconnectIsolationTestDatabases,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;

describe('PostgreSQL RLS runtime readiness', () => {
  let database: TDatabase | undefined;

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
  }, 30_000);

  afterAll(async () => {
    if (database) await disconnectIsolationTestDatabases(database);
  }, 30_000);

  it('accepts the restricted runtime roles and complete RLS policy installation', async () => {
    await expect(database!.postgresProvider.assertProductionRlsReady()).resolves.toBeUndefined();
  });
});
