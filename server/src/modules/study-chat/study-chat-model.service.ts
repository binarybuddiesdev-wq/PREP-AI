import { randomUUID } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Agent } from '@mastra/core/agent';
import { MetricsService } from '@/modules/metrics/metrics.service.js';
import { TheoryAiTokenBudgetService } from '@/modules/theory/theory-ai-token-budget.service.js';
import type { TheoryAiTokenReservation } from '@/modules/theory/theory-ai-token-budget.service.js';
import { chatWithFailover, getModel } from '@/mastra/providers.js';
import type { StudyChatPromptMessage } from './study-chat.types.js';

export const STUDY_COACH_AGENT = Symbol('STUDY_COACH_AGENT');

@Injectable()
export class StudyChatModelService {
  constructor(
    @Inject(STUDY_COACH_AGENT) private readonly agent: Pick<Agent, 'generate'>,
    private readonly metrics: MetricsService,
    private readonly tokenBudget: TheoryAiTokenBudgetService,
    @InjectPinoLogger(StudyChatModelService.name) private readonly logger: PinoLogger
  ) {}

  async generateReply(
    clerkUserId: string,
    messages: StudyChatPromptMessage[],
    signal?: AbortSignal
  ): Promise<string> {
    const estimatedTokens =
      messages.reduce((total, message) => {
        const content =
          typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content ?? '');
        return total + Buffer.byteLength(content, 'utf8');
      }, 0) +
      1_500 +
      256;
    const reservation = await this.tokenBudget.reserve(clerkUserId, randomUUID(), estimatedTokens);
    if (!reservation.allowed) {
      throw new HttpException('Daily AI token budget reached', HttpStatus.TOO_MANY_REQUESTS);
    }

    const response = await chatWithFailover(
      (provider) =>
        this.agent.generate(messages, {
          model: getModel(provider),
          modelSettings: { maxOutputTokens: 1_500 },
          ...(signal ? { abortSignal: signal } : {}),
        }),
      (from, to) => this.metrics.recordProviderFailover(from, to),
      (provider, fallback, duration) =>
        this.metrics.recordMastraAgentDuration('study_chat', provider, fallback, duration)
    );
    const actualTokens = (await readTotalTokens(response.usage)) ?? estimatedTokens;
    try {
      await this.tokenBudget.settle(reservation, actualTokens);
    } catch (error) {
      this.logger.warn(
        { err: error },
        'Could not settle study chat token usage; keeping the reserved allowance'
      );
    }
    const reply = response.text.trim();
    if (!reply) {
      this.logger.warn('Study coach returned an empty reply');
      throw new Error('Study coach returned an empty reply');
    }
    return reply;
  }
}

async function readTotalTokens(usage: unknown): Promise<number | undefined> {
  try {
    const resolved = await usage;
    if (!resolved || typeof resolved !== 'object') return undefined;
    const tokenUsage = resolved as Record<string, unknown>;
    const total = Number(tokenUsage['totalTokens']);
    if (Number.isSafeInteger(total) && total >= 0) return total;
    const input = Number(tokenUsage['inputTokens'] ?? tokenUsage['promptTokens']);
    const output = Number(tokenUsage['outputTokens'] ?? tokenUsage['completionTokens']);
    const sum = input + output;
    return Number.isSafeInteger(sum) && sum >= 0 ? sum : undefined;
  } catch {
    return undefined;
  }
}
