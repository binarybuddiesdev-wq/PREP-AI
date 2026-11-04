import { describe, expect, it } from 'vitest';

import type { IStartTheorySessionBody, ISubmitTheoryAnswerBody } from '@/core';

import { createApiClient } from './apiClient';
import {
  completeTheorySession,
  getPracticeTopics,
  getTheoryAnswerEvaluation,
  getTheoryScoreTrend,
  getTheorySessionDetail,
  getTheorySessionHistory,
  getTheorySessionQuestions,
  getTheoryWeakAreas,
  startTheorySession,
  submitTheoryAnswer,
} from './theory.api';

const makeApi = () => {
  const requests: Request[] = [];
  const api = createApiClient({
    baseUrl: 'http://api.test',
    getToken: async () => 'token',
    fetchImplementation: async (request) => {
      requests.push(request instanceof Request ? request.clone() : new Request(request));
      return new Response(
        JSON.stringify({ success: true, message: 'ok', data: { id: 'session-1' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
  });

  return { api, requests };
};

describe('theory API', () => {
  it('starts a session with the supplied idempotency key and request body', async () => {
    const { api, requests } = makeApi();
    const body: IStartTheorySessionBody = {
      topicId: 'topic-1',
      mode: 'topic',
      difficulty: 'Mid',
      totalQuestions: 10,
    };

    await expect(startTheorySession(api, body, 'start-key')).resolves.toEqual({
      success: true,
      message: 'ok',
      data: { id: 'session-1' },
    });

    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('http://api.test/api/v1/theory/session/start');
    expect(requests[0].headers.get('Idempotency-Key')).toBe('start-key');
    await expect(requests[0].json()).resolves.toEqual(body);
  });

  it('submits an answer with the supplied idempotency key and exact payload', async () => {
    const { api, requests } = makeApi();
    const body: ISubmitTheoryAnswerBody = {
      questionId: 'question-1',
      questionText: 'What is a hook?',
      userAnswer: 'A reusable stateful function.',
      timeTaken: 42,
    };

    await submitTheoryAnswer(api, 'session/1', body, 'answer-key');

    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('http://api.test/api/v1/theory/session/session%2F1/answer');
    expect(requests[0].headers.get('Idempotency-Key')).toBe('answer-key');
    await expect(requests[0].json()).resolves.toEqual(body);
  });

  it('requests every theory read and completion endpoint from the API contract', async () => {
    const { api, requests } = makeApi();

    await Promise.all([
      getPracticeTopics(api),
      getTheoryWeakAreas(api),
      getTheoryScoreTrend(api, 7),
      getTheorySessionQuestions(api, 'session-1', 10),
      getTheoryAnswerEvaluation(api, 'session-1', 'answer-1'),
      getTheorySessionDetail(api, 'session-1'),
      getTheorySessionHistory(api, { page: 2, limit: 20 }),
      completeTheorySession(api, 'session-1'),
    ]);

    expect(requests.map((request) => request.url)).toEqual(
      expect.arrayContaining([
        'http://api.test/api/v1/topics?category=practice',
        'http://api.test/api/v1/theory/weak-areas',
        'http://api.test/api/v1/theory/score-trend?limit=7',
        'http://api.test/api/v1/theory/session/session-1/questions?limit=10',
        'http://api.test/api/v1/theory/session/session-1/answers/answer-1',
        'http://api.test/api/v1/theory/session/session-1',
        'http://api.test/api/v1/theory/sessions?page=2&limit=20',
        'http://api.test/api/v1/theory/session/session-1/complete',
      ])
    );
  });

  it('omits the question limit when the caller leaves it unspecified', async () => {
    const { api, requests } = makeApi();

    await getTheorySessionQuestions(api, 'session-1');

    expect(requests[0].url).toBe('http://api.test/api/v1/theory/session/session-1/questions');
  });
});
