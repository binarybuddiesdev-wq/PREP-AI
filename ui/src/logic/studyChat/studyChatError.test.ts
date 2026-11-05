import { HTTPError } from 'ky';
import { describe, expect, it } from 'vitest';

import { getStudyChatErrorMessage } from './studyChatError';

const httpError = (status: number) =>
  new HTTPError(new Response(null, { status }), new Request('http://api.test'), {} as never);

describe('getStudyChatErrorMessage', () => {
  it.each([
    [400, "That message couldn't be sent. Check it and try again."],
    [404, 'This conversation is no longer available. Return to your conversations.'],
    [409, 'This conversation changed while you were sending. Refresh it and retry your message.'],
    [429, "You've reached today's AI usage limit. Your draft is kept; try again later."],
    [503, 'The assistant is temporarily unavailable. Your draft is kept; please retry.'],
  ])('maps HTTP %s to a safe actionable message', (status, expected) => {
    expect(getStudyChatErrorMessage(httpError(status))).toBe(expected);
  });

  it('explains create conflicts without asking the user to refresh a conversation that does not exist yet', () => {
    expect(getStudyChatErrorMessage(httpError(409), { operation: 'create' })).toBe(
      'A conversation request is already being processed. Wait a moment, then retry your message.'
    );
  });

  it('does not expose untrusted HTTP response text for an unknown status', () => {
    expect(getStudyChatErrorMessage(httpError(500))).toBe(
      'Something went wrong while sending your message. Please try again.'
    );
  });

  it('uses the safe message from a non-HTTP error when available', () => {
    expect(getStudyChatErrorMessage(new Error('Connection timed out.'))).toBe(
      'Connection timed out.'
    );
  });

  it('uses a fallback when an error has no useful message', () => {
    expect(getStudyChatErrorMessage(new Error(''))).toBe(
      'Something went wrong while sending your message. Please try again.'
    );
  });
});
