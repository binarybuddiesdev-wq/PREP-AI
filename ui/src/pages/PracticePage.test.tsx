import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPracticeTopic, ITheoryWeakArea, IUser } from '@/core';
import type { IPdfSource } from '@/core';
import { PracticePage } from './PracticePage';

const mocks = vi.hoisted(() => ({
  getHttpStatus: vi.fn(),
  useSessionReader: vi.fn(),
  useUserReader: vi.fn(),
  useTheoryPracticeReader: vi.fn(),
  useTheoryStatsReader: vi.fn(),
  usePdfSourcesReader: vi.fn(),
  useTheoryPracticeSession: vi.fn(),
  startPractice: vi.fn(),
}));

vi.mock('@/logic', () => ({
  getHttpStatus: mocks.getHttpStatus,
  getPracticePolicy: (role: string) => {
    const isPremium = role === 'PREMIUM' || role === 'ADMIN';
    return { isPremium, totalQuestions: isPremium ? 30 : 10 };
  },
  useSessionReader: mocks.useSessionReader,
  useUserReader: mocks.useUserReader,
  useTheoryPracticeReader: mocks.useTheoryPracticeReader,
  useTheoryStatsReader: mocks.useTheoryStatsReader,
  usePdfSourcesReader: mocks.usePdfSourcesReader,
  useTheoryPracticeSession: mocks.useTheoryPracticeSession,
}));

const topic: IPracticeTopic = {
  id: 'topic-react',
  name: 'React',
  slug: 'react',
  category: 'practice',
  icon: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};
const weakArea: ITheoryWeakArea = {
  topicId: 'topic-react',
  topicName: 'React',
  avgScore: 5,
  sessionsCount: 2,
  lastPracticed: '2026-11-01T00:00:00.000Z',
};
const pdfSource: IPdfSource = {
  id: 'pdf-one',
  displayName: 'React notes.pdf',
  byteSize: 2048,
  pageCount: 12,
  status: 'ready',
  activeRevision: 1,
  failureCode: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};
const user: IUser = {
  id: 'user-one',
  clerkUserId: 'clerk-one',
  email: 'user@example.com',
  name: 'Asha',
  role: 'USER',
  isNewUser: false,
};

const renderPracticePage = (initialEntry = '/') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PracticePage />
    </MemoryRouter>
  );

