import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../src/modules/user/user.service.js';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import { StudyChatService } from '../../src/modules/study-chat/study-chat.service.js';
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
  let notifications: NotificationsService;
  let studyChat: StudyChatService;

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
    users = await createTestUserPair(database.mongo, 'user-data-isolation');
    service = new UserService(database.mongo, {} as never, createIntegrationLogger() as never);
    notifications = new NotificationsService(
      database.mongo,
      {} as never,
      { get: vi.fn(() => undefined) } as never,
      createIntegrationLogger() as never,
      null
    );
    studyChat = new StudyChatService(
      database.mongo,
      { generateReply: vi.fn().mockResolvedValue('A study coach response.') } as never,
      createIntegrationLogger() as never
    );

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
      await database.mongo.studyChatConversation.deleteMany({ where: { userId: { in: userIds } } });
      await database.mongo.inAppNotification.deleteMany({ where: { userId: { in: userIds } } });
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

  it('persists reminder preferences only on the setting owner document', async () => {
    await service.upsertSettings(users!.userA.clerkUserId, {
      notifications: {
        email: true,
        dailyReminder: true,
        dailyReminderTime: '19:00',
        timezone: 'Asia/Kolkata',
      },
    });
    const settingsA = await service.getSettings(users!.userA.clerkUserId);
    const settingsB = await service.getSettings(users!.userB.clerkUserId);

    expect(settingsA).toMatchObject({
      dailyReminderEnabled: true,
      dailyReminderTime: '19:00',
      timezone: 'Asia/Kolkata',
    });
    expect(settingsB).toMatchObject({
      dailyReminderEnabled: false,
      dailyReminderTime: '19:00',
      timezone: 'UTC',
    });
  });

  it('isolates inbox listing and mutations by the authenticated user', async () => {
    await notifications.createReminderNotification(users!.userA.id, '2026-11-03');
    await notifications.createReminderNotification(users!.userA.id, '2026-11-03');
    await notifications.createReminderNotification(users!.userB.id, '2026-11-03');

    const [pageA, pageB] = await Promise.all([
      notifications.listInAppNotifications(users!.userA.clerkUserId),
      notifications.listInAppNotifications(users!.userB.clerkUserId),
    ]);
    expect(pageA.items).toHaveLength(1);
    expect(pageB.items).toHaveLength(1);
    expect(pageA.unreadCount).toBe(1);
    expect(pageA.items[0]?.id).not.toBe(pageB.items[0]?.id);
    expect(pageA.items[0]).not.toHaveProperty('userId');
    expect(pageA.items[0]).not.toHaveProperty('idempotencyKey');

    const userANotificationId = pageA.items[0]!.id;
    await expect(
      notifications.markInAppNotificationRead(users!.userB.clerkUserId, userANotificationId)
    ).rejects.toThrow('Notification not found');
    await expect(
      notifications.deleteInAppNotification(users!.userB.clerkUserId, userANotificationId)
    ).rejects.toThrow('Notification not found');

    const readNotification = await notifications.markInAppNotificationRead(
      users!.userA.clerkUserId,
      userANotificationId
    );
    expect(readNotification.readAt).toBeInstanceOf(Date);
    expect(await notifications.getUnreadNotificationCount(users!.userA.clerkUserId)).toBe(0);
    expect(await notifications.getUnreadNotificationCount(users!.userB.clerkUserId)).toBe(1);
  });

  it('isolates study chat conversations and turns between two users', async () => {
    const [conversationA, conversationB] = await Promise.all([
      studyChat.createConversation(users!.userA.clerkUserId, 'Explain binary search'),
      studyChat.createConversation(users!.userB.clerkUserId, 'Explain hash maps'),
    ]);
    const pageA = await studyChat.listConversations(users!.userA.clerkUserId);
    const pageB = await studyChat.listConversations(users!.userB.clerkUserId);

    expect(pageA.items.map((item) => item.id)).toEqual([conversationA.id]);
    expect(pageB.items.map((item) => item.id)).toEqual([conversationB.id]);
    await expect(
      studyChat.getConversation(users!.userB.clerkUserId, conversationA.id)
    ).rejects.toThrow('Conversation not found');
    await expect(
      studyChat.sendMessage(users!.userB.clerkUserId, conversationA.id, 'Follow up')
    ).rejects.toThrow('Conversation not found');
    await expect(
      studyChat.deleteConversation(users!.userB.clerkUserId, conversationA.id)
    ).rejects.toThrow('Conversation not found');

    const continued = await studyChat.sendMessage(
      users!.userA.clerkUserId,
      conversationA.id,
      'What is its time complexity?'
    );
    expect(continued.turnCount).toBe(2);
    expect(continued.messages).toHaveLength(4);
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
    await expect(
      database!.mongo.inAppNotification.findMany({ where: { userId: users!.userA.id } })
    ).resolves.toEqual([]);
    await expect(
      database!.mongo.studyChatConversation.findMany({ where: { userId: users!.userA.id } })
    ).resolves.toEqual([]);
    await expect(service.findByClerkId(users!.userB.clerkUserId)).resolves.toMatchObject({
      clerkUserId: users!.userB.clerkUserId,
    });
    await expect(
      database!.mongo.studyChatConversation.findMany({ where: { userId: users!.userB.id } })
    ).resolves.toHaveLength(1);
    await expect(service.getSettings(users!.userB.clerkUserId)).resolves.toMatchObject({
      preferences: { ownerMarker: 'user-b' },
    });
  });
});
