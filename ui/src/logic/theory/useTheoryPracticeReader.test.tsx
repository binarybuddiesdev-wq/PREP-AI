import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPracticeTopics, getTheorySessionQuestions, getTheoryWeakAreas } from '@/service/api';
import {
  useTheoryPracticeReader,
  useTheorySessionQuestionsReader,
} from './useTheoryPracticeReader';

const session = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true, user: { id: 'user-one' } }));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({
  getPracticeTopics: vi.fn(),
  getTheorySessionQuestions: vi.fn(),
  getTheoryWeakAreas: vi.fn(),
}));

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const createWrapper = (
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
};

describe('theory practice readers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = true;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it('loads topics and weak areas with user-scoped keys', async () => {
    vi.mocked(getPracticeTopics).mockResolvedValue(envelope([]));
    vi.mocked(getTheoryWeakAreas).mockResolvedValue(envelope([]));
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useTheoryPracticeReader(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.topicsQuery.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.weakAreasQuery.isSuccess).toBe(true));
    expect(getPracticeTopics).toHaveBeenCalledOnce();
    expect(getTheoryWeakAreas).toHaveBeenCalledOnce();
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey)
    ).toEqual(
      expect.arrayContaining([
        ['prepai', 'theory', 'user-one', 'practice-topics'],
        ['prepai', 'theory', 'user-one', 'weak-areas'],
      ])
    );
  });

  it('keeps configuration and question queries idle until auth and the session id are ready', () => {
    session.isLoaded = false;
    session.isSignedIn = false;
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () => ({ ...useTheoryPracticeReader(), questions: useTheorySessionQuestionsReader('', 10) }),
      { wrapper: Wrapper }
    );

    expect(result.current.topicsQuery.fetchStatus).toBe('idle');
    expect(result.current.weakAreasQuery.fetchStatus).toBe('idle');
    expect(result.current.questions.fetchStatus).toBe('idle');
    expect(getPracticeTopics).not.toHaveBeenCalled();
    expect(getTheoryWeakAreas).not.toHaveBeenCalled();
    expect(getTheorySessionQuestions).not.toHaveBeenCalled();
  });

  it('loads questions only for an authenticated session and includes the limit in its cache key', async () => {
    vi.mocked(getTheorySessionQuestions).mockResolvedValue(envelope([]));
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useTheorySessionQuestionsReader('session-one', 10), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTheorySessionQuestions).toHaveBeenCalledWith({}, 'session-one', 10);
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey)
    ).toContainEqual(['prepai', 'theory', 'user-one', 'session', 'session-one', 'questions', 10]);
  });

  it('keeps API failures visible to the caller for its retry state', async () => {
    const error = new Error('Topics are unavailable');
    vi.mocked(getPracticeTopics).mockRejectedValue(error);
    vi.mocked(getTheoryWeakAreas).mockResolvedValue(envelope([]));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTheoryPracticeReader(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.topicsQuery.isError).toBe(true));
    expect(result.current.topicsQuery.error).toBe(error);
  });

  it('polls PDF questions only while the server reports generation is pending', async () => {
    const pendingError = new HTTPError(
      new Response(null, { status: 409 }),
      new Request('http://localhost/api/v1/theory/session/session-one/questions'),
      {} as never
    );
    pendingError.message = 'PDF study questions are still being generated';
    vi.mocked(getTheorySessionQuestions)
      .mockRejectedValueOnce(pendingError)
      .mockResolvedValueOnce(envelope([]));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTheorySessionQuestionsReader('session-one', 10, true), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.error).toBe(pendingError));
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });
    expect(getTheorySessionQuestions).toHaveBeenCalledTimes(2);
  });
});
