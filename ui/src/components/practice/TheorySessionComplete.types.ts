import type { ITheoryAnswer, ITheorySession } from '@/core';

export interface ITheorySessionCompleteProps {
  session: ITheorySession;
  answers: ITheoryAnswer[];
  onPracticeAgain: () => void;
  onGoToDashboard: () => void;
}
