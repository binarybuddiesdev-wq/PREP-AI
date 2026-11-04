import { HTTPError } from 'ky';

export const PDF_QUESTIONS_PENDING_MESSAGE = 'PDF study questions are still being generated';

export const isPdfQuestionGenerationPending = (error: unknown): boolean =>
  error instanceof HTTPError &&
  error.response.status === 409 &&
  error.message === PDF_QUESTIONS_PENDING_MESSAGE;
