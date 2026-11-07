import { FileText } from 'lucide-react';

import type { ISettingsDocumentsPanelProps } from './SettingsDocumentsPanel.types';

export const SettingsDocumentsPanel = (props: ISettingsDocumentsPanelProps) => {
  const { onOpenDocuments } = props;

  return (
    <div>
      <p className="text-sm leading-6 text-[var(--dim)]">
        Upload PDF documents to use as question sources. Drag files or click to browse.
      </p>
      <button
        type="button"
        onClick={onOpenDocuments}
        aria-label="Upload or manage PDFs"
        className="mt-5 flex min-h-[10.85rem] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg2)] px-4 py-7 text-center transition hover:border-[var(--accent-border)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <FileText aria-hidden="true" className="mb-2 size-7 text-[var(--dim)] opacity-70" />
        <span className="text-sm font-medium text-[var(--text)]">
          Add PDFs to your study library
        </span>
        <span className="mt-1 text-xs text-[var(--faint)]">
          Open the document manager to browse and upload files
        </span>
      </button>
    </div>
  );
};
