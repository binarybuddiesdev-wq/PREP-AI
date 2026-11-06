import type { ITheoryAnswer } from '@/core';

export interface ITheoryFeedbackProps {
  answer: ITheoryAnswer;
  evaluationError: string | null;
  isRefreshing: boolean;
  isEnding: boolean;
  isCompleting: boolean;
  isRestarting: boolean;
  canContinue: boolean;
  onRetryEvaluation: () => void;
  onContinue: () => void;
  onPracticeSameTopic: () => void;
  onEnd: () => void;
}
