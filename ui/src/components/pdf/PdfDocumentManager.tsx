import { BookOpen, Check, CloudUpload, FileText, RotateCw, Trash2, X } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router';

import type { IPdfSource } from '@/core';
import { ROUTES } from '@/core';

export interface IPdfDocumentManagerProps {
  sources: IPdfSource[];
  isLoading: boolean;
  listError: string | null;
  isUploading: boolean;
  uploadFileName: string | null;
  uploadProgress: number;
  uploadError: string | null;
  validationError: string | null;
  reindexingId: string | null;
  deletingId: string | null;
  confirmingDeleteId: string | null;
  actionError: string | null;
  onFilesSelected: (file: File) => void;
  onUpload: () => void;
  onRetryUpload: () => void;
  onRetryList: () => void;
  onReindex: (pdfId: string) => void;
  onRequestDelete: (pdfId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

const formatBytes = (byteSize: number): string => {
  if (byteSize < 1024) return `${byteSize} B`;
  const kilobytes = byteSize / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
};

const statusLabel = (status: IPdfSource['status']) => {
  if (status === 'ready') return 'Ready';
  if (status === 'failed') return 'Needs attention';
  if (status === 'deleting') return 'Removing';
  return 'Indexing';
};

const failureDescription = (failureCode: string | null) => {
  if (failureCode === 'invalid_pdf') {
    return 'This PDF could not be indexed. Check that it is valid and not encrypted.';
  }
  if (failureCode === 'reindex_failed') {
    return 'The latest index could not be rebuilt. Your previous index is still available.';
  }
  if (failureCode === 'storage_upload_failed') {
    return 'The file could not be stored. Try uploading it again.';
  }
  return 'This PDF could not be indexed. You can retry the indexing step.';
};

export const PdfDocumentManager = (props: IPdfDocumentManagerProps) => {
  const {
    sources,
    isLoading,
    listError,
    isUploading,
    uploadFileName,
    uploadProgress,
    uploadError,
    validationError,
    reindexingId,
    deletingId,
    confirmingDeleteId,
    actionError,
    onFilesSelected,
    onUpload,
    onRetryUpload,
    onRetryList,
    onReindex,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
  } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  const selectFirstPdf = (files: FileList | null) => {
    const file = files?.item?.(0) ?? files?.[0];
    if (file) onFilesSelected(file);
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--text-h)]">Your documents</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Upload searchable PDFs to read and use in a study session.
        </p>
      </header>

      <section
        aria-labelledby="pdf-upload-title"
        className="app-shell-panel rounded-2xl border border-white/[0.08] bg-[#18181b] p-4 sm:p-5"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
            <CloudUpload aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 id="pdf-upload-title" className="text-sm font-semibold text-[var(--text-h)]">
              Add a study document
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-zinc-400">
              PDF with selectable text, up to 10 MB and 100 pages.
            </p>
          </div>
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!isUploading) selectFirstPdf(event.dataTransfer.files);
          }}
          className="rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-5 text-center transition-colors hover:border-amber-400/40 sm:py-6"
        >
          <input
            ref={inputRef}
            aria-label="Choose a PDF file"
            accept=".pdf,application/pdf"
            className="sr-only"
            disabled={isUploading}
            type="file"
            onChange={(event) => {
              selectFirstPdf(event.currentTarget.files);
              event.currentTarget.value = '';
            }}
          />
          <FileText aria-hidden="true" className="mx-auto size-6 text-zinc-500" />
          <p className="mt-2 text-sm font-medium text-zinc-200">
            Drop a PDF here or{' '}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-amber-300 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50"
            >
              browse files
            </button>
          </p>
          <p className="mt-1 text-xs text-zinc-500">One document per upload</p>
        </div>

        {validationError ? (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {validationError}
          </p>
        ) : null}

        {uploadFileName ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-black/15 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-200">{uploadFileName}</p>
              {isUploading ? (
                <div
                  aria-label={`Uploading ${uploadFileName}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                >
                  <span
                    className="block h-full rounded-full bg-amber-400 transition-[width] duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              ) : null}
              {uploadError ? (
                <p role="alert" className="mt-1 text-xs text-rose-300">
                  {uploadError}
                </p>
              ) : null}
            </div>
            {uploadError ? (
              <button
                type="button"
                onClick={onRetryUpload}
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <RotateCw aria-hidden="true" className="size-3.5" />
                Retry upload
              </button>
            ) : (
              <button
                type="button"
                disabled={isUploading}
                onClick={onUpload}
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-semibold text-zinc-950 hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-60"
              >
                {isUploading ? 'Uploading…' : 'Upload PDF'}
              </button>
            )}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="pdf-documents-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="pdf-documents-title" className="text-base font-semibold text-[var(--text-h)]">
            Uploaded documents
          </h2>
          {!isLoading && !listError ? (
            <span className="text-xs text-zinc-500">
              {sources.length} {sources.length === 1 ? 'document' : 'documents'}
            </span>
          ) : null}
        </div>

        {listError ? (
          <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4">
            <p className="text-sm text-rose-200">{listError}</p>
            <button
              type="button"
              onClick={onRetryList}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-300/20 px-3 text-xs font-medium text-rose-100 hover:bg-rose-300/10 focus-visible:outline-2 focus-visible:outline-rose-300"
            >
              <RotateCw aria-hidden="true" className="size-3.5" />
              Retry documents
            </button>
          </div>
        ) : isLoading ? (
          <p
            role="status"
            className="rounded-xl border border-white/[0.07] p-5 text-sm text-zinc-400"
          >
            Loading your documents…
          </p>
        ) : sources.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center">
            <FileText aria-hidden="true" className="mx-auto size-6 text-zinc-500" />
            <p className="mt-2 text-sm font-medium text-zinc-200">No documents yet</p>
            <p className="mt-1 text-xs text-zinc-500">Your uploaded PDFs will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.07] rounded-xl border border-white/[0.08] bg-[#18181b] px-4 sm:px-5">
            {sources.map((source) => {
              const canReindex = source.status === 'ready' || source.status === 'failed';
              const isConfirming = confirmingDeleteId === source.id;
              return (
                <li key={source.id} className="py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                        {source.status === 'ready' ? (
                          <Check aria-hidden="true" className="size-4 text-emerald-300" />
                        ) : (
                          <FileText aria-hidden="true" className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-100">
                          {source.displayName}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatBytes(source.byteSize)}
                          {source.pageCount === null ? '' : ` · ${source.pageCount} pages`}
                        </p>
                        {source.status === 'failed' ? (
                          <p className="mt-1 max-w-2xl text-xs leading-5 text-rose-300">
                            {failureDescription(source.failureCode)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-12 sm:shrink-0 sm:pl-0">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.68rem] font-medium ${
                          source.status === 'ready'
                            ? 'bg-emerald-400/10 text-emerald-300'
                            : source.status === 'failed'
                              ? 'bg-rose-400/10 text-rose-300'
                              : 'bg-amber-300/10 text-amber-200'
                        }`}
                      >
                        {statusLabel(source.status)}
                      </span>
                      {source.status === 'ready' ? (
                        <Link
                          to={`${ROUTES.library}?pdfId=${encodeURIComponent(source.id)}`}
                          aria-label={`Open ${source.displayName} in Library`}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400"
                        >
                          <BookOpen aria-hidden="true" className="size-3.5" />
                          Open
                        </Link>
                      ) : null}
                      {canReindex ? (
                        <button
                          type="button"
                          disabled={reindexingId === source.id}
                          onClick={() => onReindex(source.id)}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-60"
                        >
                          <RotateCw aria-hidden="true" className="size-3.5" />
                          {reindexingId === source.id ? 'Queueing…' : 'Reindex'}
                        </button>
                      ) : null}
                      {source.status !== 'deleting' && source.status !== 'deleted' ? (
                        <button
                          type="button"
                          disabled={deletingId === source.id}
                          aria-label={`Delete ${source.displayName}`}
                          onClick={() => onRequestDelete(source.id)}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-2 focus-visible:outline-rose-300 disabled:opacity-60"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isConfirming ? (
                    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-rose-300/15 bg-rose-300/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-zinc-200">Delete {source.displayName}?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={onCancelDelete}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-white/10 px-2.5 text-xs text-zinc-300 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-amber-400"
                        >
                          <X aria-hidden="true" className="size-3.5" />
                          Keep document
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === source.id}
                          onClick={onConfirmDelete}
                          className="inline-flex min-h-8 items-center rounded-md bg-rose-500/90 px-3 text-xs font-semibold text-white hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-rose-300 disabled:opacity-60"
                        >
                          {deletingId === source.id ? 'Removing…' : 'Delete PDF'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {actionError ? (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {actionError}
          </p>
        ) : null}
      </section>
    </main>
  );
};
