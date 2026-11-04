import { describe, expect, it, vi } from 'vitest';

import type { IPdfSource } from '@/core';
import {
  deletePdfSource,
  getPdfContent,
  getPdfSource,
  getPdfSources,
  reindexPdfSource,
  uploadPdfSource,
} from './pdf.api';

const source: IPdfSource = {
  id: 'pdf-source-1',
  displayName: 'systems.pdf',
  byteSize: 512,
  pageCount: 8,
  status: 'queued',
  activeRevision: 0,
  failureCode: null,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
};

describe('PDF API', () => {
  it('requests the source list with its requested limit', async () => {
    const response = { success: true, message: 'ok', data: [source] };
    const json = vi.fn().mockResolvedValue(response);
    const api = { get: vi.fn().mockReturnValue({ json }) };

    await expect(getPdfSources(api as never, 12)).resolves.toEqual(response);
    expect(api.get).toHaveBeenCalledWith('pdfs', { searchParams: { limit: 12 } });
  });

  it('encodes source identifiers when requesting one source', async () => {
    const response = { success: true, message: 'ok', data: source };
    const json = vi.fn().mockResolvedValue(response);
    const api = { get: vi.fn().mockReturnValue({ json }) };

    await expect(getPdfSource(api as never, 'pdf/source 1')).resolves.toEqual(response);
    expect(api.get).toHaveBeenCalledWith('pdfs/pdf%2Fsource%201');
  });

  it('uploads one file with an idempotency key and reports byte progress', async () => {
    const response = { success: true, message: 'ok', data: source };
    const json = vi.fn().mockResolvedValue(response);
    const post = vi.fn().mockReturnValue({ json });
    const api = { post };
    const onProgress = vi.fn();
    const file = new File(['pdf-bytes'], 'systems.pdf', { type: 'application/pdf' });

    await expect(uploadPdfSource(api as never, file, 'upload-key-1', onProgress)).resolves.toEqual(
      response
    );

    const [path, options] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('pdfs');
    expect(options.headers).toEqual({ 'Idempotency-Key': 'upload-key-1' });
    expect((options.body as FormData).get('file')).toBe(file);
    expect(options.onUploadProgress).toEqual(expect.any(Function));
    (options.onUploadProgress as (progress: { percent: number; transferredBytes: number }) => void)(
      { percent: 0.5, transferredBytes: 4 }
    );
    expect(onProgress).toHaveBeenCalledWith({ percent: 0.5, transferredBytes: 4 });
  });

  it('fetches private PDF bytes as a Blob without a storage URL', async () => {
    const content = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    const blob = vi.fn().mockResolvedValue(content);
    const api = { get: vi.fn().mockReturnValue({ blob }) };

    await expect(getPdfContent(api as never, 'pdf/source 1')).resolves.toBe(content);
    expect(api.get).toHaveBeenCalledWith('pdfs/pdf%2Fsource%201/content');
  });

  it('uses idempotent reindex and retry-safe delete endpoints', async () => {
    const reindexJson = vi.fn().mockResolvedValue({
      success: true,
      message: 'ok',
      data: { id: 'pdf-1', status: 'queued', requestedRevision: 2 },
    });
    const deleteJson = vi.fn().mockResolvedValue({
      success: true,
      message: 'ok',
      data: { id: 'pdf-1', status: 'deleting' },
    });
    const post = vi.fn().mockReturnValue({ json: reindexJson });
    const deleteRequest = vi.fn().mockReturnValue({ json: deleteJson });
    const api = { post, delete: deleteRequest };

    await reindexPdfSource(api as never, 'pdf-1', 'reindex-1');
    await deletePdfSource(api as never, 'pdf-1');

    expect(post).toHaveBeenCalledWith('pdfs/pdf-1/reindex', {
      headers: { 'Idempotency-Key': 'reindex-1' },
    });
    expect(deleteRequest).toHaveBeenCalledWith('pdfs/pdf-1');
  });
});
