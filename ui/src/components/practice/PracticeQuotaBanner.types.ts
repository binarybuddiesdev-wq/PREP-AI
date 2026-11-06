import type { ITheoryStats } from '@/core';

export interface IPracticeQuotaBannerProps {
  dailySessions: ITheoryStats['dailySessions'] | null;
  isLoading: boolean;
  isRetrying: boolean;
  errorMessage: string | null;
  onRetry: (() => void) | null;
}
