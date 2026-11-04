import type { ITheorySessionDetail as ITheorySessionDetailData } from '@/core';

export interface ITheorySessionDetailProps {
  session: ITheorySessionDetailData;
  isCompleting: boolean;
  completionError: string | null;
  onComplete: () => void;
  onReturnToHistory: () => void;
}
