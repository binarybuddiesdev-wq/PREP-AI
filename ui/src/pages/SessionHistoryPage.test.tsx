import { render, screen } from '@testing-library/react';
import { HTTPError } from 'ky';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ICodingProblemSummary,
  ICodingSession,
  ICodingSessionDetail,
  ICodingSessionHistory,
  ITheorySession,
  ITheorySessionHistory,
} from '@/core';
import { SessionHistoryPage } from './SessionHistoryPage';

const mocks = vi.hoisted(() => ({
  useTheorySessionHistoryReader: vi.fn(),
  useTheorySessionDetailReader: vi.fn(),
  useCodingSessionHistoryReader: vi.fn(),
  useCodingSessionDetailReader: vi.fn(),
  useCodingProblemsReader: vi.fn(),
}));

vi.mock('@/logic', () => ({
  useTheorySessionHistoryReader: mocks.useTheorySessionHistoryReader,
  useTheorySessionDetailReader: mocks.useTheorySessionDetailReader,
  useCodingSessionHistoryReader: mocks.useCodingSessionHistoryReader,
  useCodingSessionDetailReader: mocks.useCodingSessionDetailReader,
  useCodingProblemsReader: mocks.useCodingProblemsReader,
}));

const history: ITheorySessionHistory = {
  sessions: [],
  total: 0,
  page: 1,
  limit: 10,
};

const session: ITheorySession = {
  id: 'session-1',
  topicId: 'topic-react',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 1,
  avgScore: 7,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:15:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
};
const codingHistory: ICodingSessionHistory = {
  sessions: [],
  total: 0,
  page: 1,
  limit: 20,
};
const codingSession: ICodingSession = {
  id: 'coding-session-1',
  problemIds: ['problem-one'],
  problemsAttempted: 2,
  problemsSolved: 1,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:12:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
};
const codingSessionDetail: ICodingSessionDetail = {
  ...codingSession,
  userId: 'user-one',
  answers: [
    {
      id: 'answer-one',
      executionId: 'execution-one',
      sessionId: codingSession.id,
      userId: 'user-one',
      problemId: 'problem-one',
      language: 'javascript',
      code: 'return 42;',
      status: 'accepted',
      testCasesPassed: 3,
      testCasesTotal: 3,
      runtime: 5,
      memoryUsage: 8,
      createdAt: '2026-11-01T10:10:00.000Z',
      aiReviewStatus: 'not_requested',
      aiReviewJson: null,
      aiReviewFailureMessage: null,
    },
  ],
};
const codingProblem: ICodingProblemSummary = {
  id: 'problem-one',
  title: 'Two Sum',
  slug: 'two-sum',
  description: 'Find two values that add to the target.',
  difficulty: 'Easy',
  topic: 'Arrays',
  isSolved: true,
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/history']}>
      <Routes>
        <Route path="/history" element={<SessionHistoryPage />} />
        <Route path="/practice" element={<h1>Practice setup</h1>} />
        <Route path="/coding" element={<h1>Coding practice</h1>} />
      </Routes>
    </MemoryRouter>
  );

