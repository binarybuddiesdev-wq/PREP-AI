import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPdfSource, getPdfSources } from '@/service/api';
import { usePdfSourceReader, usePdfSourcesReader } from './usePdfSourcesReader';
import { pdfKeys } from './pdf.keys';

const session = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true, user: { id: 'user-one' } }));
vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({ getPdfSource: vi.fn(), getPdfSources: vi.fn() }));

const source = (status: 'queued' | 'processing' | 'ready' | 'failed') => ({
  id: 'pdf-one',
  displayName: 'study.pdf',
  byteSize: 120,
  pageCount: 3,
  status,
  activeRevision: status === 'ready' ? 1 : 0,
  failureCode: null,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
});
const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('usePdfSourcesReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = true;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it('loads the authenticated user’s sources into a user-scoped query', async () => {
    vi.mocked(getPdfSources).mockResolvedValue(envelope([source('ready')]));
    const queryClient = new QueryClient();
    const { result } = renderHook(() => usePdfSourcesReader(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPdfSources).toHaveBeenCalledWith({}, 20);
    expect(queryClient.getQueryCache().find({ queryKey: pdfKeys.list('user-one') })).toBeDefined();
  });

  it.each([
    [['queued'], 1500],
    [['processing', 'ready'], 1500],
    [['ready', 'failed'], false],
  ] as const)(
    'polls sources with active indexing and stops at terminal states',
    async (statuses, expected) => {
      vi.mocked(getPdfSources).mockResolvedValue(
        envelope(statuses.map((status) => source(status)))
      );
      const queryClient = new QueryClient();
      const { result } = renderHook(() => usePdfSourcesReader(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const query = queryClient.getQueryCache().find({ queryKey: pdfKeys.list('user-one') })!;
      const poll = (
        query.options as unknown as {
          refetchInterval?: number | false | ((query: never) => number | false);
        }
      ).refetchInterval;
      expect(typeof poll === 'function' ? poll(query as never) : poll).toBe(expected);
    }
  );

  it('does not request sources before the session is authenticated', () => {
    session.isSignedIn = false;
    const { result } = renderHook(() => usePdfSourcesReader(), {
      wrapper: createWrapper(new QueryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getPdfSources).not.toHaveBeenCalled();
  });

  it('loads one source under a user scoped detail key and polls while processing', async () => {
    vi.mocked(getPdfSource).mockResolvedValue(envelope(source('processing')));
    const queryClient = new QueryClient();
    const { result } = renderHook(() => usePdfSourceReader('pdf-one'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPdfSource).toHaveBeenCalledWith({}, 'pdf-one');
    const query = queryClient
      .getQueryCache()
      .find({ queryKey: pdfKeys.source('user-one', 'pdf-one') })!;
    const poll = (
      query.options as unknown as {
        refetchInterval?: number | false | ((query: never) => number | false);
      }
    ).refetchInterval;
    expect(typeof poll === 'function' ? poll(query as never) : poll).toBe(1500);
  });
});
