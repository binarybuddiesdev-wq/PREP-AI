import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { ICodingProblemSummary, IDashboardSummary, IPracticeTopic } from '@/core';
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

const practiceTopics: IPracticeTopic[] = [
  {
    id: 'topic-react',
    name: 'React',
    slug: 'react',
    category: 'practice',
    icon: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
];

const codingProblems: ICodingProblemSummary[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Find two values that add up to the target.',
    difficulty: 'Easy',
    topic: 'Arrays',
    isSolved: false,
  },
];

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
        practiceTopics={practiceTopics}
        codingProblems={codingProblems}
        theoryStatus={ready()}
        codingStatus={ready()}
        scoreTrendStatus={ready()}
        weakAreasStatus={ready()}
        practiceTopicsStatus={ready()}
        codingProblemsStatus={ready()}
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

  it('offers real practice topics and coding problems to start from the dashboard', () => {
    renderOverview();

    expect(screen.getByRole('link', { name: /practice react/i })).toHaveAttribute(
      'href',
      '/practice?topicId=topic-react'
    );
    expect(screen.getByRole('link', { name: /try two sum/i })).toHaveAttribute(
      'href',
      '/coding/two-sum'
    );
  });

  it('opens Practice with the selected weak-area topic', () => {
    renderOverview();

    expect(screen.getByRole('link', { name: 'Practice Node.js' })).toHaveAttribute(
      'href',
      '/practice?topicId=topic-node'
    );
  });

  it('shows loading feedback while the topic and coding catalogues load', () => {
    renderOverview({
      practiceTopicsStatus: { ...ready(), isPending: true },
      codingProblemsStatus: { ...ready(), isPending: true },
    });

    expect(screen.getByText('Loading practice topics...')).toBeVisible();
    expect(screen.getByText('Loading coding problems...')).toBeVisible();
  });

  it('retries the practice topic catalogue after a load failure', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderOverview({
      practiceTopicsStatus: {
        ...ready(),
        isError: true,
        error: new Error('Topics unavailable'),
        onRetry,
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Topics unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry topics' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('retries the coding problem catalogue after a load failure', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderOverview({
      codingProblemsStatus: {
        ...ready(),
        isError: true,
        error: new Error('Problems unavailable'),
        onRetry,
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Problems unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry problems' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('explains when no practice topics or coding problems are available', () => {
    renderOverview({ practiceTopics: [], codingProblems: [] });

    expect(screen.getByText('No practice topics are available yet.')).toBeVisible();
    expect(screen.getByText('No coding problems are available yet.')).toBeVisible();
  });

  it('shows completion feedback when every coding problem is solved', () => {
    renderOverview({
      codingProblems: [{ ...codingProblems[0], isSolved: true }],
    });

    expect(screen.getByText('You have solved every available challenge.')).toBeVisible();
  });

  it('shows account metrics, recent practice, weak-area suggestions, and setup progress', () => {
    renderOverview();

    expect(
      screen.getByRole('heading', { name: /Good (morning|afternoon|evening), Asha/ })
    ).toBeVisible();
    expect(screen.getByText('3')).toBeVisible();
    expect(screen.getByText('14')).toBeVisible();
    expect(screen.getByText('7.5')).toBeVisible();
    expect(screen.getByText('55% · 2 sessions')).toBeVisible();
    const sessionsMetric = screen.getByText('Sessions Completed').closest('article');
    expect(sessionsMetric).toHaveClass('bg-[var(--card)]');
    expect(within(sessionsMetric!).getByText('Sessions Completed')).toHaveClass(
      'text-[var(--dim)]'
    );
    const problemsSolved = screen.getByText('Problems Solved').closest('article');
    expect(within(problemsSolved!).getByText('2')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Recent Sessions' })).toBeVisible();
    expect(screen.getByText('React')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Practice Node.js' })).toBeVisible();
    expect(screen.getByText('Choose focus topics')).toBeVisible();
    expect(screen.getByText('Based on your weak areas, we recommend:')).toBeVisible();
    expect(screen.getByText('Last 1 session')).toBeVisible();
    expect(screen.getByRole('img', { name: /score trend/i })).toBeInTheDocument();
  });

  it('shows recent sessions in the reference table with score and status', () => {
    renderOverview();

    const sessionsTable = screen.getByRole('table', { name: 'Recent Sessions' });
    expect(
      within(sessionsTable)
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
    ).toEqual(['Topic', 'Date', 'Score', 'Status']);
    const sessionRow = within(sessionsTable).getByRole('row', { name: /React/ });
    const sessionScore = within(sessionRow).getByLabelText('Score: 8.0 out of 10');
    expect(sessionScore).toHaveClass('bg-[var(--green-bg)]', 'text-[var(--success-strong)]');
    expect(sessionScore.querySelector('svg')).toBeInTheDocument();
    expect(within(sessionRow).getByText('Completed')).toBeVisible();
  });

  it('uses amber and red score pills for scores below the green threshold', () => {
    const baseSession = summary.recentSessions[0];
    const { unmount } = renderOverview({
      summary: { ...summary, recentSessions: [{ ...baseSession, averageScore: 6.2 }] },
    });

    expect(screen.getByLabelText('Score: 6.2 out of 10')).toHaveClass(
      'bg-[var(--accent-bg)]',
      'text-[var(--accent-strong)]'
    );

    unmount();
    renderOverview({
      summary: { ...summary, recentSessions: [{ ...baseSession, averageScore: 4.4 }] },
    });

    expect(screen.getByLabelText('Score: 4.4 out of 10')).toHaveClass(
      'bg-[var(--red-bg)]',
      'text-[var(--danger-strong)]'
    );
  });

  it('shows an in-progress label and no fabricated score for unfinished sessions', () => {
    renderOverview({
      summary: {
        ...summary,
        recentSessions: [
          {
            id: 'session-in-progress',
            topicName: 'TypeScript',
            startedAt: '2026-11-05T07:00:00.000Z',
            status: 'in_progress',
            questionsAnswered: 2,
            totalQuestions: 5,
            averageScore: null,
          },
        ],
      },
    });

    const sessionRow = within(screen.getByRole('table', { name: 'Recent Sessions' })).getByRole(
      'row',
      { name: /TypeScript/ }
    );
    expect(within(sessionRow).getByText('—')).toBeVisible();
    expect(within(sessionRow).getByText('In progress')).toBeVisible();
  });

  it('opens the matching session detail from a recent practice session', async () => {
    const user = userEvent.setup();
    const onOpenSession = vi.fn();
    renderOverview({ onOpenSession });

    await user.click(screen.getByRole('button', { name: 'View React session' }));

    expect(onOpenSession).toHaveBeenCalledWith('session-1');
  });

  it('links the Recent Sessions panel to the complete session history', () => {
    renderOverview();

    expect(screen.getByRole('link', { name: 'View all sessions' })).toHaveAttribute(
      'href',
      '/history'
    );
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
    expect(screen.getByText('Node.js')).toBeVisible();
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
    await user.click(screen.getByRole('button', { name: 'Retry topics' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
