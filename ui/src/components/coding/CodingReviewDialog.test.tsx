import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ICodingExecutionAnswer } from '@/core';
import { CodingReviewDialog } from './CodingReviewDialog';
import type { ICodingReviewDialogProps } from './CodingReviewDialog.types';

const answer: ICodingExecutionAnswer = {
  id: 'answer-one',
  executionId: 'execution-one',
  sessionId: 'session-one',
  userId: 'user-one',
  problemId: 'problem-one',
  language: 'javascript',
  code: 'function twoSum() {}',
  status: 'accepted',
  testCasesPassed: 1,
  testCasesTotal: 1,
  runtime: null,
  memoryUsage: null,
  createdAt: '2026-11-05T10:00:00.000Z',
  aiReviewStatus: 'completed',
  aiReviewJson: {
    summary: 'A clear, direct solution.',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    strengths: ['Uses a single pass'],
    improvements: ['Validate the input length'],
  },
  aiReviewFailureMessage: null,
};

const createProps = (
  overrides: Partial<ICodingReviewDialogProps> = {}
): ICodingReviewDialogProps => ({
  isOpen: true,
  problemTitle: 'Two Sum',
  answer,
  isRequestPending: false,
  requestError: null,
  onOpenChange: vi.fn(),
  onRequestReview: vi.fn(),
  ...overrides,
});

describe('CodingReviewDialog', () => {
  it('does not render the review dialog while closed', () => {
    render(<CodingReviewDialog {...createProps({ isOpen: false })} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows returned review feedback and reports when the user closes it', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<CodingReviewDialog {...props} />);

    const dialog = await screen.findByRole('dialog', { name: 'AI Review: Two Sum' });
    expect(dialog).toHaveClass('border-[var(--border)]', 'bg-[var(--card)]');
    expect(screen.getByRole('heading', { name: 'AI Review: Two Sum' })).toHaveClass(
      'text-[var(--text-h)]'
    );
    expect(dialog).toHaveTextContent('A clear, direct solution.');
    expect(dialog).toHaveTextContent('O(n)');
    expect(screen.getAllByText('O(n)')[0].closest('section')).toHaveClass(
      'border-[var(--border)]',
      'bg-[var(--surface)]'
    );
    expect(screen.getByRole('heading', { name: 'Strengths' })).toHaveClass(
      'text-[var(--success-strong)]'
    );
    expect(dialog).toHaveTextContent('Uses a single pass');
    expect(dialog).toHaveTextContent('Validate the input length');

    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('shows theme-aware pending and retryable error feedback', async () => {
    const user = userEvent.setup();
    const onRequestReview = vi.fn();
    const pendingAnswer = {
      ...answer,
      aiReviewStatus: 'not_requested' as const,
      aiReviewJson: null,
    };
    const { rerender } = render(
      <CodingReviewDialog
        {...createProps({ answer: pendingAnswer, isRequestPending: true, onRequestReview })}
      />
    );

    expect(await screen.findByRole('status')).toHaveClass(
      'border-[var(--border)]',
      'bg-[var(--surface)]'
    );
    expect(screen.getByRole('status')).toHaveTextContent('Sending your review request');

    rerender(
      <CodingReviewDialog
        {...createProps({
          answer: pendingAnswer,
          requestError: { message: 'Daily AI review limit reached.', canRetry: true },
          onRequestReview,
        })}
      />
    );
    expect(screen.getByRole('alert')).toHaveClass(
      'border-[var(--red-bg)]',
      'bg-[var(--red-bg)]',
      'text-[var(--danger-strong)]'
    );
    await user.click(screen.getByRole('button', { name: 'Retry AI Review' }));
    expect(onRequestReview).toHaveBeenCalledOnce();
  });
});
