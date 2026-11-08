import type { IApiEnvelope, IPdfDeleteResult, IPdfReindexResult, IPdfSource } from '@/core';
import type { ApiClient } from './apiClient.types';

export const getPdfSources = (api: ApiClient, limit = 20): Promise<IApiEnvelope<IPdfSource[]>> =>
  api.get('pdfs', { searchParams: { limit } }).json<IApiEnvelope<IPdfSource[]>>();

export const getPdfSource = (api: ApiClient, pdfId: string): Promise<IApiEnvelope<IPdfSource>> =>
  api.get(`pdfs/${encodeURIComponent(pdfId)}`).json<IApiEnvelope<IPdfSource>>();

export const uploadPdfSource = (
  api: ApiClient,
  file: File,
  idempotencyKey: string
): Promise<IApiEnvelope<IPdfSource>> => {
  const body = new FormData();
  body.append('file', file);

  return api
    .post('pdfs', { body, headers: { 'Idempotency-Key': idempotencyKey } })
    .json<IApiEnvelope<IPdfSource>>();
};

export const getPdfContent = (api: ApiClient, pdfId: string): Promise<Blob> =>
  api.get(`pdfs/${encodeURIComponent(pdfId)}/content`).blob();

export const reindexPdfSource = (
  api: ApiClient,
  pdfId: string,
  idempotencyKey: string
): Promise<IApiEnvelope<IPdfReindexResult>> =>
  api
    .post(`pdfs/${encodeURIComponent(pdfId)}/reindex`, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    .json<IApiEnvelope<IPdfReindexResult>>();

export const deletePdfSource = (
  api: ApiClient,
  pdfId: string
): Promise<IApiEnvelope<IPdfDeleteResult>> =>
  api.delete(`pdfs/${encodeURIComponent(pdfId)}`).json<IApiEnvelope<IPdfDeleteResult>>();
