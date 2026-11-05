import type { ICodingStats } from '@/core';

export interface ICodingStatsBarProps {
  stats: ICodingStats | null;
  isLoading: boolean;
  isRetrying: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}
