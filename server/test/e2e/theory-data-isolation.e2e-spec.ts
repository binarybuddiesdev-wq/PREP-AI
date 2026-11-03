import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TheoryService } from '../../src/modules/theory/theory.service.js';
import {
  connectIsolationTestDatabases,
  createIntegrationLogger,
  createTestUserPair,
  disconnectIsolationTestDatabases,
  withTestUserContext,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;
type TUserPair = Awaited<ReturnType<typeof createTestUserPair>>;

describe('PostgreSQL theory data isolation', () => {
  let database: TDatabase | undefined;
  let users: TUserPair | undefined;
  let service: TheoryService;
  let topicId: string;
  let sessionA: { id: string };
  let sessionB: { id: string };
  let answerA: { id: string };
  let answerB: { id: string };
  let submissionSessionA: { id: string };
  let submissionSessionB: { id: string };
  let completionSessionA: { id: string };
  let completionSessionB: { id: string };
  let analyticsSessionA: { id: string };
  let analyticsSessionB: { id: string };
  let startedSessionA: { id: string; userId: string };

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
    users = await createTestUserPair(database.mongo, 'theory-data-isolation');
    const redis = { reserveQuota: async () => ({ allowed: true }), releaseQuota: async () => {} };
    const jobs = { enqueue: async () => 'test-job' };
    service = new TheoryService(
      database.mongo,
      database.postgresProvider,
      redis as never,
      jobs as never,
      { get: () => undefined } as never,
      createIntegrationLogger() as never
    );

    const topic = await database.mongo.topic.create({
      data: { name: 'Isolation Topic', slug: `isolation-${randomUUID()}`, category: 'Testing' },
    });
    topicId = topic.id;
    await database.mongo.question.create({
      data: {
        question: 'Which user owns this session?',
        topicId,
        difficulty: 'Junior',
        referenceAnswer: 'The authenticated user.',
      },
    });

    const createSession = (userId: string, data: Record<string, unknown> = {}) =>
      withTestUserContext(database!, userId, (transaction) =>
        transaction.theorySession.create({
          data: {
            userId,
            topicId,
            mode: 'topic',
            difficulty: 'Junior',
            totalQuestions: 1,
            ...data,
          } as never,
        })
      );

    [sessionA, sessionB] = await Promise.all([
      createSession(users.userA.clerkUserId, { questionsAnswered: 1 }),
      createSession(users.userB.clerkUserId, { questionsAnswered: 1 }),
    ]);
    [answerA, answerB] = await Promise.all([
      withTestUserContext(database, users.userA.clerkUserId, (transaction) =>
        transaction.theoryAnswer.create({
          data: {
            sessionId: sessionA.id,
            questionText: 'A question for A',
            userAnswer: 'A answer',
            aiScore: 4,
            status: 'completed',
          },
        })
      ),
      withTestUserContext(database, users.userB.clerkUserId, (transaction) =>
        transaction.theoryAnswer.create({
          data: {
            sessionId: sessionB.id,
            questionText: 'A question for B',
            userAnswer: 'B answer',
            aiScore: 10,
            status: 'completed',
          },
        })
      ),
    ]);
    [submissionSessionA, submissionSessionB] = await Promise.all([
      createSession(users.userA.clerkUserId),
      createSession(users.userB.clerkUserId),
    ]);
    [completionSessionA, completionSessionB] = await Promise.all([
      createSession(users.userA.clerkUserId, { topicId: null }),
      createSession(users.userB.clerkUserId, { topicId: null }),
    ]);
    [analyticsSessionA, analyticsSessionB] = await Promise.all([
      createSession(users.userA.clerkUserId, {
        status: 'completed',
        avgScore: 4,
        questionsAnswered: 1,
      }),
      createSession(users.userB.clerkUserId, {
        status: 'completed',
        avgScore: 10,
        questionsAnswered: 1,
      }),
    ]);
  }, 30_000);

  afterAll(async () => {
    if (!database) return;
    if (users) {
      await Promise.all([
        withTestUserContext(database, users.userA.clerkUserId, (transaction) =>
          transaction.theorySession.deleteMany({ where: { userId: users!.userA.clerkUserId } })
        ),
        withTestUserContext(database, users.userB.clerkUserId, (transaction) =>
          transaction.theorySession.deleteMany({ where: { userId: users!.userB.clerkUserId } })
        ),
      ]);
      if (topicId) {
        await database.mongo.question.deleteMany({ where: { topicId } });
        await database.mongo.topic.delete({ where: { id: topicId } });
      }
      await database.mongo.user.deleteMany({
        where: { id: { in: [users.userA.id, users.userB.id] } },
      });
    }
    await disconnectIsolationTestDatabases(database);
  }, 30_000);

  it('allows a user to fetch questions through their own topic session only', async () => {
    await expect(
      service.getSessionQuestions(sessionA.id, users!.userA.clerkUserId, {})
    ).resolves.toMatchObject([{ topicId, difficulty: 'Junior' }]);
    await expect(
      service.getSessionQuestions(sessionB.id, users!.userA.clerkUserId, {})
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns only the caller-owned theory session and its answers', async () => {
    await expect(
      service.getSessionDetail(sessionA.id, users!.userA.clerkUserId)
    ).resolves.toMatchObject({ id: sessionA.id, userId: users!.userA.clerkUserId });
    await expect(
      service.getSessionDetail(sessionB.id, users!.userA.clerkUserId)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps theory answers behind both the caller-owned session and its answer ID', async () => {
    await expect(
      service.getAnswerEvaluation(sessionA.id, answerA.id, users!.userA.clerkUserId)
    ).resolves.toMatchObject({ id: answerA.id, sessionId: sessionA.id });
    await expect(
      service.getAnswerEvaluation(sessionA.id, answerB.id, users!.userA.clerkUserId)
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getAnswerEvaluation(sessionB.id, answerB.id, users!.userA.clerkUserId)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists submissions in the owned session and safely replays the same idempotency key', async () => {
    const dto = { questionId: undefined, questionText: 'Test question', userAnswer: 'Test answer' };
    const key = `isolation-${randomUUID()}`;
    const created = await service.submitAnswer(
      submissionSessionA.id,
      users!.userA.clerkUserId,
      dto,
      key
    );
    const replay = await service.submitAnswer(
      submissionSessionA.id,
      users!.userA.clerkUserId,
      dto,
      key
    );

    expect(replay.id).toBe(created.id);
    await expect(
      service.submitAnswer(submissionSessionB.id, users!.userA.clerkUserId, dto, key)
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      withTestUserContext(database!, users!.userA.clerkUserId, (transaction) =>
        transaction.theoryAnswer.count({ where: { sessionId: submissionSessionA.id } })
      )
    ).resolves.toBe(1);
    await expect(
      withTestUserContext(database!, users!.userA.clerkUserId, (transaction) =>
        transaction.theoryAnswer.count({ where: { sessionId: submissionSessionB.id } })
      )
    ).resolves.toBe(0);
  });

  it('completes only the caller-owned theory session', async () => {
    await expect(
      service.completeSession(completionSessionA.id, users!.userA.clerkUserId)
    ).resolves.toMatchObject({ id: completionSessionA.id, status: 'completed' });
    await expect(
      service.completeSession(completionSessionB.id, users!.userA.clerkUserId)
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      withTestUserContext(database!, users!.userB.clerkUserId, (transaction) =>
        transaction.theorySession.findUnique({ where: { id: completionSessionB.id } })
      )
    ).resolves.toMatchObject({ userId: users!.userB.clerkUserId, status: 'in_progress' });
  });

  it('limits theory history and counts to the caller', async () => {
    const history = await service.getSessionHistory(users!.userA.clerkUserId, {
      page: 1,
      limit: 100,
    });

    expect(history.total).toBe(history.sessions.length);
    expect(history.total).toBeGreaterThanOrEqual(4);
    expect(history.sessions.map(({ id }) => id)).toContain(analyticsSessionA.id);
    expect(history.sessions.map(({ id }) => id)).not.toContain(analyticsSessionB.id);
    expect(history.sessions.every(({ userId }) => userId === users!.userA.clerkUserId)).toBe(true);
  });

  it('limits weak-area summaries and score trends to each caller', async () => {
    await expect(service.getWeakAreas(users!.userA.clerkUserId)).resolves.toMatchObject([
      { topicId, avgScore: 4, sessionsCount: 1 },
    ]);
    await expect(service.getWeakAreas(users!.userB.clerkUserId)).resolves.toEqual([]);

    const trendA = await service.getScoreTrend(users!.userA.clerkUserId, { limit: 100 });
    const trendB = await service.getScoreTrend(users!.userB.clerkUserId, { limit: 100 });
    expect(trendA.map(({ avgScore }) => avgScore)).toContain(4);
    expect(trendA.map(({ avgScore }) => avgScore)).not.toContain(10);
    expect(trendB.map(({ avgScore }) => avgScore)).toContain(10);
  });

  it('records newly started sessions under the authenticated Clerk subject', async () => {
    startedSessionA = await service.startSession(
      { mode: 'topic', topicId, difficulty: 'Junior', totalQuestions: 1 },
      users!.userA.clerkUserId
    );

    expect(startedSessionA.userId).toBe(users!.userA.clerkUserId);
    await expect(
      withTestUserContext(database!, users!.userA.clerkUserId, (transaction) =>
        transaction.theorySession.findUnique({ where: { id: startedSessionA.id } })
      )
    ).resolves.toMatchObject({ userId: users!.userA.clerkUserId });
  });
});
