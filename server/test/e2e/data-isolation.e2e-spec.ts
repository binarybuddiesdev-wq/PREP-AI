import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { TheoryService } from '../../src/modules/theory/theory.service.js';
import { CodingService } from '../../src/modules/coding/coding.service.js';
import { UserService } from '../../src/modules/user/user.service.js';
import { PrismaPostgresqlService, PrismaService } from '../../src/prisma/prisma.service.js';

function requiredTestDatabaseUrl(name: string, expectedPort: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set by the isolated database test runner`);

  const url = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== expectedPort) {
    throw new Error(`${name} must use loopback port ${expectedPort}; refusing unsafe database URL`);
  }
  if (url.pathname !== '/prepai_data_isolation_test') {
    throw new Error(`${name} must target the prepai_data_isolation_test database`);
  }

  return value;
}

requiredTestDatabaseUrl('DATABASE_URL', '27018');
requiredTestDatabaseUrl('POSTGRESQL_URL', '5433');
const mongo = new PrismaService();
const postgresProvider = new PrismaPostgresqlService();
const logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const userService = new UserService(mongo as never, {} as never, logger as never);
const theoryService = new TheoryService(
  mongo as never,
  postgresProvider,
  {} as never,
  {} as never,
  {} as never,
  logger as never
);
const codingService = new CodingService(
  mongo as never,
  postgresProvider,
  {} as never,
  {} as never,
  {} as never,
  logger as never
);

const testId = randomUUID();
const userA = { clerkUserId: `isolation-a-${testId}`, email: `isolation-a-${testId}@test.invalid` };
const userB = { clerkUserId: `isolation-b-${testId}`, email: `isolation-b-${testId}@test.invalid` };
const theorySessionIds = [randomUUID(), randomUUID()];
const codingSessionIds = [randomUUID(), randomUUID()];
let mongoUserIds: string[] = [];

describe('real database data isolation', () => {
  beforeAll(async () => {
    await Promise.all([mongo.onModuleInit(), postgresProvider.onModuleInit()]);
    const postgres = postgresProvider.client_;
    if (!postgres) throw new Error('PostgreSQL test database did not connect');
    await Promise.all([mongo.user.count(), postgres.theorySession.count()]);

    const [createdUserA, createdUserB] = await Promise.all([
      mongo.user.create({
        data: { ...userA, name: 'Isolation User A', role: 'USER', isNewUser: false },
      }),
      mongo.user.create({
        data: { ...userB, name: 'Isolation User B', role: 'USER', isNewUser: false },
      }),
    ]);
    mongoUserIds = [createdUserA.id, createdUserB.id];

    await Promise.all([
      mongo.userSettings.create({
        data: { userId: createdUserA.id, preferences: { ownerMarker: 'user-a' } },
      }),
      mongo.userSettings.create({
        data: { userId: createdUserB.id, preferences: { ownerMarker: 'user-b' } },
      }),
      postgres.theorySession.create({
        data: {
          id: theorySessionIds[0],
          userId: userA.clerkUserId,
          mode: 'weak',
          difficulty: 'Junior',
          totalQuestions: 1,
        },
      }),
      postgres.theorySession.create({
        data: {
          id: theorySessionIds[1],
          userId: userB.clerkUserId,
          mode: 'weak',
          difficulty: 'Junior',
          totalQuestions: 1,
        },
      }),
      postgres.codingSession.create({
        data: { id: codingSessionIds[0], userId: userA.clerkUserId },
      }),
      postgres.codingSession.create({
        data: { id: codingSessionIds[1], userId: userB.clerkUserId },
      }),
    ]);
  }, 30_000);

  afterAll(async () => {
    if (mongoUserIds.length) {
      await mongo.userSettings.deleteMany({ where: { userId: { in: mongoUserIds } } });
      await mongo.user.deleteMany({ where: { id: { in: mongoUserIds } } });
    }
    const postgres = postgresProvider.client_;
    if (postgres) {
      await Promise.all([
        postgres.theorySession.deleteMany({ where: { id: { in: theorySessionIds } } }),
        postgres.codingSession.deleteMany({ where: { id: { in: codingSessionIds } } }),
      ]);
    }
    await Promise.all([mongo.onModuleDestroy(), postgresProvider.onModuleDestroy()]);
  }, 30_000);

  it('returns settings belonging to the Clerk subject and keeps the other user separate', async () => {
    const settingsA = await userService.getSettings(userA.clerkUserId);
    const settingsB = await userService.getSettings(userB.clerkUserId);

    expect(settingsA?.preferences).toEqual({ ownerMarker: 'user-a' });
    expect(settingsB?.preferences).toEqual({ ownerMarker: 'user-b' });
  });

  it('returns only the caller-owned theory session', async () => {
    await expect(
      theoryService.getSessionDetail(theorySessionIds[0]!, userA.clerkUserId)
    ).resolves.toMatchObject({
      id: theorySessionIds[0],
      userId: userA.clerkUserId,
    });
    await expect(
      theoryService.getSessionDetail(theorySessionIds[1]!, userA.clerkUserId)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns only the caller-owned coding session', async () => {
    await expect(
      codingService.getSessionDetail(codingSessionIds[0]!, userA.clerkUserId)
    ).resolves.toMatchObject({
      id: codingSessionIds[0],
      userId: userA.clerkUserId,
    });
    await expect(
      codingService.getSessionDetail(codingSessionIds[1]!, userA.clerkUserId)
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
