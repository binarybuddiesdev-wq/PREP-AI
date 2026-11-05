import type { ReactNode } from 'react';

export interface ICodingSessionHistoryTableProps {
  hasSessions: boolean;
  children: ReactNode;
  page: number;
  limit: number;
  total: number;
  isLoading: boolean;
  errorMessage: string | null;
  problemTitleErrorMessage: string | null;
  onRetryHistory: () => void;
  onRetryProblemTitles: () => void;
  onPageChange: (page: number) => void;
  onStartCoding: () => void;
}
