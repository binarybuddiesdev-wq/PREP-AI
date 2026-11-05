import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ITheoryAnswer } from '@/core';
import { TheoryFeedback } from './TheoryFeedback';
import type { ITheoryFeedbackProps } from './TheoryFeedback.types';

const createAnswer = (
  status: ITheoryAnswer['status'],
  aiScore: number | null = null
): ITheoryAnswer => ({
  id: 'answer-one',
  sessionId: 'session-one',
  questionId: 'question-one',
  questionText: 'Question?',
  userAnswer: 'Answer.',
  aiScore,
  aiFeedback: status === 'completed' ? 'Clear explanation.' : null,
  evaluationProvider: null,
  evaluationModel: null,
  evaluationPromptVersion: null,
  status,
  failureMessage: status === 'failed' ? 'Evaluation service unavailable.' : null,
  startedAt: null,
  completedAt: null,
  timeTaken: 20,
  createdAt: '2026-11-04T07:00:00.000Z',
  updatedAt: '2026-11-04T07:00:00.000Z',
});

const createProps = (overrides: Partial<ITheoryFeedbackProps> = {}): ITheoryFeedbackProps => ({
  answer: createAnswer('queued'),
  evaluationError: null,
  isRefreshing: false,
  isEnding: false,
  isCompleting: false,
  canContinue: false,
  onRetryEvaluation: vi.fn(),
  onContinue: vi.fn(),
  onEnd: vi.fn(),
  ...overrides,
});

describe('TheoryFeedback', () => {
  it('shows progress without a fabricated score while evaluation is pending', () => {
    render(<TheoryFeedback {...createProps()} />);

    expect(screen.getByRole('status')).toHaveTextContent(/evaluation is in progress/i);
    expect(screen.queryByText(/\/10/)).not.toBeInTheDocument();
  });

  it('shows a completed zero score and returned feedback', () => {
    render(
      <TheoryFeedback
        {...createProps({ answer: createAnswer('completed', 0), canContinue: true })}
      />
    );

    expect(screen.getByRole('region', { name: 'Answer feedback' })).toHaveClass(
      'border-[var(--border)]',
      'bg-[var(--card)]'
    );
    expect(screen.getByText('0.0/10')).toHaveClass('text-[var(--accent-strong)]');
    expect(screen.getByText('0.0/10')).toBeVisible();
    expect(screen.getByText('Clear explanation.')).toBeVisible();
  });

  it('shows failed evaluations as unscored with the server failure message', () => {
    render(<TheoryFeedback {...createProps({ answer: createAnswer('failed') })} />);

    expect(screen.getByText(/not scored/i)).toBeVisible();
    expect(screen.getByText('Evaluation service unavailable.')).toBeVisible();
    expect(screen.queryByText(/\/10/)).not.toBeInTheDocument();
  });

  it('allows retry after an evaluation read error and keeps continue unavailable', async () => {
    const user = userEvent.setup();
    const onRetryEvaluation = vi.fn();
    render(
      <TheoryFeedback
        {...createProps({
          evaluationError: 'Could not refresh evaluation.',
          onRetryEvaluation,
          canContinue: false,
        })}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Retry evaluation' }));
    expect(onRetryEvaluation).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
