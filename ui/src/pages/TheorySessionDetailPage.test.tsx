import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITheoryAnswer, ITheorySessionDetail } from '@/core';
import { TheorySessionDetailPage } from './TheorySessionDetailPage';

const mocks = vi.hoisted(() => ({
  useTheorySessionDetailReader: vi.fn(),
  useTheoryCompleteSessionCommand: vi.fn(),
  getHttpStatus: vi.fn(),
}));

vi.mock('@/logic', () => ({
  getHttpStatus: mocks.getHttpStatus,
  useTheorySessionDetailReader: mocks.useTheorySessionDetailReader,
  useTheoryCompleteSessionCommand: mocks.useTheoryCompleteSessionCommand,
}));

const answer = (status: ITheoryAnswer['status']): ITheoryAnswer => ({
  id: 'answer-1',
  sessionId: 'session-1',
  questionId: 'question-1',
  questionText: 'What is a hook?',
  userAnswer: 'A function for using React features.',
  aiScore: status === 'completed' ? 7 : null,
  aiFeedback: status === 'completed' ? 'Clear answer.' : null,
  evaluationProvider: status === 'completed' ? 'provider' : null,
  evaluationModel: status === 'completed' ? 'model' : null,
  evaluationPromptVersion: status === 'completed' ? 'v1' : null,
  status,
  failureMessage: status === 'failed' ? 'Evaluation could not finish.' : null,
  startedAt: '2026-11-01T10:01:00.000Z',
  completedAt: status === 'completed' ? '2026-11-01T10:01:02.000Z' : null,
  timeTaken: 25,
  createdAt: '2026-11-01T10:01:00.000Z',
  updatedAt: '2026-11-01T10:01:02.000Z',
});

const detail = (status: ITheoryAnswer['status']): ITheorySessionDetail => ({
  id: 'session-1',
  topicId: 'topic-react',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 1,
  avgScore: status === 'completed' ? 7 : 0,
  status: 'in_progress',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  answers: [answer(status)],
});

const renderPage = (initialPath = '/history/session-1') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/history/:sessionId" element={<TheorySessionDetailPage />} />
        <Route path="/history" element={<h1>Session History</h1>} />
      </Routes>
    </MemoryRouter>
  );

describe('TheorySessionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHttpStatus.mockReturnValue(undefined);
    mocks.useTheorySessionDetailReader.mockReturnValue({
      data: detail('failed'),
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useTheoryCompleteSessionCommand.mockReturnValue({
      isPending: false,
      isError: false,
      error: null,
      isSuccess: false,
      data: undefined,
      mutate: vi.fn(),
      reset: vi.fn(),
    });
  });

  it('shows a not-found message and returns to history for a missing session', async () => {
    const user = userEvent.setup();
    mocks.useTheorySessionDetailReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Session not found'),
      refetch: vi.fn(),
    });
    mocks.getHttpStatus.mockReturnValue(404);
    renderPage();

    expect(screen.getByRole('main')).toHaveClass('border-[var(--border)]', 'bg-[var(--card)]');
    expect(screen.getByRole('heading', { name: 'Session not found' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to history' }));

    expect(await screen.findByRole('heading', { name: 'Session History' })).toBeVisible();
  });

  it('does not request a blank session ID', () => {
    renderPage('/history/%20%20');

    expect(screen.getByRole('main')).toHaveClass('border-[var(--border)]', 'bg-[var(--card)]');
    expect(screen.getByRole('heading', { name: 'Session ID is missing' })).toBeVisible();
    expect(mocks.useTheorySessionDetailReader).toHaveBeenCalledWith('');
  });

  it('retries unexpected session detail failures', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useTheorySessionDetailReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Session service unavailable'),
      refetch,
    });
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('Session service unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('waits for queued or running evaluations before offering saved-session completion', () => {
    mocks.useTheorySessionDetailReader.mockReturnValue({
      data: detail('running'),
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByRole('status')).toHaveClass('text-[var(--accent-strong)]');
    expect(screen.getByRole('status')).toHaveTextContent(/evaluation is still in progress/i);
    expect(screen.queryByRole('button', { name: 'Finish saved session' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('finishes an in-progress session once all saved evaluations are terminal', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mocks.useTheorySessionDetailReader.mockReturnValue({
      data: detail('failed'),
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useTheoryCompleteSessionCommand.mockReturnValue({
      isPending: false,
      isError: false,
      error: null,
      isSuccess: false,
      data: undefined,
      mutate,
      reset: vi.fn(),
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Finish saved session' }));

    expect(mutate).toHaveBeenCalledWith('session-1');
    expect(screen.getByText('Evaluation could not finish.')).toBeVisible();
  });

  it('shows a completion failure and keeps a retry action available', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mocks.useTheoryCompleteSessionCommand.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error('Session could not be completed.'),
      isSuccess: false,
      data: undefined,
      mutate,
      reset: vi.fn(),
    });
    renderPage();

    expect(screen.getByRole('alert')).toHaveClass('border-[var(--red-bg)]', 'bg-[var(--red-bg)]');
    expect(screen.getByText('Session could not be completed.')).toHaveClass(
      'text-[var(--danger-strong)]'
    );
    await user.click(screen.getByRole('button', { name: 'Finish saved session' }));

    expect(mutate).toHaveBeenCalledWith('session-1');
  });

  it('renders the completed server session after completion succeeds', () => {
    const completedSession = { ...detail('failed'), status: 'completed' as const };
    mocks.useTheorySessionDetailReader.mockReturnValue({
      data: detail('failed'),
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useTheoryCompleteSessionCommand.mockReturnValue({
      isPending: false,
      isError: false,
      error: null,
      isSuccess: true,
      data: completedSession,
      mutate: vi.fn(),
      reset: vi.fn(),
    });
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Session completed.');
    expect(screen.queryByRole('button', { name: 'Finish saved session' })).not.toBeInTheDocument();
  });
});
