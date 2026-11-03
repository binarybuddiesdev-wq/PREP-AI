import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CodingService } from '../../src/modules/coding/coding.service.js';
import { CodingExecutionService } from '../../src/modules/coding/coding-execution.service.js';
import type { ICodingExecutionJobData } from '../../src/modules/coding/coding-execution.types.js';
import type { TCodingExecutionResult } from '../../src/modules/coding/coding-execution.types.js';
import {
  connectIsolationTestDatabases,
  createIntegrationLogger,
  disconnectIsolationTestDatabases,
  withTestUserContext,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;

describe('PostgreSQL coding data isolation', () => {
  let database: TDatabase | undefined;
  let service: CodingService;
  let executionService: CodingExecutionService;
  let userA: string;
  let userB: string;
  let problem: { id: string; examples: unknown };
  let sessionA: { id: string };
  let sessionB: { id: string };
  let completionSessionA: { id: string };
  let completionSessionB: { id: string };
  let workerSessionA: { id: string };
  let workerSessionB: { id: string };
  let executionA: { id: string };
  let executionB: { id: string };
  let workerExecutionA: { id: string };
  let workerExecutionMismatch: { id: string };

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
    const fixtureId = randomUUID();
    userA = `coding-user-a-${fixtureId}`;
    userB = `coding-user-b-${fixtureId}`;
    const jobs = {
      getJobId: (_queue: string, id: string) => `test-${id}`,
      enqueue: async () => {},
    };
    const logger = createIntegrationLogger();
    service = new CodingService(
      database.mongo,
      database.postgresProvider,
      {} as never,
      jobs as never,
      {} as never,
      logger as never
    );
    executionService = new CodingExecutionService(database.postgresProvider, logger as never);

    problem = await database.postgres.codingQuestion.create({
      data: {
        title: 'Isolation Problem',
        slug: `isolation-${fixtureId}`,
        description: 'A disposable test problem',
        difficulty: 'Easy',
        topic: 'Testing',
        examples: [{ input: [], output: 1 }],
        constraints: [],
        codeJs: 'function solution() {}',
        codeTs: 'function solution() {}',
        codePy: 'def solution(): pass',
      },
    });

    const createSession = (userId: string, problemIds = [problem.id]) =>
      withTestUserContext(database!, userId, (transaction) =>
        transaction.codingSession.create({ data: { userId, problemIds } })
      );
    [sessionA, sessionB] = await Promise.all([createSession(userA), createSession(userB)]);
    [completionSessionA, completionSessionB] = await Promise.all([
      createSession(userA, []),
      createSession(userB, []),
    ]);
    [workerSessionA, workerSessionB] = await Promise.all([
      createSession(userA, []),
      createSession(userB, []),
    ]);
    [executionA, executionB] = await Promise.all([
      withTestUserContext(database, userA, (transaction) =>
        transaction.codingExecution.create({
          data: {
            sessionId: sessionA.id,
            userId: userA,
            problemId: problem.id,
            operation: 'run',
            language: 'javascript',
            sourceCode: 'function solution() {}',
            examples: problem.examples as never,
            queueJobId: `test-${randomUUID()}`,
          },
        })
      ),
      withTestUserContext(database, userB, (transaction) =>
        transaction.codingExecution.create({
          data: {
            sessionId: sessionB.id,
            userId: userB,
            problemId: problem.id,
            operation: 'run',
            language: 'javascript',
            sourceCode: 'function solution() {}',
            examples: problem.examples as never,
            queueJobId: `test-${randomUUID()}`,
          },
        })
      ),
    ]);
    [workerExecutionA, workerExecutionMismatch] = await Promise.all([
      createWorkerExecution(workerSessionA.id, userA),
      createWorkerExecution(workerSessionA.id, userA),
    ]);
  }, 30_000);

  async function createWorkerExecution(sessionId: string, ownerId: string) {
    return withTestUserContext(database!, ownerId, (transaction) =>
      transaction.codingExecution.create({
        data: {
          sessionId,
          userId: ownerId,
          problemId: problem.id,
          operation: 'submit',
          language: 'javascript',
          sourceCode: 'function solution() {}',
          examples: problem.examples as never,
          queueJobId: `test-${randomUUID()}`,
        },
      })
    );
  }

  afterAll(async () => {
    if (!database) return;
    if (userA && userB) {
      await Promise.all(
        [userA, userB].map((userId) =>
          withTestUserContext(database!, userId, async (transaction) => {
            await transaction.codingAnswer.deleteMany({ where: { userId } });
            await transaction.codingSession.deleteMany({ where: { userId } });
          })
        )
      );
    }
    if (problem?.id) {
      await database.postgres.codingQuestion.delete({ where: { id: problem.id } });
    }
    await disconnectIsolationTestDatabases(database);
  }, 30_000);

  it('returns only the caller-owned coding session', async () => {
    await expect(service.getSessionDetail(sessionA.id, userA)).resolves.toMatchObject({
      id: sessionA.id,
      userId: userA,
    });
    await expect(service.getSessionDetail(sessionB.id, userA)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('claims queued worker rows once and releases the dispatch lease on processing', async () => {
    const queued = await executionService.findQueuedForDispatch();
    expect(queued.map(({ executionId }) => executionId)).toContain(workerExecutionA.id);
    expect(queued.map(({ executionId }) => executionId)).toContain(workerExecutionMismatch.id);

    const secondScan = await executionService.findQueuedForDispatch();
    expect(secondScan.map(({ executionId }) => executionId)).not.toContain(workerExecutionA.id);
    expect(secondScan.map(({ executionId }) => executionId)).not.toContain(
      workerExecutionMismatch.id
    );

    await executionService.markRunning(workerExecutionA.id);
    const thirdScan = await executionService.findQueuedForDispatch();
    expect(thirdScan.map(({ executionId }) => executionId)).not.toContain(workerExecutionA.id);
  });

  it('scopes execution reads by execution, session, and owner', async () => {
    await expect(service.getExecution(sessionA.id, executionA.id, userA)).resolves.toMatchObject({
      id: executionA.id,
      sessionId: sessionA.id,
    });
    await expect(service.getExecution(sessionA.id, executionB.id, userA)).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.getExecution(sessionB.id, executionB.id, userA)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('limits coding history and counts to the caller', async () => {
    const history = await service.getSessionHistory(userA, { page: 1, limit: 100 });

    expect(history.sessions.map(({ id }) => id)).toContain(sessionA.id);
    expect(history.sessions.map(({ id }) => id)).not.toContain(sessionB.id);
    expect(history.sessions.every(({ userId }) => userId === userA)).toBe(true);
    expect(history.total).toBe(history.sessions.length);
  });

  it('rejects run and submit requests against a foreign session before reaching Redis', async () => {
    const dto = {
      problemId: problem.id,
      language: 'javascript' as const,
      code: 'function solution() {}',
    };

    await expect(
      service.runCode(sessionB.id, userA, dto, 'foreign-session-run')
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.submitSolution(sessionB.id, userA, dto, 'foreign-session-submit')
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('completes only the caller-owned coding session', async () => {
    await expect(service.completeSession(completionSessionA.id, userA)).resolves.toMatchObject({
      id: completionSessionA.id,
      status: 'completed',
    });
    await expect(service.completeSession(completionSessionB.id, userA)).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(
      withTestUserContext(database!, userB, (transaction) =>
        transaction.codingSession.findUnique({ where: { id: completionSessionB.id } })
      )
    ).resolves.toMatchObject({ userId: userB, status: 'in_progress' });
  });

  it('starts a coding session for the authenticated owner', async () => {
    const created = await service.startSession(
      { problemIds: [problem.id] },
      userA,
      'coding-isolation-session-start-a'
    );

    expect(created.userId).toBe(userA);
    await expect(
      withTestUserContext(database!, userA, (transaction) =>
        transaction.codingSession.findUnique({ where: { id: created.id } })
      )
    ).resolves.toMatchObject({ userId: userA });
  });

  it('uses persisted owner data for worker submission mutations', async () => {
    const acceptedResult: TCodingExecutionResult = {
      status: 'accepted',
      testCasesPassed: 1,
      testCasesTotal: 1,
      testCases: [{ input: [], expected: 1, got: 1, passed: true }],
      runtime: null,
      memoryUsage: null,
    };
    const createJob = (executionId: string, userId: string): ICodingExecutionJobData => ({
      idempotencyKey: executionId,
      executionId,
      sessionId: workerSessionA.id,
      userId,
      problemId: problem.id,
      operation: 'submit',
      language: 'javascript',
      code: 'function solution() {}',
      examples: problem.examples,
      quotaReservation: null,
    });

    await expect(
      executionService.complete(createJob(workerExecutionA.id, userA), acceptedResult)
    ).resolves.toEqual(acceptedResult);
    await expect(
      withTestUserContext(database!, userA, (transaction) =>
        transaction.codingSession.findUnique({ where: { id: workerSessionA.id } })
      )
    ).resolves.toMatchObject({ problemsAttempted: 1, problemsSolved: 1 });
    await expect(
      withTestUserContext(database!, userB, (transaction) =>
        transaction.codingSession.findUnique({ where: { id: workerSessionB.id } })
      )
    ).resolves.toMatchObject({ problemsAttempted: 0, problemsSolved: 0 });

    await expect(
      executionService.complete(createJob(workerExecutionMismatch.id, userB), acceptedResult)
    ).resolves.toEqual(acceptedResult);
    await expect(
      withTestUserContext(database!, userA, (transaction) =>
        transaction.codingExecution.findUnique({ where: { id: workerExecutionMismatch.id } })
      )
    ).resolves.toMatchObject({ userId: userA, status: 'completed' });
    await expect(
      withTestUserContext(database!, userA, (transaction) =>
        transaction.codingSession.findUnique({ where: { id: workerSessionA.id } })
      )
    ).resolves.toMatchObject({ problemsAttempted: 2, problemsSolved: 1 });
  });
});
