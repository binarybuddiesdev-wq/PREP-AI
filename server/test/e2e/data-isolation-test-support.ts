import { randomUUID } from 'node:crypto';
import { PrismaPostgresqlService, PrismaService } from '../../src/prisma/prisma.service.js';

export interface IIsolationTestDatabase {
  mongo: PrismaService;
  postgresProvider: PrismaPostgresqlService;
  postgres: NonNullable<PrismaPostgresqlService['client_']>;
}

export function createIntegrationLogger() {
  const discardLog = () => undefined;
  return { info: discardLog, warn: discardLog, error: discardLog };
}

export async function connectIsolationTestDatabases(): Promise<IIsolationTestDatabase> {
  assertTestDatabaseUrl('DATABASE_URL', '27018');
  assertTestDatabaseUrl('POSTGRESQL_URL', '5433');

  const mongo = new PrismaService();
  const postgresProvider = new PrismaPostgresqlService();
  try {
    await Promise.all([mongo.onModuleInit(), postgresProvider.onModuleInit()]);
    const postgres = postgresProvider.client_;
    if (!postgres) throw new Error('PostgreSQL test database did not connect');
    await Promise.all([mongo.user.count(), postgres.theorySession.count()]);
    return { mongo, postgresProvider, postgres };
  } catch (error) {
    await Promise.allSettled([mongo.onModuleDestroy(), postgresProvider.onModuleDestroy()]);
    throw error;
  }
}

export async function disconnectIsolationTestDatabases(database: IIsolationTestDatabase) {
  await Promise.all([
    database.mongo.onModuleDestroy(),
    database.postgresProvider.onModuleDestroy(),
  ]);
}

export async function createTestUserPair(mongo: PrismaService, namespace: string) {
  const fixtureId = randomUUID();
  const [userA, userB] = await Promise.all([
    mongo.user.create({
      data: {
        clerkUserId: `${namespace}-a-${fixtureId}`,
        email: `${namespace}-a-${fixtureId}@test.invalid`,
        name: 'Isolation User A',
        role: 'USER',
        isNewUser: true,
      },
    }),
    mongo.user.create({
      data: {
        clerkUserId: `${namespace}-b-${fixtureId}`,
        email: `${namespace}-b-${fixtureId}@test.invalid`,
        name: 'Isolation User B',
        role: 'USER',
        isNewUser: true,
      },
    }),
  ]);
  return { userA, userB };
}

function assertTestDatabaseUrl(name: string, expectedPort: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set by the isolated database test runner`);

  const url = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== expectedPort) {
    throw new Error(`${name} must use loopback port ${expectedPort}; refusing unsafe database URL`);
  }
  if (url.pathname !== '/prepai_data_isolation_test') {
    throw new Error(`${name} must target the prepai_data_isolation_test database`);
  }
}
