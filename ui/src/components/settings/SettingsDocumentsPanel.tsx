import type { ISettingsDocumentsPanelProps } from './SettingsDocumentsPanel.types';

export const SettingsDocumentsPanel = (props: ISettingsDocumentsPanelProps) => {
  const { onOpenDocuments } = props;

  return (
    <div className="flex min-h-[13rem] flex-col items-start justify-center">
      <h3 className="text-sm font-semibold text-zinc-100">Your study documents</h3>
      <p className="mt-1 max-w-md text-sm text-zinc-400">
        Upload and manage PDFs used for private reading and document-based practice.
      </p>
      <button
        type="button"
        onClick={onOpenDocuments}
        className="mt-4 inline-flex min-h-9 items-center rounded-lg bg-amber-400 px-3 text-sm font-semibold text-black transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      >
        Manage documents
      </button>
    </div>
  );
};
