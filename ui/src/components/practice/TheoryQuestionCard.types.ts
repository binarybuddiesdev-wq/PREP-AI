import type { ITheoryQuestion } from '@/core';

export interface ITheoryQuestionCardProps {
  question: ITheoryQuestion;
  currentQuestion: number;
  totalQuestions: number;
  elapsedSeconds: number;
  answerDraft: string;
  isSubmitting: boolean;
  isAnswerFrozen: boolean;
  submitError: string | null;
  submitted: boolean;
  onAnswerChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onEnd: () => void;
}
