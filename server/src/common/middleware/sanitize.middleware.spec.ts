import { describe, expect, it, vi } from 'vitest';
import { SanitizeMiddleware } from './sanitize.middleware.js';

describe('SanitizeMiddleware', () => {
  const middleware = new SanitizeMiddleware();
  const response = {} as never;

  it('trims string fields and leaves other field values untouched', () => {
    const request = { body: { name: '  Ada  ', count: 2, enabled: true, detail: null } };
    const next = vi.fn();

    middleware.use(request as never, response, next);

    expect(request.body).toEqual({ name: 'Ada', count: 2, enabled: true, detail: null });
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([undefined, null, 'text', 42])('passes through a non-object body: %s', (body) => {
    const request = { body };
    const next = vi.fn();

    middleware.use(request as never, response, next);

    expect(request.body).toBe(body);
    expect(next).toHaveBeenCalledOnce();
  });
});
