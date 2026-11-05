import { getHttpStatus } from '@/service/api';

const ERROR_MESSAGES: Record<number, string> = {
  400: "That message couldn't be sent. Check it and try again.",
  401: 'Your session has expired. Refresh the page and sign in again.',
  404: 'This conversation is no longer available. Return to your conversations.',
  409: 'This conversation changed while you were sending. Refresh it and retry your message.',
  429: "You've reached today's AI usage limit. Your draft is kept; try again later.",
  503: 'The assistant is temporarily unavailable. Your draft is kept; please retry.',
};

const FALLBACK_ERROR_MESSAGE = 'Something went wrong while sending your message. Please try again.';
const CREATE_CONFLICT_MESSAGE =
  'A conversation request is already being processed. Wait a moment, then retry your message.';
const SAFE_NETWORK_ERROR =
  /^(?:network error|failed to fetch|load failed|connection (?:timed out|refused|lost)|request timed out)\b/i;

interface IStudyChatErrorContext {
  operation?: 'create' | 'send' | 'delete';
}

export const getStudyChatErrorMessage = (
  error: unknown,
  context: IStudyChatErrorContext = {}
): string => {
  const status = getHttpStatus(error);
  if (status === 409 && context.operation === 'create') return CREATE_CONFLICT_MESSAGE;
  if (status !== undefined) return ERROR_MESSAGES[status] ?? FALLBACK_ERROR_MESSAGE;

  if (error instanceof Error && SAFE_NETWORK_ERROR.test(error.message.trim())) {
    return error.message.trim();
  }
  return FALLBACK_ERROR_MESSAGE;
};
