import type { ICodingExecutionAnswer, ICodingReviewRequestError } from '@/core';

export interface ICodingReviewDialogProps {
  isOpen: boolean;
  problemTitle: string;
  answer: ICodingExecutionAnswer;
  isRequestPending: boolean;
  requestError: ICodingReviewRequestError | null;
  onOpenChange: (isOpen: boolean) => void;
  onRequestReview: () => void;
}
