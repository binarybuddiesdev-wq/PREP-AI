import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
} from 'lucide-react';
import { Link } from 'react-router';

import type { IPdfSource } from '@/core';
import { ROUTES } from '@/core';

export interface IPdfLibraryProps {
  sources: IPdfSource[];
  selectedSource: IPdfSource | null;
  isLoading: boolean;
  listError: string | null;
  contentUrl: string | null;
  contentLoading: boolean;
  contentError: string | null;
  initialPage?: number;
  onSelectSource: (pdfId: string) => void;
  onRetryList: () => void;
  onRetryContent: () => void;
  onDeleteSources?: (pdfIds: string[]) => Promise<boolean>;
  onBackToList?: () => void;
  deleteError?: string | null;
  isDeleting?: boolean;
}

export const PdfLibrary = (props: IPdfLibraryProps) => {
  const {
    sources,
    selectedSource,
    isLoading,
    listError,
    contentUrl,
    contentLoading,
    contentError,
    initialPage = 1,
    onSelectSource,
    onRetryList,
    onRetryContent,
    onDeleteSources = async () => true,
    onBackToList = () => undefined,
    deleteError = null,
    isDeleting = false,
  } = props;
  const viewerRef = useRef<HTMLElement>(null);
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const pageCount = Math.max(1, selectedSource?.pageCount ?? 1);
  const readySources = sources.filter((source) => source.status === 'ready');
  const formatSize = (byteSize: number) => `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;

  const toggleSelection = (pdfId: string) => {
    setSelectedPdfIds((current) =>
      current.includes(pdfId) ? current.filter((id) => id !== pdfId) : [...current, pdfId]
    );
  };
  const confirmDelete = async () => {
    const succeeded = await onDeleteSources(selectedPdfIds);
    if (!succeeded) return;
    setSelectedPdfIds([]);
    setIsSelectMode(false);
    setIsConfirmingDelete(false);
  };

  useEffect(() => {
    setPage(Math.min(pageCount, Math.max(1, initialPage)));
    setZoom(100);
  }, [initialPage, pageCount, selectedSource?.id]);

  useEffect(() => {
    const updateFullscreen = () =>
      setIsFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    setFullscreenError(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (viewerRef.current?.requestFullscreen) {
        await viewerRef.current.requestFullscreen();
      } else {
        setFullscreenError('Fullscreen is not supported by this browser.');
      }
    } catch {
      setFullscreenError('Could not open fullscreen mode.');
    }
  };

  return (
    <main className="mx-auto flex w-full flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mb-[0.2rem] text-[1.35rem] font-bold text-[var(--text-h)]">Library</h1>
          <p className="text-[0.9rem] text-[var(--dim)]">
            Read and manage your uploaded PDF documents
          </p>
        </div>
      </header>

      {listError ? (
        <section
          role="alert"
          className="rounded-xl border border-[var(--red-bg)] bg-[var(--red-bg)] p-4"
        >
          <p className="text-sm text-[var(--danger-strong)]">{listError}</p>
          <button
            type="button"
            onClick={onRetryList}
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--red-bg)] px-3 text-xs font-medium text-[var(--danger-strong)] hover:bg-[var(--red-bg)] focus-visible:outline-2 focus-visible:outline-[var(--danger-strong)]"
          >
            <RotateCw aria-hidden="true" className="size-3.5" />
            Retry Library
          </button>
        </section>
      ) : isLoading ? (
        <p
          role="status"
          className="rounded-xl border border-[var(--border)] p-5 text-sm text-[var(--dim)]"
        >
          Loading your Library…
        </p>
      ) : readySources.length === 0 ? (
        <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-bg)] text-[var(--accent-strong)]">
            <BookOpen aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-[var(--text-h)]">
            Your Library is empty
          </h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-[var(--dim)]">
            Add a PDF with selectable text. Once indexing finishes, it will be ready to read here.
          </p>
          <Link
            to={ROUTES.settingsDocuments}
            className="mt-4 inline-flex min-h-9 items-center rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-black transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            Go to Documents
          </Link>
        </section>
      ) : !selectedSource ? (
        <section aria-label="My PDFs">
          <div className="mb-4 flex min-h-10 flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[0.9rem] font-semibold text-[var(--text-h)]">My PDFs</h2>
              {selectedPdfIds.length > 0 ? (
                <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.7rem] font-bold text-black">
                  {selectedPdfIds.length} selected
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              {isSelectMode && selectedPdfIds.length > 0 ? (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setIsConfirmingDelete(true)}
                  className="inline-flex min-h-8 items-center rounded-lg border border-[var(--danger-strong)] px-3 text-xs font-semibold text-[var(--danger-strong)] hover:bg-[var(--red-bg)] focus-visible:outline-2 focus-visible:outline-[var(--danger-strong)] disabled:opacity-50"
                >
                  Delete
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setIsSelectMode((current) => !current);
                  setSelectedPdfIds([]);
                }}
                className="inline-flex min-h-8 items-center rounded-lg border border-[var(--border2)] px-3 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                {isSelectMode ? 'Cancel' : 'Select'}
              </button>
            </div>
          </div>

          {deleteError ? (
            <p
              role="alert"
              className="mb-3 rounded-lg bg-[var(--red-bg)] px-3 py-2 text-sm text-[var(--danger-strong)]"
            >
              {deleteError}
            </p>
          ) : null}

          <ul
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="PDF documents"
          >
            {readySources.map((source, index) => {
              const isSelected = selectedPdfIds.includes(source.id);
              return (
                <li key={source.id}>
                  <button
                    type="button"
                    aria-pressed={isSelectMode ? isSelected : undefined}
                    onClick={() =>
                      isSelectMode ? toggleSelection(source.id) : onSelectSource(source.id)
                    }
                    className={`group relative min-h-36 w-full overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--border2)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${isSelected ? 'ring-2 ring-[var(--accent)]' : ''}`}
                  >
                    <span className="mb-3 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded bg-[var(--red-bg)] px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-[var(--danger-strong)]">
                        <FileText aria-hidden="true" className="size-3" /> PDF #{index + 1}
                      </span>
                      <span className="rounded-full bg-[var(--surface2)] px-2 py-0.5 text-[0.68rem] text-[var(--dim)]">
                        {formatSize(source.byteSize)}
                      </span>
                    </span>
                    <span className="block truncate text-[0.95rem] font-semibold text-[var(--text-h)] group-hover:text-[var(--accent-strong)]">
                      {source.displayName}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--dim)]">
                      {source.pageCount ?? '—'} pages · Ready to read
                    </span>
                    <span className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-[0.7rem] text-[var(--dim)]">
                      <span>PDF Document</span>
                      <span>{isSelectMode ? (isSelected ? 'Selected' : 'Select') : 'Open →'}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Dialog.Root
            open={isConfirmingDelete}
            onOpenChange={(open) => {
              if (!isDeleting) setIsConfirmingDelete(open);
            }}
          >
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-[2px] data-[open]:animate-in data-[open]:fade-in" />
              <Dialog.Viewport className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-4">
                <Dialog.Popup
                  role="alertdialog"
                  className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
                >
                  <Dialog.Title className="text-base font-semibold text-[var(--text-h)]">
                    Delete selected PDFs?
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 text-sm text-[var(--dim)]">
                    Are you sure you want to delete{' '}
                    {selectedPdfIds.length === 1 ? 'this file' : `${selectedPdfIds.length} files`}?
                    This action cannot be undone.
                  </Dialog.Description>
                  {deleteError ? (
                    <p role="alert" className="mt-3 text-sm text-[var(--danger-strong)]">
                      {deleteError}
                    </p>
                  ) : null}
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setIsConfirmingDelete(false)}
                      className="min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => void confirmDelete()}
                      className="min-h-9 rounded-lg bg-[var(--danger-strong)] px-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                    >
                      {isDeleting
                        ? 'Deleting…'
                        : deleteError
                          ? 'Retry delete'
                          : 'Delete selected files'}
                    </button>
                  </div>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        </section>
      ) : (
        <div className="flex min-h-[calc(100dvh-12rem)] flex-1 flex-col">
          <button
            type="button"
            onClick={onBackToList}
            className="mb-3 inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[var(--dim)] hover:bg-[var(--surface)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <ChevronLeft aria-hidden="true" className="size-3.5" /> Back to Library
          </button>
          <section
            aria-label="PDF reader"
            ref={viewerRef}
            className="flex min-h-[65dvh] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2.5 sm:px-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BookOpen aria-hidden="true" className="size-4 text-[var(--danger-strong)]" />
                  <h2 className="truncate text-sm font-semibold text-[var(--text-h)]">
                    {selectedSource?.displayName ?? 'Select a document'}
                  </h2>
                </div>
                {selectedSource ? (
                  <p className="mt-0.5 text-xs text-[var(--dim)]">
                    {selectedSource.pageCount ?? '—'} pages
                  </p>
                ) : null}
              </div>
              <div aria-label="PDF reader controls" className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Zoom out"
                  disabled={!selectedSource || zoom <= 50}
                  onClick={() => setZoom((current) => Math.max(50, current - 25))}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--border2)] text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-40"
                >
                  <Minus aria-hidden="true" className="size-3.5" />
                </button>
                <span
                  aria-label="Zoom level"
                  className="w-9 text-center text-xs tabular-nums text-[var(--dim)]"
                >
                  {zoom}%
                </span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  disabled={!selectedSource || zoom >= 200}
                  onClick={() => setZoom((current) => Math.min(200, current + 25))}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--border2)] text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-40"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Reset zoom"
                  disabled={!selectedSource || zoom === 100}
                  onClick={() => setZoom(100)}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border2)] px-2 text-xs text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-40"
                >
                  100%
                </button>
                <button
                  type="button"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  disabled={!selectedSource}
                  onClick={() => void toggleFullscreen()}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--border2)] text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-40"
                >
                  <Maximize2 aria-hidden="true" className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 bg-[var(--bg2)]">
              {contentUrl ? (
                <iframe
                  key={selectedSource?.id}
                  title={`Preview: ${selectedSource?.displayName ?? 'PDF document'}`}
                  src={`${contentUrl}#page=${page}&zoom=${zoom}`}
                  className="absolute inset-0 size-full border-0 bg-white"
                />
              ) : contentLoading ? (
                <p
                  role="status"
                  className="flex h-full items-center justify-center text-sm text-[var(--dim)]"
                >
                  Loading private preview…
                </p>
              ) : contentError ? (
                <div
                  role="alert"
                  className="flex h-full flex-col items-center justify-center px-5 text-center"
                >
                  <p className="text-sm text-[var(--danger-strong)]">{contentError}</p>
                  <button
                    type="button"
                    onClick={onRetryContent}
                    className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border2)] px-3 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                  >
                    <RotateCw aria-hidden="true" className="size-3.5" />
                    Retry preview
                  </button>
                </div>
              ) : (
                <p className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--dim)]">
                  Choose a ready document to open its private preview.
                </p>
              )}
              {fullscreenError ? (
                <p
                  role="alert"
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-[var(--card)] px-3 py-2 text-xs text-[var(--danger-strong)] shadow-lg"
                >
                  {fullscreenError}
                </p>
              ) : null}
            </div>
            <div
              aria-label="PDF page navigation"
              className="flex h-12 shrink-0 items-center justify-center gap-3 border-t border-[var(--border)] bg-[var(--surface2)] px-4"
            >
              <button
                type="button"
                aria-label="Previous page"
                disabled={!selectedSource || page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--border2)] bg-[var(--surface)] text-[var(--dim)] hover:bg-[var(--surface2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <span className="min-w-20 text-center text-xs text-[var(--dim)]">
                Page {page} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={!selectedSource || page >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--border2)] bg-[var(--surface)] text-[var(--dim)] hover:bg-[var(--surface2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
