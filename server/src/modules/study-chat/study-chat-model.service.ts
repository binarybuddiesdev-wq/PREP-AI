import { randomUUID } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Agent } from '@mastra/core/agent';
import { MetricsService } from '@/modules/metrics/metrics.service.js';
import { TheoryAiTokenBudgetService } from '@/modules/theory/theory-ai-token-budget.service.js';
import type { TheoryAiTokenReservation } from '@/modules/theory/theory-ai-token-budget.service.js';
import { chatWithFailover, getModel } from '@/mastra/providers.js';
import {
  createPromptInjectionGuard,
  estimatePromptInjectionGuardTokens,
  isPromptInjectionGuardFailure,
  PROMPT_INJECTION_BLOCKED_MESSAGE,
  PROMPT_INJECTION_GUARD_UNAVAILABLE_MESSAGE,
  PromptInjectionBlockedError,
} from '@/mastra/prompt-injection-guard.js';
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
    const latestMessage = messages.at(-1);
    const latestContent = latestMessage
      ? typeof latestMessage.content === 'string'
        ? latestMessage.content
        : JSON.stringify(latestMessage.content ?? '')
      : '';
    const guardTokenAllowance = estimatePromptInjectionGuardTokens(latestContent);
    const estimatedTokens =
      messages.reduce((total, message) => {
        const content =
          typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content ?? '');
        return total + Buffer.byteLength(content, 'utf8');
      }, 0) +
      1_500 +
      256 +
      guardTokenAllowance;
    const reservation = await this.tokenBudget.reserve(clerkUserId, randomUUID(), estimatedTokens);
    if (!reservation.allowed) {
      throw new HttpException('Daily AI token budget reached', HttpStatus.TOO_MANY_REQUESTS);
    }

    let injectionDetected = false;
    let response: Awaited<ReturnType<typeof this.agent.generate>>;
    try {
      response = await chatWithFailover(
        async (provider) => {
          if (injectionDetected) throw new PromptInjectionBlockedError();
          const generated = await this.agent.generate(messages, {
            model: getModel(provider),
            inputProcessors: [
              createPromptInjectionGuard(provider, ({ flagged }) => {
                if (flagged) injectionDetected = true;
              }),
            ],
            modelSettings: { maxOutputTokens: 1_500 },
            ...(signal ? { abortSignal: signal } : {}),
          });
          if (injectionDetected) throw new PromptInjectionBlockedError();
          return generated;
        },
        (from, to) => this.metrics.recordProviderFailover(from, to),
        (provider, fallback, duration) =>
          this.metrics.recordMastraAgentDuration('study_chat', provider, fallback, duration)
      );
    } catch (error) {
      if (injectionDetected || error instanceof PromptInjectionBlockedError) {
        throw new HttpException(PROMPT_INJECTION_BLOCKED_MESSAGE, HttpStatus.BAD_REQUEST);
      }
      if (isPromptInjectionGuardFailure(error)) {
        throw new HttpException(
          PROMPT_INJECTION_GUARD_UNAVAILABLE_MESSAGE,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      throw error;
    }
    const actualTokens =
      ((await readTotalTokens(response.usage)) ?? estimatedTokens - guardTokenAllowance) +
      guardTokenAllowance;
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
