import { HTTPError } from 'ky';
import { describe, expect, it } from 'vitest';

import { isPdfQuestionGenerationPending } from './pdfQuestionGeneration';

const makeHttpError = (status: number, message: string) => {
  const error = new HTTPError(
    new Response(null, { status }),
    new Request('http://localhost/api/v1/theory/session/session-one/questions'),
    {} as never
  );
  error.message = message;
  return error;
};

describe('isPdfQuestionGenerationPending', () => {
  it('recognizes only the exact PDF generation conflict response', () => {
    expect(
      isPdfQuestionGenerationPending(
        makeHttpError(409, 'PDF study questions are still being generated')
      )
    ).toBe(true);
    expect(isPdfQuestionGenerationPending(makeHttpError(409, 'Another conflict occurred'))).toBe(
      false
    );
    expect(
      isPdfQuestionGenerationPending(
        makeHttpError(503, 'PDF study questions are still being generated')
      )
    ).toBe(false);
    expect(
      isPdfQuestionGenerationPending(new Error('PDF study questions are still being generated'))
    ).toBe(false);
  });
});
