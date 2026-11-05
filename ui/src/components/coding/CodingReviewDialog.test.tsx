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
    expect(dialog).toHaveTextContent('A clear, direct solution.');
    expect(dialog).toHaveTextContent('O(n)');
    expect(dialog).toHaveTextContent('Uses a single pass');
    expect(dialog).toHaveTextContent('Validate the input length');

    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});
