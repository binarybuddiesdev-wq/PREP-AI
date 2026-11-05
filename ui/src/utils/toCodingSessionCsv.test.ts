import { describe, expect, it } from 'vitest';

import type { ICodingSession } from '@/core';
import { toCodingSessionCsv } from './toCodingSessionCsv';

const createSession = (overrides: Partial<ICodingSession> = {}): ICodingSession => ({
  id: 'session-one',
  problemIds: ['problem-one'],
  problemsAttempted: 2,
  problemsSolved: 1,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:12:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
  ...overrides,
});

describe('toCodingSessionCsv', () => {
  it('writes only coding session fields returned by the API', () => {
    expect(toCodingSessionCsv([createSession()])).toBe(
      [
        'Session date,Session ID,Problems attempted,Problems solved,Status,Duration',
        '2026-11-01T10:00:00.000Z,session-one,2,1,completed,12 min',
      ].join('\r\n')
    );
  });

  it('quotes commas, quotes, and line breaks in exported values', () => {
    const session = createSession({
      id: 'session,"one"\r\nsecond line',
    });

    expect(toCodingSessionCsv([session])).toContain(
      '2026-11-01T10:00:00.000Z,"session,""one""\r\nsecond line",2,1,completed,12 min'
    );
  });

  it('leaves duration blank if the server has not completed the session', () => {
    expect(
      toCodingSessionCsv([createSession({ completedAt: null, status: 'in_progress' })])
    ).toContain('2026-11-01T10:00:00.000Z,session-one,2,1,in_progress,');
  });

  it('includes headers when the current page has no sessions', () => {
    expect(toCodingSessionCsv([])).toBe(
      'Session date,Session ID,Problems attempted,Problems solved,Status,Duration'
    );
  });
});
