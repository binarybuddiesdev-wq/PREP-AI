import { FileText, RotateCw, Trash2 } from 'lucide-react';

import type { IPdfSource } from '@/core';
import type { ISettingsAIAndSourcesPanelProps } from './SettingsAIAndSourcesPanel.types';

const formatBytes = (byteSize: number) => {
  if (byteSize < 1024) return `${byteSize} B`;
  if (byteSize < 1024 * 1024) return `${Math.round(byteSize / 1024)} KB`;
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
};

const isSourceReady = (source: IPdfSource) => source.status === 'ready';

export const SettingsAIAndSourcesPanel = (props: ISettingsAIAndSourcesPanelProps) => {
  const {
    values,
    pdfSources,
    isLoading,
    errorMessage,
    deletingPdfId,
    onChange,
    onRetry,
    onDeletePdf,
    onOpenDocuments,
  } = props;
  const enabledSourceIds = values.enabledPdfSourceIds;

  const isSourceEnabled = (source: IPdfSource) =>
    enabledSourceIds ? enabledSourceIds.includes(source.id) : isSourceReady(source);

  const toggleSource = (source: IPdfSource) => {
    if (!isSourceReady(source)) return;
    const selected = new Set(
      enabledSourceIds ?? pdfSources.filter(isSourceReady).map((item) => item.id)
    );
    if (selected.has(source.id)) selected.delete(source.id);
    else selected.add(source.id);
    onChange({ ...values, enabledPdfSourceIds: [...selected] });
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="settings-ai-model-title">
        <h3
          id="settings-ai-model-title"
          className="mb-4 text-[0.95rem] font-semibold text-[var(--text-h)]"
        >
          AI Model
        </h3>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="mb-1 text-xs text-[var(--dim)]">Provider</p>
              <p className="text-sm font-semibold text-[var(--text)]">Managed by server</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-[var(--dim)]">Model</p>
              <p className="font-mono text-xs text-[var(--accent-strong)]">
                Selected from server configuration
              </p>
            </div>
            <p className="rounded-full border border-[var(--border2)] px-3 py-1.5 text-xs text-[var(--dim)]">
              Credentials stay private
            </p>
          </div>
          <p className="mt-4 text-xs text-[var(--dim)]">
            AI provider and model are managed by your server configuration.
          </p>
        </div>
      </section>

      <section aria-labelledby="settings-pdf-sources-title">
        <h3
          id="settings-pdf-sources-title"
          className="mb-4 text-[0.95rem] font-semibold text-[var(--text-h)]"
        >
          PDF Sources
        </h3>
        <p className="mb-4 text-xs leading-5 text-[var(--dim)]">
          Choose which ready PDFs can be used to generate practice questions.
        </p>
        {isLoading ? (
          <p role="status" className="py-5 text-sm text-[var(--dim)]">
            Loading PDF sources…
          </p>
        ) : errorMessage ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] p-3"
          >
            <p className="text-sm text-[var(--danger-strong)]">{errorMessage}</p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-8 items-center gap-2 text-xs font-semibold text-[var(--danger-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <RotateCw aria-hidden="true" className="size-3.5" /> Retry
            </button>
          </div>
        ) : pdfSources.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border2)] px-5 py-8 text-center">
            <FileText aria-hidden="true" className="mx-auto mb-2 size-6 text-[var(--dim)]" />
            <p className="text-sm font-medium text-[var(--text)]">No PDF sources yet</p>
            <p className="mt-1 text-xs text-[var(--dim)]">
              Upload a PDF to use it for document-based practice.
            </p>
            <button
              type="button"
              onClick={onOpenDocuments}
              className="mt-4 min-h-9 rounded-lg bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--accent-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Manage documents
            </button>
          </div>
        ) : (
          <ul className="mt-4 space-y-3" aria-label="PDF question sources">
            {pdfSources.map((source) => (
              <li
                key={source.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--red-bg)] text-[0.6rem] font-bold text-[var(--danger-strong)]"
                  >
                    PDF
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-[var(--text)]">
                      {source.displayName}
                    </span>
                    <span className="text-xs text-[var(--dim)]">
                      {formatBytes(source.byteSize)} ·{' '}
                      {source.pageCount === null
                        ? 'Page count unavailable'
                        : `${source.pageCount} ${source.pageCount === 1 ? 'page' : 'pages'}`}
                    </span>
                    {!isSourceReady(source) ? (
                      <span className="mt-1 text-xs text-[var(--dim)]">
                        {source.status === 'failed' ? 'Indexing failed' : `Source ${source.status}`}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-label={`Include ${source.displayName} as a question source`}
                    aria-checked={isSourceEnabled(source)}
                    disabled={!isSourceReady(source)}
                    onClick={() => toggleSource(source)}
                    className={`relative h-5 w-10 rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 ${isSourceEnabled(source) ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]' : 'border-[var(--border2)] bg-[var(--bg2)]'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-[2px] size-3.5 rounded-full ${isSourceEnabled(source) ? 'left-[21px] bg-[var(--accent-strong)]' : 'left-[2px] bg-[var(--dim)]'}`}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${source.displayName}`}
                    title="Remove PDF source"
                    disabled={deletingPdfId === source.id}
                    onClick={() => onDeletePdf(source.id)}
                    className="grid size-8 place-items-center rounded-lg text-[var(--dim)] hover:bg-[var(--red-bg)] hover:text-[var(--danger-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-50"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="flex min-h-[4.5rem] items-center justify-between gap-4 border-t border-[var(--border)] pt-4"
        aria-label="Web Search"
      >
        <div>
          <h3 className="text-sm font-medium text-[var(--text-h)]">Web Search</h3>
          <p className="mt-1 text-xs text-[var(--dim)]">
            Web search is not available for question generation yet.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="Web Search"
          aria-checked="false"
          disabled
          title="Not available yet"
          className="relative h-5 w-10 shrink-0 rounded-full border border-[var(--border2)] bg-[var(--bg2)] opacity-50"
        >
          <span
            aria-hidden="true"
            className="absolute left-[2px] top-[2px] size-3.5 rounded-full bg-[var(--dim)]"
          />
        </button>
      </section>
    </div>
  );
};
