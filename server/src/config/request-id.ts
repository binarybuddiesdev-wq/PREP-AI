import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface RequestWithHeaders {
  headers: { [key: string]: unknown };
}

export function resolveRequestId(value: string | string[] | undefined): string {
  return typeof value === 'string' && UUID_V4_PATTERN.test(value) ? value : randomUUID();
}

export function assignRequestId(request: RequestWithHeaders): string {
  const incoming = request.headers['x-request-id'];
  const requestId = resolveRequestId(
    typeof incoming === 'string' || Array.isArray(incoming) ? incoming : undefined
  );
  Object.assign(request, { id: requestId });
  return requestId;
}

export function registerRequestIdHook(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
    reply.header('X-Request-Id', request.id);
  });
}
