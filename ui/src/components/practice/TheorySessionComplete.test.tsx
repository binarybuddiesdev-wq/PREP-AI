import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ITheoryAnswer, ITheorySession } from '@/core';
import { TheorySessionComplete } from './TheorySessionComplete';

const session: ITheorySession = {
  id: 'session-one',
  topicId: 'topic-one',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 0,
  avgScore: 0,
  status: 'completed',
  startedAt: '2026-11-04T07:00:00.000Z',
  completedAt: '2026-11-04T07:10:00.000Z',
  createdAt: '2026-11-04T07:00:00.000Z',
};

const answer: ITheoryAnswer = {
  id: 'answer-one',
  sessionId: 'session-one',
  questionId: 'question-one',
  questionText: 'Question?',
  userAnswer: 'Answer.',
  aiScore: 0,
  aiFeedback: 'Incomplete.',
  evaluationProvider: null,
  evaluationModel: null,
  evaluationPromptVersion: null,
  status: 'completed',
  failureMessage: null,
  startedAt: null,
  completedAt: null,
  timeTaken: 10,
  createdAt: '2026-11-04T07:00:00.000Z',
  updatedAt: '2026-11-04T07:00:00.000Z',
};

describe('TheorySessionComplete', () => {
  it('distinguishes a real zero average from a session with no scored answers', () => {
    const onPracticeAgain = vi.fn();
    const onGoToDashboard = vi.fn();
    const { rerender } = render(
      <TheorySessionComplete
        session={{ ...session, questionsAnswered: 1 }}
        answers={[answer]}
        onPracticeAgain={onPracticeAgain}
        onGoToDashboard={onGoToDashboard}
      />
    );

    expect(screen.getByRole('main')).toHaveClass(
      'max-w-[30rem]',
      'rounded-2xl',
      'p-6',
      'sm:p-10',
      'text-center',
      'border-[var(--border)]',
      'bg-[var(--card)]'
    );
    expect(screen.getByText('0.0')).toBeVisible();
    const metrics = document.querySelector('dl')!;
    expect(metrics).toHaveClass('flex', 'justify-center', 'gap-8');
    expect(within(metrics).getByText('Questions').parentElement).toHaveTextContent('1');
    expect(within(metrics).getByText('Avg Score').parentElement).toHaveTextContent('0.0');
    expect(within(metrics).getByText('Time').parentElement).toHaveTextContent('10m');
    expect(within(metrics).getByText('1').parentElement?.querySelector('dd')).toHaveClass(
      'text-[1.8rem]'
    );
    expect(screen.getByRole('button', { name: 'Back to Practice' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeVisible();

    rerender(
      <TheorySessionComplete
        session={session}
        answers={[]}
        onPracticeAgain={onPracticeAgain}
        onGoToDashboard={onGoToDashboard}
      />
    );
    expect(screen.getByText(/no scored answers/i)).toBeVisible();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    expect(screen.getByText(/no scored answers/i)).toHaveClass('text-xs', 'break-words');
  });

  it('reports submitted and failed answers without treating failures as scores', () => {
    const failedAnswer = {
      ...answer,
      id: 'answer-failed',
      aiScore: null,
      status: 'failed' as const,
    };
    render(
      <TheorySessionComplete
        session={{ ...session, questionsAnswered: 1 }}
        answers={[failedAnswer]}
        onPracticeAgain={vi.fn()}
        onGoToDashboard={vi.fn()}
      />
    );

    const metrics = document.querySelector('dl')!;
    expect(within(metrics).getByText('Questions').parentElement).toHaveTextContent('1');
    expect(screen.getByText(/1 answer could not be scored/i)).toBeVisible();
    expect(screen.getByText(/no scored answers/i)).toBeVisible();
  });

  it('returns to practice setup when requested', async () => {
    const user = userEvent.setup();
    const onPracticeAgain = vi.fn();
    render(
      <TheorySessionComplete
        session={session}
        answers={[]}
        onPracticeAgain={onPracticeAgain}
        onGoToDashboard={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Back to Practice' }));
    expect(onPracticeAgain).toHaveBeenCalledOnce();
  });

  it('navigates to the dashboard when requested', async () => {
    const user = userEvent.setup();
    const onGoToDashboard = vi.fn();
    render(
      <TheorySessionComplete
        session={session}
        answers={[]}
        onPracticeAgain={vi.fn()}
        onGoToDashboard={onGoToDashboard}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Go to Dashboard' }));

    expect(onGoToDashboard).toHaveBeenCalledOnce();
  });
});
