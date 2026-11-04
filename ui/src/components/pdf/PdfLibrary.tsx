import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
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
  onSelectSource: (pdfId: string) => void;
  onRetryList: () => void;
  onRetryContent: () => void;
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
    onSelectSource,
    onRetryList,
    onRetryContent,
  } = props;
  const viewerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const pageCount = Math.max(1, selectedSource?.pageCount ?? 1);
  const readySources = sources.filter((source) => source.status === 'ready');

  useEffect(() => {
    setPage(1);
    setZoom(100);
  }, [selectedSource?.id]);

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
    <main className="mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-h)]">PDF Library</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Read and revisit your indexed study documents.
          </p>
        </div>
        <Link
          to={ROUTES.settingsDocuments}
          className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <BookOpen aria-hidden="true" className="size-4" />
          Manage documents
        </Link>
      </header>

      {listError ? (
        <section
          role="alert"
          className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4"
        >
          <p className="text-sm text-rose-200">{listError}</p>
          <button
            type="button"
            onClick={onRetryList}
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-300/20 px-3 text-xs font-medium text-rose-100 hover:bg-rose-300/10 focus-visible:outline-2 focus-visible:outline-rose-300"
          >
            <RotateCw aria-hidden="true" className="size-3.5" />
            Retry Library
          </button>
        </section>
      ) : isLoading ? (
        <p
          role="status"
          className="rounded-xl border border-white/[0.08] p-5 text-sm text-zinc-400"
        >
          Loading your Library…
        </p>
      ) : readySources.length === 0 ? (
        <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
            <BookOpen aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-zinc-100">Your Library is empty</h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-zinc-400">
            Add a PDF with selectable text. Once indexing finishes, it will be ready to read here.
          </p>
        </section>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(220px,270px)_minmax(0,1fr)]">
          <aside
            aria-label="Ready PDF documents"
            className="app-shell-panel min-h-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#18181b]"
          >
            <div className="border-b border-white/[0.07] px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Documents
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {readySources.length} ready {readySources.length === 1 ? 'file' : 'files'}
              </p>
            </div>
            <ul className="max-h-64 divide-y divide-white/[0.06] overflow-y-auto p-2 lg:max-h-[calc(100dvh-17rem)]">
              {readySources.map((source) => (
                <li key={source.id}>
                  <button
                    type="button"
                    aria-pressed={selectedSource?.id === source.id}
                    onClick={() => onSelectSource(source.id)}
                    className={`flex min-h-12 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      selectedSource?.id === source.id
                        ? 'bg-amber-400/10 text-amber-100'
                        : 'text-zinc-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <BookOpen aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {source.displayName}
                    </span>
                    {source.pageCount !== null ? (
                      <span className="shrink-0 text-[0.65rem] text-zinc-500">
                        {source.pageCount}p
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section
            aria-label="PDF reader"
            className="flex min-h-[65dvh] min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#18181b] lg:min-h-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-3 py-2.5 sm:px-4">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-zinc-100">
                  {selectedSource?.displayName ?? 'Select a document'}
                </h2>
                {selectedSource ? (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {selectedSource.pageCount ?? '—'} pages
                  </p>
                ) : null}
              </div>
              <div aria-label="PDF reader controls" className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={!selectedSource || page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-white/10 text-zinc-300 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </button>
                <label className="sr-only" htmlFor="pdf-current-page">
                  Current page
                </label>
                <input
                  id="pdf-current-page"
                  aria-label="Current page"
                  type="number"
                  min={1}
                  max={pageCount}
                  value={page}
                  disabled={!selectedSource}
                  onChange={(event) => {
                    const requestedPage = Number(event.currentTarget.value);
                    if (Number.isInteger(requestedPage)) {
                      setPage(Math.min(pageCount, Math.max(1, requestedPage)));
                    }
                  }}
                  className="h-8 w-12 rounded-md border border-white/10 bg-black/20 text-center text-xs text-zinc-200 outline-none focus:border-amber-400 disabled:opacity-50"
                />
                <span className="text-xs text-zinc-500">/ {pageCount}</span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={!selectedSource || page >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-white/10 text-zinc-300 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/10" />
                <button
                  type="button"
                  aria-label="Zoom out"
                  disabled={!selectedSource || zoom <= 50}
                  onClick={() => setZoom((current) => Math.max(50, current - 25))}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-white/10 text-zinc-300 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-40"
                >
                  <Minus aria-hidden="true" className="size-3.5" />
                </button>
                <span
                  aria-label="Zoom level"
                  className="w-9 text-center text-xs tabular-nums text-zinc-400"
                >
                  {zoom}%
                </span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  disabled={!selectedSource || zoom >= 200}
                  onClick={() => setZoom((current) => Math.min(200, current + 25))}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-white/10 text-zinc-300 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-40"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  disabled={!selectedSource}
                  onClick={() => void toggleFullscreen()}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-white/10 text-zinc-300 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-40"
                >
                  <Maximize2 aria-hidden="true" className="size-3.5" />
                </button>
              </div>
            </div>

            <div ref={viewerRef} className="relative min-h-0 flex-1 bg-[#101012]">
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
                  className="flex h-full items-center justify-center text-sm text-zinc-400"
                >
                  Loading private preview…
                </p>
              ) : contentError ? (
                <div
                  role="alert"
                  className="flex h-full flex-col items-center justify-center px-5 text-center"
                >
                  <p className="text-sm text-rose-200">{contentError}</p>
                  <button
                    type="button"
                    onClick={onRetryContent}
                    className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    <RotateCw aria-hidden="true" className="size-3.5" />
                    Retry preview
                  </button>
                </div>
              ) : (
                <p className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
                  Choose a ready document to open its private preview.
                </p>
              )}
              {fullscreenError ? (
                <p
                  role="alert"
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-[#18181b] px-3 py-2 text-xs text-rose-200 shadow-lg"
                >
                  {fullscreenError}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
