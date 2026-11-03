import { Controller, Get, Headers, Inject, Optional, Res } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import { MetricsService } from './metrics.service.js';

@Controller()
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    @Optional() @Inject('METRICS_BEARER_TOKEN') private readonly bearerToken?: string
  ) {}

  @Get('metrics')
  async scrape(
    @Headers('authorization') authorization: string | undefined,
    @Res() reply: FastifyReply
  ): Promise<FastifyReply> {
    if (!this.bearerToken) return reply.code(404).send();

    const suppliedToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    if (!this.matchesToken(suppliedToken)) return reply.code(401).send();

    const metrics = await this.metricsService.getMetrics();
    return reply
      .header('Content-Type', this.metricsService.contentType)
      .header('Cache-Control', 'no-store')
      .send(metrics);
  }

  private matchesToken(suppliedToken: string | undefined): boolean {
    if (!suppliedToken || !this.bearerToken) return false;
    const expected = Buffer.from(this.bearerToken);
    const supplied = Buffer.from(suppliedToken);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }
}
