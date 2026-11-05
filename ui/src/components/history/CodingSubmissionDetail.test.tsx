import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ICodingExecutionAnswer } from '@/core';
import { CodingSubmissionDetail } from './CodingSubmissionDetail';

const answer: ICodingExecutionAnswer = {
  id: 'answer-one',
  executionId: 'execution-one',
  sessionId: 'session-one',
  userId: 'user-one',
  problemId: 'problem-one',
  language: 'javascript',
  code: 'return 42;',
  status: 'accepted',
  testCasesPassed: 2,
  testCasesTotal: 2,
  runtime: 5,
  memoryUsage: 8,
  createdAt: '2026-11-01T10:10:00.000Z',
  aiReviewStatus: 'not_requested',
  aiReviewJson: null,
  aiReviewFailureMessage: null,
};

describe('CodingSubmissionDetail', () => {
  it('announces queued AI reviews as a status update', () => {
    render(
      <CodingSubmissionDetail
        answer={{ ...answer, aiReviewStatus: 'queued' }}
        problemTitle="Two Sum"
      />
    );

    expect(screen.getByRole('article')).toHaveClass('bg-[var(--card)]');
    expect(screen.getByRole('status')).toHaveTextContent('AI review queued.');
  });

  it('announces running AI reviews as a status update', () => {
    render(
      <CodingSubmissionDetail
        answer={{ ...answer, aiReviewStatus: 'running' }}
        problemTitle="Two Sum"
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('AI review in progress.');
  });

  it('announces failed AI reviews as an alert with the service error', () => {
    render(
      <CodingSubmissionDetail
        answer={{
          ...answer,
          aiReviewStatus: 'failed',
          aiReviewFailureMessage: 'review_unavailable',
        }}
        problemTitle="Two Sum"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The AI review service was unavailable for this submission.'
    );
  });
});
