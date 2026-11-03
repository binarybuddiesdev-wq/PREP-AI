import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { assignRequestId, registerRequestIdHook, resolveRequestId } from './request-id.js';

describe('request IDs', () => {
  it('preserves a valid incoming UUID v4', () => {
    const requestId = '8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3';

    expect(resolveRequestId(requestId)).toBe(requestId);
  });

  it('stores the resolved ID on the raw request for the Pino HTTP middleware', () => {
    const requestId = '8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3';
    const request: { headers: Record<string, unknown>; id?: string } = {
      headers: { 'x-request-id': requestId },
    };

    expect(assignRequestId(request)).toBe(requestId);
    expect(request.id).toBe(requestId);
  });

  it.each([
    undefined,
    '',
    'not-a-uuid',
    '8D2F6B25-35F4-4CB7-97D1-310EAF8CD4B3',
    ['8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3'],
  ])('generates a UUID v4 for invalid incoming value %s', (value) => {
    const requestId = resolveRequestId(value);

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    if (typeof value === 'string' && value.length > 0) expect(requestId).not.toBe(value);
  });

  it('echoes Fastify request IDs in the response header', async () => {
    const hooks = new Map<string, (...args: never[]) => unknown>();
    const fastify = {
      addHook: (name: string, handler: (...args: never[]) => unknown) => hooks.set(name, handler),
    } as unknown as FastifyInstance;
    const reply = { header: vi.fn() } as unknown as FastifyReply;
    const request = { id: '8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3' } as FastifyRequest;
    registerRequestIdHook(fastify);

    await hooks.get('onRequest')!(request as never, reply as never);

    expect(reply.header).toHaveBeenCalledWith('X-Request-Id', request.id);
  });
});