describe('SessionHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useTheorySessionHistoryReader.mockReturnValue({
      data: history,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useTheorySessionDetailReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useCodingSessionHistoryReader.mockReturnValue({
      data: codingHistory,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useCodingSessionDetailReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useCodingProblemsReader.mockReturnValue({
      data: [codingProblem],
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
    });
  });

  it('reads the first page and opens practice from the empty state', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: 'Session History' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Session History' })).toHaveClass(
      'text-[1.35rem]',
      'font-bold'
    );
    expect(
      screen.queryByText('Review your practice sessions, coding attempts, and saved feedback.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveClass('bg-[var(--accent-bg)]');
    expect(screen.getByRole('tab', { name: 'Coding' })).toHaveClass('text-[var(--dim)]');
    expect(screen.getByRole('heading', { name: 'No sessions yet' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start Practicing' }));

    expect(await screen.findByRole('heading', { name: 'Practice setup' })).toBeVisible();
    expect(mocks.useTheorySessionHistoryReader).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('loads the next server page when the learner advances pagination', async () => {
    const user = userEvent.setup();
    mocks.useTheorySessionHistoryReader.mockReturnValue({
      data: { ...history, sessions: [session], total: 25 },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(mocks.useTheorySessionHistoryReader).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
  });

  it('loads and collapses one session detail at a time', async () => {
    const user = userEvent.setup();
    mocks.useTheorySessionHistoryReader.mockReturnValue({
      data: { ...history, sessions: [session], total: 1 },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    const showDetails = screen.getByRole('button', { name: /show details/i });
    await user.click(showDetails);
    expect(mocks.useTheorySessionDetailReader).toHaveBeenLastCalledWith(session.id);
    expect(screen.getByRole('button', { name: /hide details/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await user.click(screen.getByRole('button', { name: /hide details/i }));
    expect(mocks.useTheorySessionDetailReader).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('button', { name: /show details/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('shows the history error and retries the history query', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useTheorySessionHistoryReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: true,
      error: new Error('History API unavailable.'),
      refetch,
    });
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('History API unavailable.');
    await user.click(screen.getByRole('button', { name: 'Retry history' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows actionable guidance when the history API returns an internal error', () => {
    const error = new HTTPError(
      new Response(null, { status: 500 }),
      new Request('http://api.test/api/v1/theory/sessions'),
      {} as never
    );
    error.message = 'Internal server error';
    mocks.useTheorySessionHistoryReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: true,
      error,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't load your practice session history because the API returned HTTP 500. Check the backend/database and retry."
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('Internal server error');
  });

  it('loads real coding sessions only after selecting the Coding tab', async () => {
    const user = userEvent.setup();
    mocks.useCodingSessionHistoryReader.mockReturnValue({
      data: { ...codingHistory, sessions: [codingSession], total: 1 },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    expect(mocks.useCodingSessionHistoryReader).toHaveBeenLastCalledWith(
      { page: 1, limit: 20 },
      false
    );
    await user.click(screen.getByRole('tab', { name: 'Coding' }));

    expect(mocks.useCodingSessionHistoryReader).toHaveBeenLastCalledWith(
      { page: 1, limit: 20 },
      true
    );
    expect(screen.getByRole('table', { name: 'Coding session history' })).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('1')).toBeVisible();
  });

  it('moves between history tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    renderPage();
    const practiceTab = screen.getByRole('tab', { name: 'Practice' });
    const codingTab = screen.getByRole('tab', { name: 'Coding' });

    practiceTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(codingTab).toHaveAttribute('aria-selected', 'true');
    expect(codingTab).toHaveFocus();
    await user.keyboard('{ArrowLeft}');

    expect(practiceTab).toHaveAttribute('aria-selected', 'true');
    expect(practiceTab).toHaveFocus();
  });

  it('shows a retryable coding history error after selecting the Coding tab', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useCodingSessionHistoryReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: true,
      error: new Error('Coding history API unavailable.'),
      refetch,
    });
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Coding' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Coding history API unavailable.');
    await user.click(screen.getByRole('button', { name: 'Retry coding history' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('navigates into coding practice from the coding history empty state', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Coding' }));
    expect(screen.getByRole('heading', { name: 'No coding sessions yet' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start coding practice' }));

    expect(await screen.findByRole('heading', { name: 'Coding practice' })).toBeVisible();
  });

  it('loads real coding submissions and resolves their problem title when a row expands', async () => {
    const user = userEvent.setup();
    mocks.useCodingSessionHistoryReader.mockReturnValue({
      data: { ...codingHistory, sessions: [codingSession], total: 1 },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useCodingSessionDetailReader.mockReturnValue({
      data: codingSessionDetail,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Coding' }));
    await user.click(screen.getByRole('button', { name: /show submissions/i }));

    expect(mocks.useCodingSessionDetailReader).toHaveBeenLastCalledWith(codingSession.id);
    expect(screen.getByRole('heading', { name: 'Two Sum' })).toBeVisible();
    expect(screen.getByText('return 42;')).toBeVisible();
  });

  it('explains catalogue failures and lets the learner retry problem-title loading', async () => {
    const user = userEvent.setup();
    const retryProblemTitles = vi.fn();
    mocks.useCodingSessionHistoryReader.mockReturnValue({
      data: { ...codingHistory, sessions: [codingSession], total: 1 },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useCodingSessionDetailReader.mockReturnValue({
      data: codingSessionDetail,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useCodingProblemsReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: true,
      error: new Error('Coding catalogue unavailable.'),
      refetch: retryProblemTitles,
    });
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Coding' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Problem titles could not be loaded. Showing problem IDs instead.'
    );
    await user.click(screen.getByRole('button', { name: /show submissions/i }));
    expect(screen.getByRole('heading', { name: 'Problem ID: problem-one' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry problem titles' }));

    expect(retryProblemTitles).toHaveBeenCalledOnce();
  });

  it('keeps independent pagination positions when switching history tabs', async () => {
    const user = userEvent.setup();
    mocks.useTheorySessionHistoryReader.mockReturnValue({
      data: { ...history, sessions: [session], total: 25 },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useCodingSessionHistoryReader.mockReturnValue({
      data: { ...codingHistory, sessions: [codingSession], total: 45 },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.click(screen.getByRole('tab', { name: 'Coding' }));
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(mocks.useCodingSessionHistoryReader).toHaveBeenLastCalledWith(
      { page: 2, limit: 20 },
      true
    );

    await user.click(screen.getByRole('tab', { name: 'Practice' }));
    expect(mocks.useTheorySessionHistoryReader).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
  });
});
