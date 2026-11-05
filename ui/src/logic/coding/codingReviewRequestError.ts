import { getHttpStatus } from '@/service/api';
import type { ICodingReviewRequestError } from '@/core';

const DAILY_REVIEW_LIMIT_MESSAGE = 'Daily AI code review limit reached';

export const getCodingReviewRequestError = (error: unknown): ICodingReviewRequestError => {
  if (getHttpStatus(error) === 409 && error instanceof Error) {
    if (error.message === DAILY_REVIEW_LIMIT_MESSAGE) {
      return {
        message: 'You have reached your daily AI review limit. It resets at 00:00 UTC.',
        canRetry: false,
      };
    }
  }

  return {
    message: error instanceof Error ? error.message : 'The AI review request could not be sent.',
    canRetry: true,
  };
};
