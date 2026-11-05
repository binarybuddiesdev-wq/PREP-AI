import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ITheorySession, ITheorySessionDetail } from '@/core';
import { SessionHistoryRow } from './SessionHistoryRow';
import type { ISessionHistoryRowProps } from './SessionHistoryRow.types';

const session: ITheorySession = {
  id: 'session-1',
  topicId: 'topic-react',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 3,
  avgScore: 7.5,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:20:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
};

const detail: ITheorySessionDetail = {
  ...session,
  answers: [
    {
      id: 'answer-queued',
      sessionId: session.id,
      questionId: 'question-1',
      questionText: 'What is a React hook?',
      userAnswer: 'A function that lets components use React features.',
      aiScore: null,
      aiFeedback: null,
      evaluationProvider: null,
      evaluationModel: null,
      evaluationPromptVersion: null,
      status: 'queued',
      failureMessage: null,
      startedAt: null,
      completedAt: null,
      timeTaken: 42,
      createdAt: '2026-11-01T10:01:00.000Z',
      updatedAt: '2026-11-01T10:01:00.000Z',
    },
    {
      id: 'answer-completed',
      sessionId: session.id,
      questionId: 'question-2',
      questionText: 'When should an effect run?',
      userAnswer: 'After render when its dependencies change.',
      aiScore: 8,
      aiFeedback: 'Good explanation of dependency-based effects.',
      evaluationProvider: 'provider',
      evaluationModel: 'model',
      evaluationPromptVersion: 'v1',
      status: 'completed',
      failureMessage: null,
      startedAt: '2026-11-01T10:02:00.000Z',
      completedAt: '2026-11-01T10:02:03.000Z',
      timeTaken: 51,
      createdAt: '2026-11-01T10:02:00.000Z',
      updatedAt: '2026-11-01T10:02:03.000Z',
    },
    {
      id: 'answer-failed',
      sessionId: session.id,
      questionId: 'question-3',
      questionText: 'What does memoization do?',
      userAnswer: 'It can cache a computed value.',
      aiScore: null,
      aiFeedback: null,
      evaluationProvider: null,
      evaluationModel: null,
      evaluationPromptVersion: null,
      status: 'failed',
      failureMessage: 'Evaluation service unavailable.',
      startedAt: '2026-11-01T10:03:00.000Z',
      completedAt: null,
      timeTaken: 62,
      createdAt: '2026-11-01T10:03:00.000Z',
      updatedAt: '2026-11-01T10:03:02.000Z',
    },
  ],
};

const createProps = (
  overrides: Partial<ISessionHistoryRowProps> = {}
): ISessionHistoryRowProps => ({
  session,
  isExpanded: true,
  detail,
  isDetailLoading: false,
  detailError: null,
  onToggle: vi.fn(),
  onRetry: vi.fn(),
  ...overrides,
});

const renderRow = (props: ISessionHistoryRowProps) =>
  render(
    <table>
      <tbody>
        <SessionHistoryRow {...props} />
      </tbody>
    </table>
  );

describe('SessionHistoryRow', () => {
  it('shows saved questions, answers, scores, feedback, and evaluation failures', () => {
    renderRow(createProps());

    expect(screen.getByRole('button', { name: /hide details/i }).closest('tr')).toHaveClass(
      'border-[var(--border)]'
    );
    expect(
      screen.getByRole('region', { name: /session answers/i }).querySelector('article')
    ).toHaveClass('bg-[var(--card)]');
    expect(screen.getByText('20 min')).toBeVisible();
    expect(screen.getByText('What is a React hook?')).toBeVisible();
    expect(screen.getByText('A function that lets components use React features.')).toBeVisible();
    expect(screen.getByText(/Evaluation queued/i)).toBeVisible();
    expect(screen.getByText('Score: 8 / 10')).toBeVisible();
    expect(screen.getByText('Good explanation of dependency-based effects.')).toBeVisible();
    expect(screen.getByText('Evaluation service unavailable.')).toBeVisible();
  });

  it('expands and collapses the saved answers through an accessible control', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderRow(createProps({ isExpanded: false, onToggle }));

    const expandButton = screen.getByRole('button', { name: /show details/i });
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(expandButton);

    expect(onToggle).toHaveBeenCalledWith(session.id);
  });

  it('keeps the session row visible while expanded details are loading', () => {
    renderRow(createProps({ detail: undefined, isDetailLoading: true }));

    const expandedButton = screen.getByRole('button', { name: /hide details/i });
    expect(expandedButton.closest('tr')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Loading saved answers');
    expect(screen.queryByText('No saved answers for this session.')).not.toBeInTheDocument();
  });

  it('offers a retry for a failed detail read without retrying the history list', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderRow(createProps({ detail: undefined, detailError: 'Try again.', onRetry }));

    await user.click(screen.getByRole('button', { name: 'Retry session details' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
