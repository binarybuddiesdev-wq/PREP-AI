import { Download } from 'lucide-react';

import { toTheorySessionCsv } from '@/utils';
import type { IExportSessionHistoryButtonProps } from './ExportSessionHistoryButton.types';

export const ExportSessionHistoryButton = (props: IExportSessionHistoryButtonProps) => {
  const { sessions, page } = props;

  if (sessions.length === 0) return null;

  const handleExport = () => {
    const file = new Blob([toTheorySessionCsv(sessions)], { type: 'text/csv;charset=utf-8' });
    const fileUrl = URL.createObjectURL(file);
    const downloadLink = document.createElement('a');
    downloadLink.href = fileUrl;
    downloadLink.download = `prepai-session-history-page-${page}.csv`;
    downloadLink.click();
    URL.revokeObjectURL(fileUrl);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-[var(--border2)] px-4 py-[0.45rem] text-[0.8rem] font-medium text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <Download aria-hidden="true" className="size-[13px]" />
      Export CSV
    </button>
  );
};
