import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ITheorySessionDetail } from '@/core';
import { TheorySessionDetail } from './TheorySessionDetail';
import type { ITheorySessionDetailProps } from './TheorySessionDetail.types';

const session: ITheorySessionDetail = {
  id: 'session-1',
  topicId: 'topic-react',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 1,
  avgScore: 0,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:15:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
  answers: [
    {
      id: 'answer-1',
      sessionId: 'session-1',
      questionId: 'question-1',
      questionText: 'What is a hook?',
      userAnswer: 'A function for using React features.',
      aiScore: 0,
      aiFeedback: 'The answer needs more detail.',
      evaluationProvider: 'provider',
      evaluationModel: 'model',
      evaluationPromptVersion: 'v1',
      status: 'completed',
      failureMessage: null,
      startedAt: '2026-11-01T10:01:00.000Z',
      completedAt: '2026-11-01T10:01:02.000Z',
      timeTaken: 25,
      createdAt: '2026-11-01T10:01:00.000Z',
      updatedAt: '2026-11-01T10:01:02.000Z',
    },
  ],
};

const createProps = (
  overrides: Partial<ITheorySessionDetailProps> = {}
): ITheorySessionDetailProps => ({
  session,
  isCompleting: false,
  completionError: null,
  onComplete: vi.fn(),
  onReturnToHistory: vi.fn(),
  ...overrides,
});

describe('TheorySessionDetail', () => {
  it('shows session facts, saved answers, and a real zero score', () => {
    render(<TheorySessionDetail {...createProps()} />);

    expect(screen.getByRole('heading', { name: 'Session details' })).toBeVisible();
    expect(screen.getByText('0.0 / 10')).toBeVisible();
    expect(screen.getByText('What is a hook?')).toBeVisible();
    expect(screen.getByText('A function for using React features.')).toBeVisible();
    expect(screen.getByText('The answer needs more detail.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('offers a return to history action', async () => {
    const user = userEvent.setup();
    const onReturnToHistory = vi.fn();
    render(<TheorySessionDetail {...createProps({ onReturnToHistory })} />);

    await user.click(screen.getByRole('button', { name: 'Back to history' }));

    expect(onReturnToHistory).toHaveBeenCalledOnce();
  });
});
