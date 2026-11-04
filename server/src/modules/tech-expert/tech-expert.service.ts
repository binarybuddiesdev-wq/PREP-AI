import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service.js';
import { mastra } from '../../mastra/mastra.config.js';
import { chatWithFailover, getModel, streamWithFailover } from '../../mastra/providers.js';
import {
  createPromptInjectionGuard,
  PROMPT_INJECTION_BLOCKED_MESSAGE,
  PROMPT_INJECTION_GUARD_UNAVAILABLE_MESSAGE,
  isPromptInjectionGuardFailure,
  PromptInjectionBlockedError,
} from '../../mastra/prompt-injection-guard.js';
import {
  ITechExpertRequest,
  ITechExpertResponse,
  techAnswerSchema,
  TechAnswer,
} from './tech-expert.types.js';

@Injectable()
export class TechExpertService {
  private readonly logger = new Logger(TechExpertService.name);

  constructor(private readonly metrics: MetricsService) {}

  public async askQuestion(payload: ITechExpertRequest): Promise<ITechExpertResponse> {
    let injectionDetected = false;
    try {
      this.logger.log('Tech Expert question received');

      const agent = mastra.getAgent('techExpertAgent');
      const fallback: TechAnswer = {
        topic: 'Technology',
        summary: 'Unable to parse structured response',
        keyPoints: [],
        examples: [],
        relatedTopics: [],
      };

      const response = await chatWithFailover(
        async (provider) => {
          if (injectionDetected) throw new PromptInjectionBlockedError();
          try {
            return await agent.generate(JSON.stringify({ question: payload.question }), {
              model: getModel(provider),
              inputProcessors: [
                createPromptInjectionGuard(provider, ({ flagged }) => {
                  if (flagged) injectionDetected = true;
                }),
              ],
              structuredOutput: {
                schema: techAnswerSchema,
                jsonPromptInjection: true,
                errorStrategy: 'fallback',
                fallbackValue: fallback,
              },
            });
          } catch (error) {
            if (injectionDetected) throw new PromptInjectionBlockedError();
            throw error;
          }
        },
        (from, to) => this.metrics.recordProviderFailover(from, to),
        (provider, fallback, duration) =>
          this.metrics.recordMastraAgentDuration('tech_expert', provider, fallback, duration)
      );

      const answer = (response.object as TechAnswer) || fallback;

      return {
        data: {
          answer,
          rawResponse: response.text,
        },
        error: null,
        meta: {},
      };
    } catch (error: unknown) {
      if (injectionDetected || error instanceof PromptInjectionBlockedError) {
        this.logger.warn('Tech Expert request blocked by the prompt-injection guard');
        return { data: null, error: PROMPT_INJECTION_BLOCKED_MESSAGE, meta: {} };
      }
      if (isPromptInjectionGuardFailure(error)) {
        this.logger.warn('Tech Expert request rejected because the prompt-injection guard failed');
        return { data: null, error: PROMPT_INJECTION_GUARD_UNAVAILABLE_MESSAGE, meta: {} };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        'Tech Expert answer generation failed',
        error instanceof Error ? error.stack : undefined
      );

      return {
        data: null,
        error: errorMessage,
        meta: {},
      };
    }
  }

  public async *streamQuestion(
    payload: ITechExpertRequest,
    abortSignal?: AbortSignal
  ): AsyncGenerator<string> {
    this.logger.log('Tech Expert streaming question received');
    const agent = mastra.getAgent('techExpertAgent');
    let injectionDetected = false;

    try {
      yield* streamWithFailover(
        async (provider) => {
          if (injectionDetected) throw new PromptInjectionBlockedError();
          try {
            return (
              await agent.stream(JSON.stringify({ question: payload.question }), {
                model: getModel(provider),
                inputProcessors: [
                  createPromptInjectionGuard(provider, ({ flagged }) => {
                    if (flagged) injectionDetected = true;
                  }),
                ],
                ...(abortSignal ? { abortSignal } : {}),
              })
            ).textStream;
          } catch (error) {
            if (injectionDetected) throw new PromptInjectionBlockedError();
            throw error;
          }
        },
        (from, to) => this.metrics.recordProviderFailover(from, to),
        (provider, fallback, duration) =>
          this.metrics.recordMastraAgentDuration('tech_expert', provider, fallback, duration)
      );
    } catch (error: unknown) {
      if (injectionDetected || error instanceof PromptInjectionBlockedError) {
        this.logger.warn('Tech Expert streaming request blocked by the prompt-injection guard');
        throw new PromptInjectionBlockedError();
      }
      if (isPromptInjectionGuardFailure(error)) {
        this.logger.warn('Tech Expert stream rejected because the prompt-injection guard failed');
        throw new Error(PROMPT_INJECTION_GUARD_UNAVAILABLE_MESSAGE, { cause: error });
      }
      this.logger.error(
        'Tech Expert streaming generation failed',
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }
}
