import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { IDashboardSummary } from '@/core';
import { DashboardOverview } from './DashboardOverview';
import type { IDashboardOverviewProps, IDashboardPanelStatus } from './DashboardOverview.types';

const summary: IDashboardSummary = {
  metrics: {
    completedSessions: 3,
    questionsAnswered: 14,
    averageScore: 7.5,
    problemsSolved: 2,
    currentStreak: 2,
  },
  week: [
    { label: 'M', date: '2026-11-02', isActive: true },
    { label: 'T', date: '2026-11-03', isActive: true },
    { label: 'W', date: '2026-11-04', isActive: false },
    { label: 'T', date: '2026-11-05', isActive: false },
    { label: 'F', date: '2026-11-06', isActive: false },
    { label: 'S', date: '2026-11-07', isActive: false },
    { label: 'S', date: '2026-11-08', isActive: false },
  ],
  recentSessions: [
    {
      id: 'session-1',
      topicName: 'React',
      startedAt: '2026-11-04T07:00:00.000Z',
      status: 'completed',
      questionsAnswered: 5,
      totalQuestions: 5,
      averageScore: 8,
    },
  ],
  scoreTrend: [{ date: '2026-11-04', avgScore: 8 }],
  suggestions: [
    {
      topicId: 'topic-node',
      topicName: 'Node.js',
      avgScore: 5.5,
      sessionsCount: 2,
      lastPracticed: '2026-11-03T07:15:00.000Z',
    },
  ],
  setupChecklist: [
    { label: 'Set your target role', isComplete: true },
    { label: 'Choose focus topics', isComplete: false },
    { label: 'Complete your first practice session', isComplete: true },
  ],
};

const ready = (): IDashboardPanelStatus => ({
  isPending: false,
  isError: false,
  isFetching: false,
  error: null,
  onRetry: vi.fn(),
});

const renderOverview = (overrides: Partial<IDashboardOverviewProps> = {}) =>
  render(
    <MemoryRouter>
      <DashboardOverview
        name="Asha"
        summary={summary}
        theoryStatus={ready()}
        codingStatus={ready()}
        scoreTrendStatus={ready()}
        weakAreasStatus={ready()}
        practiceTopicsStatus={ready()}
        settingsStatus={ready()}
        onOpenSession={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>
  );

describe('DashboardOverview', () => {
  it('shows clear dashboard shortcuts to Practice and Coding', () => {
    renderOverview();

    expect(screen.getByRole('link', { name: /start practice/i })).toHaveAttribute(
      'href',
      '/practice'
    );
    expect(screen.getByRole('link', { name: /solve coding problems/i })).toHaveAttribute(
      'href',
      '/coding'
    );
  });

  it('shows account metrics, recent practice, weak-area suggestions, and setup progress', () => {
    renderOverview();

    expect(
      screen.getByRole('heading', { name: /Good (morning|afternoon|evening), Asha/ })
    ).toBeVisible();
    expect(screen.getByText('3')).toBeVisible();
    expect(screen.getByText('14')).toBeVisible();
    expect(screen.getByText('7.5/10')).toBeVisible();
    const sessionsMetric = screen.getByText('Sessions Completed').closest('article');
    expect(sessionsMetric).toHaveClass('bg-[var(--card)]');
    expect(within(sessionsMetric!).getByText('Sessions Completed')).toHaveClass(
      'text-[var(--dim)]'
    );
    const problemsSolved = screen.getByText('Problems Solved').closest('article');
    expect(within(problemsSolved!).getByText('2')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Recent Sessions' })).toBeVisible();
    expect(screen.getByText('React')).toBeVisible();
    expect(screen.getAllByText('Node.js')).toHaveLength(2);
    expect(screen.getByText('Choose focus topics')).toBeVisible();
    expect(screen.getByRole('img', { name: /score trend/i })).toBeInTheDocument();
  });

  it('opens the matching session detail from a recent practice session', async () => {
    const user = userEvent.setup();
    const onOpenSession = vi.fn();
    renderOverview({ onOpenSession });

    await user.click(screen.getByRole('button', { name: 'View React session' }));

    expect(onOpenSession).toHaveBeenCalledWith('session-1');
  });

  it('shows empty states without sample dashboard values', () => {
    renderOverview({
      summary: {
        ...summary,
        metrics: {
          completedSessions: 0,
          questionsAnswered: 0,
          averageScore: null,
          problemsSolved: 0,
          currentStreak: 0,
        },
        recentSessions: [],
        scoreTrend: [],
        suggestions: [],
      },
    });

    expect(screen.getByText('No sessions yet')).toBeVisible();
    expect(screen.getAllByText('No weak areas to work on yet')).toHaveLength(2);
    expect(screen.getByText('—')).toBeVisible();
  });

  it('renders a source-specific retry action and keeps other panels visible', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderOverview({
      theoryStatus: {
        ...ready(),
        isError: true,
        error: new Error('Theory history is unavailable'),
        onRetry,
      },
    });

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Theory history is unavailable');
    expect(screen.getAllByRole('status', { name: 'Unavailable' })).toHaveLength(3);
    expect(screen.getAllByText('Node.js')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Retry recent sessions' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('offers a retry when coding history is unavailable', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderOverview({
      codingStatus: {
        ...ready(),
        isError: true,
        error: new Error('Coding history is unavailable'),
        onRetry,
      },
    });

    const problemsSolved = screen.getByText('Problems Solved').closest('article');
    expect(within(problemsSolved!).getByRole('alert')).toHaveTextContent(
      'Coding history is unavailable'
    );
    await user.click(within(problemsSolved!).getByRole('button', { name: 'Retry coding history' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('offers a retry when topic names are unavailable but session history loaded', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderOverview({
      practiceTopicsStatus: {
        ...ready(),
        isError: true,
        error: new Error('Practice topics are unavailable'),
        onRetry,
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Practice topics are unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry topic names' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
