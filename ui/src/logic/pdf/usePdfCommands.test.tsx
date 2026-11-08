import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deletePdfSource, reindexPdfSource, uploadPdfSource } from '@/service/api';
import { usePdfDeleteCommand, usePdfReindexCommand, usePdfUploadCommand } from './usePdfCommands';
import { pdfKeys } from './pdf.keys';

const session = vi.hoisted(() => ({ user: { id: 'user-one' } }));
vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({
  deletePdfSource: vi.fn(),
  reindexPdfSource: vi.fn(),
  uploadPdfSource: vi.fn(),
}));

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('PDF commands', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards file identity and refreshes the source list after upload', async () => {
    vi.mocked(uploadPdfSource).mockResolvedValue(envelope({ id: 'pdf-1' } as never));
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePdfUploadCommand(), {
      wrapper: createWrapper(queryClient),
    });
    const file = new File(['pdf'], 'study.pdf', { type: 'application/pdf' });
    await act(async () => {
      await result.current.mutateAsync({ file, idempotencyKey: 'upload-1' });
    });

    expect(uploadPdfSource).toHaveBeenCalledWith({}, file, 'upload-1');
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pdfKeys.list('user-one') })
    );
  });

  it('invalidates source and list data after reindex and delete', async () => {
    vi.mocked(reindexPdfSource).mockResolvedValue(envelope({ id: 'pdf-1' } as never));
    vi.mocked(deletePdfSource).mockResolvedValue(envelope({ id: 'pdf-1', status: 'deleting' }));
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = createWrapper(queryClient);
    const reindex = renderHook(() => usePdfReindexCommand(), { wrapper });
    const remove = renderHook(() => usePdfDeleteCommand(), { wrapper });

    await act(async () => {
      await reindex.result.current.mutateAsync({ pdfId: 'pdf-1', idempotencyKey: 'reindex-1' });
      await remove.result.current.mutateAsync({ pdfId: 'pdf-1' });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pdfKeys.list('user-one') });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: pdfKeys.source('user-one', 'pdf-1'),
    });
  });
});
