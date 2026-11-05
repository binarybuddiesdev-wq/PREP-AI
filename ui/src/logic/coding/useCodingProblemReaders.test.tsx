import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ICodingProblem, ICodingProblemSummary } from '@/core';
import { getCodingProblem, getCodingProblems } from '@/service/api';
import { useCodingProblemReader, useCodingProblemsReader } from './useCodingProblemReaders';
import { codingKeys } from './coding.keys';

const session = vi.hoisted(() => ({
  isLoaded: false,
  isSignedIn: true,
  user: { id: 'user-one' as string | undefined },
}));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  getCodingProblem: vi.fn(),
  getCodingProblems: vi.fn(),
}));

const summary: ICodingProblemSummary = {
  id: 'problem-one',
  title: 'Two Sum',
  slug: 'two-sum',
  description: 'Find two values that add to the target.',
  difficulty: 'Easy',
  topic: 'Arrays',
  isSolved: false,
};
const detail: ICodingProblem = {
  id: summary.id,
  title: summary.title,
  slug: summary.slug,
  description: summary.description,
  difficulty: summary.difficulty,
  topic: summary.topic,
  examples: [{ input: [[2, 7], 9], output: [0, 1] }],
  constraints: ['Two values exist.'],
  codeJs: 'function solution() {}',
  codeTs: 'function solution(): void {}',
  codePy: 'def solution():\n    pass',
};
const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('coding problem readers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = false;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it('waits for Clerk before loading the user-scoped problem catalogue', async () => {
    vi.mocked(getCodingProblems).mockResolvedValue(envelope([summary]));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(() => useCodingProblemsReader(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCodingProblems).not.toHaveBeenCalled();
    session.isLoaded = true;
    await act(async () => rerender());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCodingProblems).toHaveBeenCalledWith({});
    expect(result.current.data).toEqual([summary]);
    expect(
      queryClient.getQueryCache().find({ queryKey: codingKeys.problems('user-one') })
    ).toBeDefined();
  });

  it('loads a deep-linked problem by slug into the current user cache', async () => {
    vi.mocked(getCodingProblem).mockResolvedValue(envelope(detail));
    session.isLoaded = true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCodingProblemReader('two-sum'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCodingProblem).toHaveBeenCalledWith({}, 'two-sum');
    expect(result.current.data).toEqual(detail);
    expect(
      queryClient.getQueryCache().find({ queryKey: codingKeys.problem('user-one', 'two-sum') })
    ).toBeDefined();
  });

  it('does not request a detail without an authenticated user and problem identifier', () => {
    session.isLoaded = true;
    session.isSignedIn = false;
    session.user = { id: undefined };
    const { result } = renderHook(() => useCodingProblemReader(''), {
      wrapper: createWrapper(new QueryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCodingProblem).not.toHaveBeenCalled();
  });

  it('keeps the problem catalogue idle until its screen is selected', () => {
    session.isLoaded = true;
    const { result } = renderHook(() => useCodingProblemsReader(false), {
      wrapper: createWrapper(new QueryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCodingProblems).not.toHaveBeenCalled();
  });

  it('keeps request failures available to the page retry state', async () => {
    const error = new Error('Coding catalogue unavailable');
    vi.mocked(getCodingProblems).mockRejectedValue(error);
    session.isLoaded = true;
    const { result } = renderHook(() => useCodingProblemsReader(), {
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(result.current.refetch).toBeTypeOf('function');
  });
});
