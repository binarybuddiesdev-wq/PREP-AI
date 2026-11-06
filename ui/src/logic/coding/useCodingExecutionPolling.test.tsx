import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ICodingExecution } from '@/core';
import { useCodingExecutionReader } from './useCodingExecutionReader';

const mocks = vi.hoisted(() => ({
  getCodingExecution: vi.fn(),
}));

vi.mock('../auth', () => ({
  useSessionReader: () => ({ isLoaded: true, isSignedIn: true, user: { id: 'user-one' } }),
}));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({ getCodingExecution: mocks.getCodingExecution }));

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });

const execution = (status: 'queued' | 'completed'): ICodingExecution => ({
  id: 'execution-one',
  sessionId: 'session-one',
  problemId: 'problem-one',
  operation: 'run',
  language: 'javascript',
  status,
  result:
    status === 'completed'
      ? {
          status: 'accepted',
          testCasesPassed: 1,
          testCasesTotal: 1,
          testCases: [{ input: [2, 7], expected: [0, 1], got: [0, 1], passed: true }],
          runtime: null,
          memoryUsage: null,
        }
      : null,
  failureMessage: null,
  createdAt: '2026-11-06T03:10:58.433Z',
  startedAt: status === 'completed' ? '2026-11-06T03:10:58.500Z' : null,
  completedAt: status === 'completed' ? '2026-11-06T03:10:58.722Z' : null,
  answer: null,
});

const ExecutionStatusView = () => {
  const query = useCodingExecutionReader('session-one', 'execution-one');
  if (!query.data) return <p role="status">Loading execution…</p>;

  return (
    <section aria-label="Execution result">
      <p role="status">Execution {query.data.status}</p>
      {query.data.result ? (
        <p>
          {query.data.result.testCasesPassed} of {query.data.result.testCasesTotal} test cases
          passed
        </p>
      ) : null}
    </section>
  );
};

describe('coding execution status polling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates from queued to completed results automatically when the worker finishes', async () => {
    mocks.getCodingExecution
      .mockResolvedValueOnce(envelope(execution('queued')))
      .mockResolvedValueOnce(envelope(execution('completed')));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ExecutionStatusView />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Execution queued')).toBeVisible();
    expect(
      await screen.findByText('1 of 1 test cases passed', {}, { timeout: 3000 })
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Execution completed');
    expect(mocks.getCodingExecution).toHaveBeenCalledTimes(2);
  });
});
