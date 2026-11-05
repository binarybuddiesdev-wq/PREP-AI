import { HTTPError } from 'ky';
import { describe, expect, it } from 'vitest';

import { getCodingReviewRequestError } from './codingReviewRequestError';

const httpError = (status: number, message: string) => {
  const error = new HTTPError(
    new Response(null, { status }),
    new Request(
      'http://api.test/api/v1/coding/session/session-one/executions/execution-one/review'
    ),
    {} as never
  );
  error.message = message;
  return error;
};

describe('getCodingReviewRequestError', () => {
  it('explains that a daily review quota cannot be retried immediately', () => {
    expect(
      getCodingReviewRequestError(httpError(409, 'Daily AI code review limit reached'))
    ).toEqual({
      message: 'You have reached your daily AI review limit. It resets at 00:00 UTC.',
      canRetry: false,
    });
  });

  it('keeps other request errors visible and retryable', () => {
    expect(getCodingReviewRequestError(new Error('The review service is unavailable.'))).toEqual({
      message: 'The review service is unavailable.',
      canRetry: true,
    });
  });
});