describe('PracticePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSessionReader.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { id: 'clerk-one' },
    });
    mocks.useUserReader.mockReturnValue({ isPending: false, isError: false, data: user });
    mocks.useTheoryPracticeReader.mockReturnValue({
      topicsQuery: { data: [topic], isPending: false, isError: false, refetch: vi.fn() },
      weakAreasQuery: { data: [weakArea], isPending: false, isError: false, refetch: vi.fn() },
    });
    mocks.useTheoryStatsReader.mockReturnValue({
      data: { dailySessions: { used: 0, limit: 3 }, questionsPerSession: 10 },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mocks.usePdfSourcesReader.mockReturnValue({
      data: [pdfSource],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useTheoryPracticeSession.mockReturnValue({
      session: null,
      phase: 'setup',
      isStarting: false,
      startError: null,
      start: mocks.startPractice,
    });
  });

  it.each([
    ['USER', 10],
    ['PREMIUM', 30],
    ['ADMIN', 30],
    ['UNKNOWN', 10],
  ])('requests the role-based count for %s (%i)', async (role, expectedCount) => {
    const userEventInstance = userEvent.setup();
    mocks.useUserReader.mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...user, role },
    });

    renderPracticePage();
    await userEventInstance.click(screen.getByRole('button', { name: 'React' }));
    await userEventInstance.click(screen.getByRole('button', { name: /Start/ }));

    expect(mocks.startPractice).toHaveBeenCalledWith({
      topicId: 'topic-react',
      mode: 'topic',
      difficulty: 'Mid',
      totalQuestions: expectedCount,
    });
  });

  it('preselects a valid practice topic from the query string', () => {
    renderPracticePage('/practice?topicId=topic-react');

    expect(screen.getByRole('button', { name: 'React' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows server-owned remaining practice sessions and retries a failed usage read', async () => {
    const userEventInstance = userEvent.setup();
    const refetch = vi.fn();
    mocks.useTheoryStatsReader.mockReturnValue({
      data: { dailySessions: { used: 2, limit: 3 }, questionsPerSession: 10 },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch,
    });

    const { rerender } = renderPracticePage();
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 sessions left today');

    mocks.useTheoryStatsReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      error: new Error('Practice usage is temporarily unavailable.'),
      refetch,
    });
    rerender(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Practice usage is temporarily unavailable.'
    );
    await userEventInstance.click(screen.getByRole('button', { name: 'Retry usage' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('explains an expired session without offering a blind quota retry', () => {
    const refetch = vi.fn();
    mocks.getHttpStatus.mockReturnValue(401);
    mocks.useTheoryStatsReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      error: new Error('Unauthorized'),
      refetch,
    });

    renderPracticePage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your session has expired. Refresh the page and sign in again.'
    );
    expect(screen.queryByRole('button', { name: /retry usage/i })).not.toBeInTheDocument();
  });

  it('hides setup quota usage while a practice session is active', () => {
    mocks.useTheoryPracticeSession.mockReturnValue({
      session: { id: 'session-one', mode: 'topic' },
      phase: 'loading',
      isStarting: false,
      startError: null,
      start: mocks.startPractice,
    });

    renderPracticePage();

    expect(screen.getByRole('status')).toHaveTextContent(/loading your questions/i);
    expect(screen.queryByText(/sessions left today/i)).not.toBeInTheDocument();
  });

  it('keeps practice setup available with free-tier limits when the profile cannot load', async () => {
    const userEventInstance = userEvent.setup();
    const refetch = vi.fn();
    mocks.useUserReader.mockReturnValue({
      isPending: false,
      isError: true,
      isFetching: false,
      error: new Error('Profile unavailable'),
      refetch,
    });

    renderPracticePage();

    expect(screen.getByRole('alert')).toHaveTextContent(/profile details unavailable/i);
    expect(screen.getByRole('alert')).toHaveTextContent('free-plan limit of 10 questions');
    expect(screen.getByRole('button', { name: 'React' })).toBeVisible();
    await userEventInstance.click(screen.getByRole('button', { name: 'Retry profile' }));
    expect(refetch).toHaveBeenCalledOnce();
    await userEventInstance.click(screen.getByRole('button', { name: 'React' }));
    await userEventInstance.click(screen.getByRole('button', { name: /Start practice/ }));
    expect(mocks.startPractice).toHaveBeenCalledWith({
      topicId: 'topic-react',
      mode: 'topic',
      difficulty: 'Mid',
      totalQuestions: 10,
    });
  });

  it('starts weak-area practice without sending a topic id', async () => {
    const userEventInstance = userEvent.setup();
    renderPracticePage();

    await userEventInstance.click(screen.getByRole('button', { name: 'Weak Areas' }));
    await userEventInstance.click(screen.getByRole('button', { name: /Start/ }));

    expect(mocks.startPractice).toHaveBeenCalledWith({
      mode: 'weak',
      difficulty: 'Mid',
      totalQuestions: 10,
    });
  });

  it('starts PDF study with the selected ready document ids', async () => {
    const userEventInstance = userEvent.setup();
    renderPracticePage();

    await userEventInstance.click(screen.getByRole('button', { name: 'PDF Study' }));
    await userEventInstance.click(screen.getByRole('checkbox', { name: /React notes.pdf/ }));
    await userEventInstance.click(screen.getByRole('button', { name: /Start practice/ }));

    expect(mocks.startPractice).toHaveBeenCalledWith({
      mode: 'pdf',
      pdfIds: ['pdf-one'],
      difficulty: 'Mid',
      totalQuestions: 10,
    });
  });

  it('clears PDF selections when their sources are no longer ready', async () => {
    const userEventInstance = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    await userEventInstance.click(screen.getByRole('button', { name: 'PDF Study' }));
    await userEventInstance.click(screen.getByRole('checkbox', { name: /React notes.pdf/ }));
    expect(screen.getByText('1 of 5 selected')).toBeVisible();

    mocks.usePdfSourcesReader.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    rerender(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('0 of 5 selected')).toBeVisible());
  });

  it('shows a terminal PDF generation error with retry and end-session recovery', async () => {
    const userEventInstance = userEvent.setup();
    const refetch = vi.fn();
    const end = vi.fn();
    mocks.useTheoryPracticeSession.mockReturnValue({
      session: { id: 'session-pdf', mode: 'pdf' },
      phase: 'error',
      questionsQuery: {
        error: new Error('PDF study questions could not be generated'),
        isFetching: false,
        refetch,
      },
      isCompleting: false,
      end,
    });

    renderPracticePage();

    expect(screen.getByRole('main')).toHaveClass('border-[var(--red-bg)]', 'bg-[var(--red-bg)]');
    expect(
      screen.getByRole('heading', { name: 'PDF questions could not be prepared' })
    ).toBeVisible();
    expect(screen.getByText('PDF study questions could not be generated')).toBeVisible();
    await userEventInstance.click(screen.getByRole('button', { name: 'Retry questions' }));
    await userEventInstance.click(screen.getByRole('button', { name: 'End session' }));

    expect(refetch).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
  });

  it('retries a failed same-topic restart instead of only completing the current session', async () => {
    const userEventInstance = userEvent.setup();
    const retryRestart = vi.fn();
    mocks.useTheoryPracticeSession.mockReturnValue({
      session: { id: 'session-one', mode: 'topic' },
      phase: 'submitted',
      activeQuestion: {
        id: 'question-one',
        question: 'What is a hook?',
        topicId: 'topic-react',
        difficulty: 'Mid',
      },
      progress: { current: 1, total: 10 },
      answerDraft: 'A function.',
      elapsedSeconds: 20,
      isSubmitting: false,
      isAnswerFrozen: false,
      submitError: null,
      setAnswerDraft: vi.fn(),
      submit: vi.fn(),
      skip: vi.fn(),
      end: vi.fn(),
      evaluation: {
        id: 'answer-one',
        sessionId: 'session-one',
        questionId: 'question-one',
        questionText: 'What is a hook?',
        userAnswer: 'A function.',
        aiScore: 8,
        aiFeedback: 'Clear explanation.',
        evaluationProvider: null,
        evaluationModel: null,
        evaluationPromptVersion: null,
        status: 'completed',
        failureMessage: null,
        startedAt: null,
        completedAt: null,
        timeTaken: 20,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
      evaluationQuery: { isError: false, isFetching: false, refetch: vi.fn() },
      isEnding: false,
      isCompleting: false,
      isRestarting: false,
      canContinue: true,
      continueAfterSubmit: vi.fn(),
      canRetryRestart: true,
      retryRestart,
      retryCompletion: vi.fn(),
      completionError: 'Temporary completion failure.',
      savedAnswers: [],
    });

    renderPracticePage();

    expect(screen.getByRole('alert')).toHaveTextContent('Temporary completion failure.');
    await userEventInstance.click(screen.getByRole('button', { name: 'Retry same-topic restart' }));

    expect(retryRestart).toHaveBeenCalledOnce();
  });
});
