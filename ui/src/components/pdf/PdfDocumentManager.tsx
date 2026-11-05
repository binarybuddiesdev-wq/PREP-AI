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
        <p className="mt-1 text-sm text-[var(--dim)]">
          Upload searchable PDFs to read and use in a study session.
        </p>
      </header>

      <section
        aria-labelledby="pdf-upload-title"
        className="app-shell-panel rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-[var(--accent-strong)]">
            <CloudUpload aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 id="pdf-upload-title" className="text-sm font-semibold text-[var(--text-h)]">
              Add a study document
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-[var(--dim)]">
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
          className="rounded-xl border border-dashed border-[var(--border2)] bg-[var(--surface)] px-4 py-5 text-center transition-colors hover:border-[var(--accent-border)] sm:py-6"
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
          <FileText aria-hidden="true" className="mx-auto size-6 text-[var(--dim)]" />
          <p className="mt-2 text-sm font-medium text-[var(--text)]">
            Drop a PDF here or{' '}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-[var(--accent-strong)] underline decoration-[var(--accent-border)] underline-offset-4 hover:text-[var(--text-h)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
            >
              browse files
            </button>
          </p>
          <p className="mt-1 text-xs text-[var(--dim)]">One document per upload</p>
        </div>

        {validationError ? (
          <p role="alert" className="mt-3 text-sm text-[var(--danger-strong)]">
            {validationError}
          </p>
        ) : null}

        {uploadFileName ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text)]">{uploadFileName}</p>
              {isUploading ? (
                <div
                  aria-label={`Uploading ${uploadFileName}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface2)]"
                  role="progressbar"
                >
                  <span
                    className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              ) : null}
              {uploadError ? (
                <p role="alert" className="mt-1 text-xs text-[var(--danger-strong)]">
                  {uploadError}
                </p>
              ) : null}
            </div>
            {uploadError ? (
              <button
                type="button"
                onClick={onRetryUpload}
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border2)] px-3 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                <RotateCw aria-hidden="true" className="size-3.5" />
                Retry upload
              </button>
            ) : (
              <button
                type="button"
                disabled={isUploading}
                onClick={onUpload}
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-xs font-semibold text-zinc-950 hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
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
            <span className="text-xs text-[var(--dim)]">
              {sources.length} {sources.length === 1 ? 'document' : 'documents'}
            </span>
          ) : null}
        </div>

        {listError ? (
          <div
            role="alert"
            className="rounded-xl border border-[var(--red-bg)] bg-[var(--red-bg)] p-4"
          >
            <p className="text-sm text-[var(--danger-strong)]">{listError}</p>
            <button
              type="button"
              onClick={onRetryList}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border2)] px-3 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <RotateCw aria-hidden="true" className="size-3.5" />
              Retry documents
            </button>
          </div>
        ) : isLoading ? (
          <p
            role="status"
            className="rounded-xl border border-[var(--border)] p-5 text-sm text-[var(--dim)]"
          >
            Loading your documents…
          </p>
        ) : sources.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center">
            <FileText aria-hidden="true" className="mx-auto size-6 text-[var(--dim)]" />
            <p className="mt-2 text-sm font-medium text-[var(--text-h)]">No documents yet</p>
            <p className="mt-1 text-xs text-[var(--dim)]">Your uploaded PDFs will appear here.</p>
          </div>
        ) : (
          <ul
            aria-labelledby="pdf-documents-title"
            className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 sm:px-5"
          >
            {sources.map((source) => {
              const canReindex = source.status === 'ready' || source.status === 'failed';
              const isConfirming = confirmingDeleteId === source.id;
              return (
                <li key={source.id} className="py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--dim)]">
                        {source.status === 'ready' ? (
                          <Check
                            aria-hidden="true"
                            className="size-4 text-[var(--success-strong)]"
                          />
                        ) : (
                          <FileText aria-hidden="true" className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text)]">
                          {source.displayName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--dim)]">
                          {formatBytes(source.byteSize)}
                          {source.pageCount === null ? '' : ` · ${source.pageCount} pages`}
                        </p>
                        {source.status === 'failed' ? (
                          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--danger-strong)]">
                            {failureDescription(source.failureCode)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-12 sm:shrink-0 sm:pl-0">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.68rem] font-medium ${
                          source.status === 'ready'
                            ? 'bg-[var(--green-bg)] text-[var(--success-strong)]'
                            : source.status === 'failed'
                              ? 'bg-[var(--red-bg)] text-[var(--danger-strong)]'
                              : 'bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                        }`}
                      >
                        {statusLabel(source.status)}
                      </span>
                      {source.status === 'ready' ? (
                        <Link
                          to={`${ROUTES.library}?pdfId=${encodeURIComponent(source.id)}`}
                          aria-label={`Open ${source.displayName} in Library`}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border2)] px-2.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
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
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border2)] px-2.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
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
                          className="inline-flex size-8 items-center justify-center rounded-lg text-[var(--dim)] hover:bg-[var(--red-bg)] hover:text-[var(--danger-strong)] focus-visible:outline-2 focus-visible:outline-[var(--danger-strong)] disabled:opacity-60"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isConfirming ? (
                    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-[var(--text)]">Delete {source.displayName}?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={onCancelDelete}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[var(--border2)] px-2.5 text-xs text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                        >
                          <X aria-hidden="true" className="size-3.5" />
                          Keep document
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === source.id}
                          onClick={onConfirmDelete}
                          className="inline-flex min-h-8 items-center rounded-md border border-[var(--danger-strong)] bg-[var(--red-bg)] px-3 text-xs font-semibold text-[var(--danger-strong)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--danger-strong)] disabled:opacity-60"
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
          <p role="alert" className="mt-3 text-sm text-[var(--danger-strong)]">
            {actionError}
          </p>
        ) : null}
      </section>
    </main>
  );
};
