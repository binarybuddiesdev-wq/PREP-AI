import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ICodingExecution } from '@/core';
import { CodingReviewDialog } from '@/components/coding';
import { codingKeys, useCodingExecutionReader } from '@/logic';

const session = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true, user: { id: 'user-one' } }));
const mocks = vi.hoisted(() => ({ getCodingExecution: vi.fn() }));

vi.mock('@/logic/auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('@/logic/api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({ getCodingExecution: mocks.getCodingExecution }));

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });

const reviewExecution = (status: 'queued' | 'completed'): ICodingExecution => ({
  id: 'execution-one',
  sessionId: 'session-one',
  problemId: 'problem-one',
  operation: 'submit',
  language: 'javascript',
  status: 'completed',
  result: null,
  failureMessage: null,
  createdAt: '2026-11-05T10:00:00.000Z',
  startedAt: '2026-11-05T10:00:01.000Z',
  completedAt: '2026-11-05T10:00:02.000Z',
  answer: {
    id: 'answer-one',
    executionId: 'execution-one',
    sessionId: 'session-one',
    userId: 'user-one',
    problemId: 'problem-one',
    language: 'javascript',
    code: 'return 1;',
    status: 'accepted',
    testCasesPassed: 1,
    testCasesTotal: 1,
    runtime: null,
    memoryUsage: null,
    createdAt: '2026-11-05T10:00:00.000Z',
    aiReviewStatus: status,
    aiReviewJson:
      status === 'completed'
        ? {
            summary: 'A clear solution using one pass.',
            timeComplexity: 'O(n)',
            spaceComplexity: 'O(n)',
            strengths: ['Uses a lookup map'],
            improvements: ['Validate the input length'],
          }
        : null,
    aiReviewFailureMessage: null,
  },
});

const CodingReviewPollingPage = () => {
  const executionQuery = useCodingExecutionReader('session-one', 'execution-one');
  const answer = executionQuery.data?.answer;
  if (!answer) return null;

  return (
    <CodingReviewDialog
      isOpen
      problemTitle="Two Sum"
      answer={answer}
      isRequestPending={false}
      requestError={null}
      onOpenChange={vi.fn()}
      onRequestReview={vi.fn()}
    />
  );
};

describe('coding AI review polling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a completed review in the dialog after polling returns the result', async () => {
    mocks.getCodingExecution
      .mockResolvedValueOnce(envelope(reviewExecution('queued')))
      .mockResolvedValueOnce(envelope(reviewExecution('completed')));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <CodingReviewPollingPage />
      </QueryClientProvider>
    );

    expect(await screen.findByRole('status')).toHaveTextContent('Your AI review is queued');
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: codingKeys.execution('user-one', 'session-one', 'execution-one'),
      });
    });

    expect(await screen.findByText('A clear solution using one pass.')).toBeInTheDocument();
    expect(screen.getAllByText('O(n)')).toHaveLength(2);
    expect(screen.getByText('Uses a lookup map')).toBeInTheDocument();
    expect(screen.getByText('Validate the input length')).toBeInTheDocument();
  });
});
