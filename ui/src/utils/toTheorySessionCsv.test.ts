import { describe, expect, it } from 'vitest';

import type { ITheorySession } from '@/core';
import { toTheorySessionCsv } from './toTheorySessionCsv';

const createSession = (overrides: Partial<ITheorySession> = {}): ITheorySession => ({
  id: 'session-1',
  topicId: 'topic-react',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 8,
  avgScore: 7.25,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:20:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
  ...overrides,
});

describe('toTheorySessionCsv', () => {
  it('writes the session summary columns and values', () => {
    expect(toTheorySessionCsv([createSession()])).toBe(
      [
        'Session ID,Started at,Completed at,Mode,Topic ID,Difficulty,Questions answered,Total questions,Average score,Status',
        'session-1,2026-11-01T10:00:00.000Z,2026-11-01T10:20:00.000Z,topic,topic-react,Mid,8,10,7.25,completed',
      ].join('\r\n')
    );
  });

  it('quotes commas, quotes, and line breaks and preserves Unicode', () => {
    const session = createSession({
      id: 'session,"one"',
      topicId: 'React, "Hooks"\r\n基本',
    });

    expect(toTheorySessionCsv([session])).toContain(
      '"session,""one""",2026-11-01T10:00:00.000Z,2026-11-01T10:20:00.000Z,topic,"React, ""Hooks""\r\n基本",Mid,8,10,7.25,completed'
    );
  });

  it('includes the CSV headers when the current page has no sessions', () => {
    expect(toTheorySessionCsv([])).toBe(
      'Session ID,Started at,Completed at,Mode,Topic ID,Difficulty,Questions answered,Total questions,Average score,Status'
    );
  });
});
