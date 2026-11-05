import type { ICodingSession } from '@/core';

export interface IExportCodingSessionHistoryButtonProps {
  sessions: readonly ICodingSession[];
  page: number;
}
