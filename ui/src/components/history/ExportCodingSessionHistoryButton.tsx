import { Download } from 'lucide-react';

import { toCodingSessionCsv } from '@/utils';
import type { IExportCodingSessionHistoryButtonProps } from './ExportCodingSessionHistoryButton.types';

export const ExportCodingSessionHistoryButton = (props: IExportCodingSessionHistoryButtonProps) => {
  const { sessions, page } = props;

  if (sessions.length === 0) return null;

  const handleExport = () => {
    const file = new Blob([toCodingSessionCsv(sessions)], { type: 'text/csv;charset=utf-8' });
    const fileUrl = URL.createObjectURL(file);
    const downloadLink = document.createElement('a');
    downloadLink.href = fileUrl;
    downloadLink.download = `prepai-coding-session-history-page-${page}.csv`;
    downloadLink.click();
    URL.revokeObjectURL(fileUrl);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
    >
      <Download aria-hidden="true" className="size-4" />
      Export current page CSV
    </button>
  );
};
