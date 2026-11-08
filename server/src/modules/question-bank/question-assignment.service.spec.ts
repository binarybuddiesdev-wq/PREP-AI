import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionAssignmentService } from './question-assignment.service.js';

describe('QuestionAssignmentService', () => {
  const seen = new Set<string>();
  const calls: string[] = [];
  const session = { id: 'session-1', questionIds: [] as string[] };
  const codingSession = { id: 'coding-session-1', problemIds: [] as string[] };
  const transaction = {
    theorySession: {
      findFirst: vi.fn(async () => {
        calls.push('read-session');
        return session;
      }),
      update: vi.fn(async ({ data }: { data: { questionIds: string[] } }) => {
        session.questionIds = data.questionIds;
        return session;
      }),
    },
    codingSession: {
      findFirst: vi.fn(async () => codingSession),
      update: vi.fn(async ({ data }: { data: { problemIds: string[] } }) => {
        codingSession.problemIds = data.problemIds;
        return codingSession;
      }),
    },
    questionRotation: {
      upsert: vi.fn(async () => {
        calls.push('lock');
        return { id: 'rotation-1' };
      }),
    },
    questionExposure: {
      findMany: vi.fn(async ({ where }: { where: { questionId: { in: string[] } } }) => {
        calls.push('read-exposure');
        return where.questionId.in
          .filter((id) => seen.has(id))
          .map((questionId) => ({ questionId }));
      }),
      createMany: vi.fn(async ({ data }: { data: Array<{ questionId: string }> }) => {
        calls.push('write-exposure');
        data.forEach(({ questionId }) => seen.add(questionId));
        return { count: data.length };
      }),
    },
  };
  const postgres = {
    withTenantContext: vi.fn(
      async (_userId: string, operation: (tx: typeof transaction) => unknown) =>
        operation(transaction)
    ),
  };
  let service: QuestionAssignmentService;

  beforeEach(() => {
    seen.clear();
    calls.length = 0;
    session.questionIds = [];
    codingSession.problemIds = [];
    transaction.codingSession.findFirst.mockResolvedValue(codingSession);
    vi.clearAllMocks();
    service = new QuestionAssignmentService(postgres as never);
  });

  it('persists a unique random set and records exposure before returning it', async () => {
    const result = await service.assignTheoryQuestions(
      'user-1',
      'session-1',
      'react:Junior',
      ['q1', 'q2', 'q3'],
      2
    );

    expect(result).toHaveLength(2);
    expect(new Set(result).size).toBe(2);
    expect(result.every((id) => ['q1', 'q2', 'q3'].includes(id))).toBe(true);
    expect(calls).toEqual(['lock', 'read-session', 'read-exposure', 'write-exposure']);
    expect(session.questionIds).toEqual(result);
  });

  it('does not repeat a previously exposed question in a later session', async () => {
    const first = await service.assignTheoryQuestions(
      'user-1',
      'session-1',
      'react:Junior',
      ['q1', 'q2', 'q3'],
      2
    );
    session.id = 'session-2';
    session.questionIds = [];

    const second = await service.assignTheoryQuestions(
      'user-1',
      'session-2',
      'react:Junior',
      ['q1', 'q2', 'q3'],
      2
    );

    expect(second).toHaveLength(1);
    expect(second.every((id) => !first.includes(id))).toBe(true);
  });

  it('replays the same persisted assignment without claiming questions twice', async () => {
    session.questionIds = ['q2', 'q1'];

    await expect(
      service.assignTheoryQuestions('user-1', 'session-1', 'react:Junior', ['q1', 'q2'], 2)
    ).resolves.toEqual(['q2', 'q1']);
    expect(transaction.questionExposure.createMany).not.toHaveBeenCalled();
    expect(transaction.questionRotation.upsert).toHaveBeenCalledTimes(1);
  });

  it('returns no questions when every candidate has already been exposed', async () => {
    seen.add('q1');
    seen.add('q2');

    await expect(
      service.assignTheoryQuestions('user-1', 'session-1', 'react:Junior', ['q1', 'q2'], 2)
    ).resolves.toEqual([]);
    expect(transaction.theorySession.update).not.toHaveBeenCalled();
  });

  it('assigns and persists unseen coding problems, while empty candidates or nonpositive limits stay empty', async () => {
    await expect(
      service.assignCodingProblems('user-1', 'coding-session-1', 'arrays:Easy', ['p1', 'p2'], 1)
    ).resolves.toHaveLength(1);
    expect(transaction.codingSession.update).toHaveBeenCalledOnce();

    codingSession.problemIds = [];
    await expect(
      service.assignCodingProblems('user-1', 'coding-session-1', 'arrays:Easy', [], 1)
    ).resolves.toEqual([]);
    await expect(
      service.assignCodingProblems('user-1', 'coding-session-1', 'arrays:Easy', ['p1'], 0)
    ).resolves.toEqual([]);
  });

  it('reports a missing coding session', async () => {
    transaction.codingSession.findFirst.mockResolvedValue(null as never);
    await expect(
      service.assignCodingProblems('user-1', 'missing', 'arrays:Easy', ['p1'], 1)
    ).rejects.toThrow(/coding session not found/i);
  });
});
