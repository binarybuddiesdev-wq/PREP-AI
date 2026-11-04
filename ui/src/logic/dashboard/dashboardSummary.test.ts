import { describe, expect, it } from 'vitest';

import type {
  ICodingSession,
  IPracticeTopic,
  ITheoryScoreTrendPoint,
  ITheorySession,
  ITheoryWeakArea,
} from '@/core';
import { buildDashboardSummary } from './dashboardSummary';

const theorySessions: ITheorySession[] = [
  {
    id: 'today-complete',
    topicId: 'topic-react',
    mode: 'topic',
    difficulty: 'Mid',
    totalQuestions: 5,
    questionsAnswered: 4,
    avgScore: 8,
    status: 'completed',
    startedAt: '2026-11-04T07:00:00.000Z',
    completedAt: '2026-11-04T07:15:00.000Z',
    createdAt: '2026-11-04T07:00:00.000Z',
  },
  {
    id: 'yesterday-complete',
    topicId: null,
    mode: 'weak',
    difficulty: 'Senior',
    totalQuestions: 3,
    questionsAnswered: 3,
    avgScore: 6,
    status: 'completed',
    startedAt: '2026-11-03T07:00:00.000Z',
    completedAt: '2026-11-03T07:15:00.000Z',
    createdAt: '2026-11-03T07:00:00.000Z',
  },
  {
    id: 'today-in-progress',
    topicId: 'deleted-topic',
    mode: 'topic',
    difficulty: 'Junior',
    totalQuestions: 5,
    questionsAnswered: 2,
    avgScore: 0,
    status: 'in_progress',
    startedAt: '2026-11-04T09:00:00.000Z',
    completedAt: null,
    createdAt: '2026-11-04T09:00:00.000Z',
  },
];

const codingSessions: ICodingSession[] = [
  {
    id: 'coding-1',
    problemIds: ['problem-1', 'problem-2'],
    problemsAttempted: 2,
    problemsSolved: 1,
    status: 'completed',
    startedAt: '2026-11-04T08:00:00.000Z',
    completedAt: '2026-11-04T08:30:00.000Z',
    createdAt: '2026-11-04T08:00:00.000Z',
  },
];

const topics: IPracticeTopic[] = [
  {
    id: 'topic-react',
    name: 'React',
    slug: 'react',
    category: 'practice',
    icon: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const scoreTrend: ITheoryScoreTrendPoint[] = [
  { date: '2026-11-03', avgScore: 6 },
  { date: '2026-11-04', avgScore: 8 },
];

const weakAreas: ITheoryWeakArea[] = [
  {
    topicId: 'topic-node',
    topicName: 'Node.js',
    avgScore: 5.5,
    sessionsCount: 2,
    lastPracticed: '2026-11-03T07:15:00.000Z',
  },
];

describe('buildDashboardSummary', () => {
  it('builds accurate metrics, streak, recent session labels, and server-backed recommendations', () => {
    const summary = buildDashboardSummary({
      theorySessions,
      codingSessions,
      topics,
      scoreTrend,
      weakAreas,
      now: new Date('2026-11-04T10:00:00.000Z'),
    });

    expect(summary.metrics).toEqual({
      completedSessions: 2,
      questionsAnswered: 9,
      averageScore: 7,
      problemsSolved: 1,
      currentStreak: 2,
    });
    expect(summary.week).toHaveLength(7);
    expect(summary.recentSessions.map((session) => session.topicName)).toEqual([
      'Practice session',
      'React',
      'Weak areas practice',
    ]);
    expect(summary.suggestions).toEqual(weakAreas);
    expect(summary.scoreTrend).toEqual(scoreTrend);
  });

  it('keeps PDF sessions identifiable when their source topic is unavailable', () => {
    const pdfSession: ITheorySession = {
      ...theorySessions[0],
      id: 'pdf-study',
      topicId: 'missing-topic',
      mode: 'pdf',
    };
    const summary = buildDashboardSummary({
      theorySessions: [pdfSession],
      codingSessions: [],
      topics: [],
      scoreTrend: [],
      weakAreas: [],
      now: new Date('2026-11-04T10:00:00.000Z'),
    });

    expect(summary.recentSessions[0].topicName).toBe('PDF study');
  });

  it('returns neutral metrics and no streak when the account has no completed practice', () => {
    const summary = buildDashboardSummary({
      theorySessions: [],
      codingSessions: [],
      topics: [],
      scoreTrend: [],
      weakAreas: [],
      now: new Date('2026-11-04T10:00:00.000Z'),
    });

    expect(summary.metrics).toEqual({
      completedSessions: 0,
      questionsAnswered: 0,
      averageScore: null,
      problemsSolved: 0,
      currentStreak: 0,
    });
    expect(summary.week.every((day) => !day.isActive)).toBe(true);
    expect(summary.recentSessions).toEqual([]);
    expect(summary.suggestions).toEqual([]);
  });
});
