import type { ITheorySession } from '@/core';

export interface IExportSessionHistoryButtonProps {
  sessions: readonly ITheorySession[];
  page: number;
}
