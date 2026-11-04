export type PdfSourceStatus =
  'uploading' | 'queued' | 'processing' | 'ready' | 'failed' | 'deleting' | 'deleted';

export interface IPdfSource {
  id: string;
  displayName: string;
  byteSize: number;
  pageCount: number | null;
  status: PdfSourceStatus;
  activeRevision: number;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IPdfDeleteResult {
  id: string;
  status: 'deleting' | 'deleted';
}

export interface IPdfReindexResult {
  id: string;
  status: 'queued';
  requestedRevision: number;
}

export interface IPdfUploadProgress {
  percent: number;
  transferredBytes: number;
  totalBytes?: number;
}
