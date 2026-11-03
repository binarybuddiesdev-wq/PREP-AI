import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserService } from '../../src/modules/user/user.service.js';
import {
  connectIsolationTestDatabases,
  createIntegrationLogger,
  createTestUserPair,
  disconnectIsolationTestDatabases,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;

describe('MongoDB user data isolation', () => {
  let database: TDatabase | undefined;
  let users: Awaited<ReturnType<typeof createTestUserPair>> | undefined;
  let service: UserService;

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
    users = await createTestUserPair(database.mongo, 'user-data-isolation');
    service = new UserService(database.mongo, {} as never, createIntegrationLogger() as never);

    await Promise.all([
      service.upsertSettings(users.userA.clerkUserId, {
        preferences: { ownerMarker: 'user-a' },
      }),
      service.upsertSettings(users.userB.clerkUserId, {
        preferences: { ownerMarker: 'user-b' },
      }),
    ]);
  }, 30_000);

  afterAll(async () => {
    if (!database) return;
    if (users) {
      const userIds = [users.userA.id, users.userB.id];
      await database.mongo.userSettings.deleteMany({ where: { userId: { in: userIds } } });
      await database.mongo.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await disconnectIsolationTestDatabases(database);
  }, 30_000);

  it('reads each user’s settings through that user’s Clerk subject', async () => {
    const settingsA = await service.getSettings(users!.userA.clerkUserId);
    const settingsB = await service.getSettings(users!.userB.clerkUserId);

    expect(settingsA?.preferences).toEqual({ ownerMarker: 'user-a' });
    expect(settingsB?.preferences).toEqual({ ownerMarker: 'user-b' });
  });

  it('updates, completes setup, and deletes one user without changing the other user', async () => {
    const updatedUser = await service.updateUser(users!.userA.clerkUserId, {
      name: 'Updated Isolation User A',
    });
    const completedUser = await service.markSetupComplete(users!.userA.clerkUserId);

    expect(updatedUser?.name).toBe('Updated Isolation User A');
    expect(completedUser?.isNewUser).toBe(false);
    await expect(service.findByClerkId(users!.userB.clerkUserId)).resolves.toMatchObject({
      name: 'Isolation User B',
      isNewUser: true,
    });

    await service.deleteUser(users!.userA.clerkUserId);

    await expect(service.getSettings(users!.userA.clerkUserId)).resolves.toBeNull();
    await expect(service.findByClerkId(users!.userB.clerkUserId)).resolves.toMatchObject({
      clerkUserId: users!.userB.clerkUserId,
    });
    await expect(service.getSettings(users!.userB.clerkUserId)).resolves.toMatchObject({
      preferences: { ownerMarker: 'user-b' },
    });
  });
});
