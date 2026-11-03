import { performance } from 'node:perf_hooks';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { MetricsService } from '@/modules/metrics/metrics.service.js';

export const registerMetricsHooks = (fastify: FastifyInstance, metrics: MetricsService): void => {
  const requests = new WeakMap<object, (status: number) => void>();

  const finishRequest = (request: FastifyRequest, status: number) => {
    requests.get(request)?.(status);
  };

  fastify.addHook('onRequest', async (request, reply) => {
    const route = request.routeOptions.url ?? 'not_found';
    if (route === '/metrics') return;

    const finish = metrics.beginRequest(route);
    const startedAt = performance.now();
    const complete = (status: number) => {
      finish(
        { method: request.method, route, status },
        Math.max(0, performance.now() - startedAt) / 1000
      );
      requests.delete(request);
    };

    requests.set(request, complete);
    reply.raw.once('close', () => {
      if (!reply.raw.writableFinished) complete(499);
    });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    finishRequest(request, reply.statusCode);
  });

  fastify.addHook('onError', async (request, reply) => {
    finishRequest(request, reply.statusCode >= 400 ? reply.statusCode : 500);
  });
};
