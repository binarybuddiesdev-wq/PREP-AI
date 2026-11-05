import { describe, expect, it } from 'vitest';

import type {
  ICodingProblem,
  ICodingProblemSummary,
  ICodingSessionDetail,
  ICodingSessionHistory,
} from '@/core';

import { createApiClient } from './apiClient';
import {
  getCodingStats,
  getCodingExecution,
  getCodingProblem,
  getCodingProblems,
  getCodingSessionDetail,
  getCodingSessionHistory,
  requestCodingReview,
  runCodingCode,
  startCodingSession,
  submitCodingSolution,
} from './coding.api';

describe('coding API', () => {
  it('requests authenticated coding stats from the canonical stats endpoint', async () => {
    const requests: Request[] = [];
    const stats = {
      solved: 7,
      dailySolved: { used: 2, limit: 5 },
      dailyReviews: { used: 1, limit: 3 },
      streakDays: 4,
    };
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'ok', data: stats }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(getCodingStats(api)).resolves.toMatchObject({ data: stats });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('http://api.test/api/v1/coding/stats');
  });

  it('requests the authenticated coding problem catalogue', async () => {
    const requests: Request[] = [];
    const problems: ICodingProblemSummary[] = [
      {
        id: 'problem-one',
        title: 'Two Sum',
        slug: 'two-sum',
        description: 'Find two values that add to the target.',
        difficulty: 'Easy',
        topic: 'Arrays',
        isSolved: true,
      },
    ];
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'ok', data: problems }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(getCodingProblems(api)).resolves.toMatchObject({ data: problems });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('http://api.test/api/v1/coding/problems');
  });

  it.each(['two-sum', 'problem-one'])(
    'loads a problem by ID or slug for a deep-linked detail route (%s)',
    async (problemIdOrSlug) => {
      const requests: Request[] = [];
      const problem: ICodingProblem = {
        id: 'problem-one',
        title: 'Two Sum',
        slug: 'two-sum',
        description: 'Find two values that add to the target.',
        difficulty: 'Easy',
        topic: 'Arrays',
        examples: [{ input: [[2, 7], 9], output: [0, 1], explanation: '2 + 7 = 9.' }],
        constraints: ['Two values exist.'],
        codeJs: 'function solution() {}',
        codeTs: 'function solution(): void {}',
        codePy: 'def solution():\n    pass',
      };
      const api = createApiClient({
        baseUrl: 'http://api.test',
        getToken: async () => 'token',
        fetchImplementation: async (request) => {
          requests.push(request instanceof Request ? request.clone() : new Request(request));
          return new Response(JSON.stringify({ success: true, message: 'ok', data: problem }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      });

      await expect(getCodingProblem(api, problemIdOrSlug)).resolves.toMatchObject({
        data: problem,
      });
      expect(requests[0].url).toBe(`http://api.test/api/v1/coding/problems/${problemIdOrSlug}`);
    }
  );

  it('requests paginated coding session history and parses the typed envelope', async () => {
    const requests: Request[] = [];
    const history: ICodingSessionHistory = {
      sessions: [],
      total: 0,
      page: 3,
      limit: 100,
    };
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'ok', data: history }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(getCodingSessionHistory(api, { page: 3, limit: 100 })).resolves.toEqual({
      success: true,
      message: 'ok',
      data: history,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('http://api.test/api/v1/coding/sessions?page=3&limit=100');
  });

  it('loads saved coding submissions from the encoded owner-scoped session detail route', async () => {
    const requests: Request[] = [];
    const session: ICodingSessionDetail = {
      id: 'session one',
      userId: 'user-one',
      problemIds: ['problem-one'],
      problemsAttempted: 1,
      problemsSolved: 1,
      status: 'completed',
      startedAt: '2026-11-01T10:00:00.000Z',
      completedAt: '2026-11-01T10:10:00.000Z',
      createdAt: '2026-11-01T10:00:00.000Z',
      answers: [],
    };
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'ok', data: session }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(getCodingSessionDetail(api, 'session one')).resolves.toMatchObject({
      data: session,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('http://api.test/api/v1/coding/session/session%20one');
  });

  it('starts a problem-scoped session with a stable idempotency key', async () => {
    const requests: Request[] = [];
    const session = {
      id: 'session-one',
      userId: 'user-one',
      problemIds: ['problem-one'],
      problemsAttempted: 0,
      problemsSolved: 0,
      status: 'in_progress' as const,
      startedAt: '2026-11-05T10:00:00.000Z',
      completedAt: null,
      createdAt: '2026-11-05T10:00:00.000Z',
    };
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'started', data: session }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(
      startCodingSession(api, { problemIds: ['problem-one'] }, 'session-key-one')
    ).resolves.toMatchObject({ data: session });
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('http://api.test/api/v1/coding/session/start');
    expect(requests[0].headers.get('Idempotency-Key')).toBe('session-key-one');
    await expect(requests[0].clone().json()).resolves.toEqual({
      problemIds: ['problem-one'],
    });
  });

  it.each([
    ['run', runCodingCode],
    ['submit', submitCodingSolution],
  ] as const)(
    'queues a coding %s with its request snapshot and idempotency key',
    async (operation, requestOperation) => {
      const requests: Request[] = [];
      const execution = {
        id: 'execution-one',
        sessionId: 'session-one',
        operation,
        status: 'queued' as const,
        createdAt: '2026-11-05T10:00:00.000Z',
      };
      const api = createApiClient({
        baseUrl: 'http://api.test',
        getToken: async () => 'token',
        fetchImplementation: async (request) => {
          requests.push(request instanceof Request ? request.clone() : new Request(request));
          return new Response(
            JSON.stringify({ success: true, message: 'queued', data: execution }),
            {
              status: 202,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        },
      });
      const body = {
        problemId: 'problem-one',
        language: 'typescript' as const,
        code: 'const x = 42;',
      };

      await expect(
        requestOperation(api, 'session-one', body, 'execution-key-one')
      ).resolves.toMatchObject({ data: execution });
      expect(requests[0].method).toBe('POST');
      expect(requests[0].url).toBe(
        `http://api.test/api/v1/coding/session/session-one/${operation}`
      );
      expect(requests[0].headers.get('Idempotency-Key')).toBe('execution-key-one');
      await expect(requests[0].clone().json()).resolves.toEqual(body);
    }
  );

  it('reads an execution by encoded session and execution IDs', async () => {
    const requests: Request[] = [];
    const execution = {
      id: 'execution/one',
      sessionId: 'session/one',
      problemId: 'problem-one',
      operation: 'run' as const,
      language: 'javascript' as const,
      status: 'completed' as const,
      result: {
        status: 'wrong_answer' as const,
        testCasesPassed: 0,
        testCasesTotal: 1,
        testCases: [{ input: [1], expected: 2, got: 1, passed: false }],
        runtime: null,
        memoryUsage: null,
      },
      failureMessage: null,
      createdAt: '2026-11-05T10:00:00.000Z',
      startedAt: '2026-11-05T10:00:01.000Z',
      completedAt: '2026-11-05T10:00:02.000Z',
      answer: null,
    };
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'loaded', data: execution }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(getCodingExecution(api, 'session/one', 'execution/one')).resolves.toMatchObject({
      data: execution,
    });
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe(
      'http://api.test/api/v1/coding/session/session%2Fone/executions/execution%2Fone'
    );
  });

  it('requests an AI review for a submitted execution without sending a client body', async () => {
    const requests: Request[] = [];
    const review = {
      id: 'answer-one',
      status: 'queued' as const,
      aiReviewJson: null,
      aiReviewFailureMessage: null,
    };
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'queued', data: review }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(requestCodingReview(api, 'session/one', 'execution/one')).resolves.toEqual({
      success: true,
      message: 'queued',
      data: review,
    });
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe(
      'http://api.test/api/v1/coding/session/session%2Fone/executions/execution%2Fone/review'
    );
    expect(requests[0].body).toBeNull();
  });
});
