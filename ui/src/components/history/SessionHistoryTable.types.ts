import type { ReactNode } from 'react';

export interface ISessionHistoryTableProps {
  hasSessions: boolean;
  children: ReactNode;
  page: number;
  limit: number;
  total: number;
  isLoading: boolean;
  errorMessage: string | null;
  onRetryHistory: () => void;
  onPageChange: (page: number) => void;
  onStartPractice: () => void;
}
