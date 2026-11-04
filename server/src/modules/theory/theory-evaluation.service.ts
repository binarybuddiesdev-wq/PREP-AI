import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { z } from 'zod';
import {
  THEORY_DATABASE_UNAVAILABLE,
  THEORY_EVALUATION_UNAVAILABLE,
  THEORY_AI_TOKEN_BUDGET_REACHED,
} from '@/common/constants/api.constants.js';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { mastra } from '../../mastra/mastra.config.js';
import { chatWithFailover, defaultModel, getModel } from '../../mastra/providers.js';
import {
  createPromptInjectionGuard,
  estimatePromptInjectionGuardTokens,
  isPromptInjectionGuardFailure,
  PromptInjectionBlockedError,
} from '../../mastra/prompt-injection-guard.js';
import {
  currentTheoryEvaluatorPrompt,
  THEORY_EVALUATOR_PROMPT_VERSION,
} from '../../mastra/agents/theory-evaluator-prompts.js';
import type {
  ITheoryEvaluationJobData,
  ITheoryEvaluationResult,
} from './theory-evaluation.types.js';
import { TheoryAiTokenBudgetService } from './theory-ai-token-budget.service.js';
import { MetricsService } from '../metrics/metrics.service.js';

const MAX_THEORY_EVALUATION_FEEDBACK_LENGTH = 2000;
const MAX_THEORY_EVALUATION_OUTPUT_TOKENS = 512;

const theoryAnswerEvalSchema = z.object({
  score: z.number().min(0).max(10).describe('Score from 0 to 10 evaluating the answer quality'),
  feedback: z
    .string()
    .max(MAX_THEORY_EVALUATION_FEEDBACK_LENGTH)
    .describe('Constructive feedback on the answer'),
});

const theoryEvaluationFallback: ITheoryEvaluationResult = {
  score: 5,
  feedback: 'Unable to evaluate answer at this time.',
};

@Injectable()
export class TheoryEvaluationService {
  constructor(
    private readonly postgres: PrismaPostgresqlService,
    @InjectPinoLogger(TheoryEvaluationService.name) private readonly logger: PinoLogger,
    private readonly tokenBudget: TheoryAiTokenBudgetService,
    private readonly metrics: MetricsService
  ) {}

  async evaluate(answerId: string): Promise<void> {
    const answer = await this.withWorkerAnswer(answerId, (transaction) =>
      transaction.theoryAnswer.findUnique({
        where: { id: answerId },
        include: { session: { select: { userId: true } } },
      })
    );
    if (!answer) throw new NotFoundException('Theory answer not found');
    if (answer.status === 'completed' || answer.status === 'failed') return;

    await this.withWorkerAnswer(answerId, (transaction) =>
      transaction.theoryAnswer.updateMany({
        where: { id: answerId, status: 'queued' },
        data: { status: 'running', startedAt: new Date(), dispatchClaimedAt: null },
      })
    );

    const agent = mastra.getAgent('theoryEvaluatorAgent');
    const prompt = currentTheoryEvaluatorPrompt.buildPrompt({
      question: answer.questionText,
      answer: answer.userAnswer,
    });
    const estimatedTokens = estimateTheoryEvaluationTokenReservation(
      prompt,
      currentTheoryEvaluatorPrompt.instructions
    );
    const guardTokenAllowance = estimatePromptInjectionGuardTokens(prompt);
    const reservedTokens = estimatedTokens + guardTokenAllowance;
    let budgetExceeded = false;
    let budgetUnavailable = false;
    let injectionDetected = false;
    let providerResult: {
      provider: 'nvidia' | 'groq';
      response: Awaited<ReturnType<typeof agent.generate>>;
    };
    try {
      providerResult = await chatWithFailover(
        async (provider) => {
          if (budgetExceeded || budgetUnavailable || injectionDetected) {
            if (injectionDetected) throw new PromptInjectionBlockedError();
            throw new Error('Theory AI token budget reservation is unavailable');
          }
          let reservation;
          try {
            reservation = await this.tokenBudget.reserve(
              answer.session.userId,
              randomUUID(),
              reservedTokens
            );
          } catch (error: unknown) {
            budgetUnavailable = true;
            throw error;
          }
          if (!reservation.allowed) {
            budgetExceeded = true;
            throw new Error('Daily AI token budget reached');
          }
          const response = await agent.generate(prompt, {
            model: getModel(provider),
            instructions: currentTheoryEvaluatorPrompt.instructions,
            inputProcessors: [
              createPromptInjectionGuard(provider, ({ flagged }) => {
                if (flagged) injectionDetected = true;
              }),
            ],
            modelSettings: { maxOutputTokens: MAX_THEORY_EVALUATION_OUTPUT_TOKENS },
            structuredOutput: {
              schema: theoryAnswerEvalSchema,
              jsonPromptInjection: true,
              errorStrategy: 'fallback',
              fallbackValue: theoryEvaluationFallback,
            },
          });
          if (injectionDetected) throw new PromptInjectionBlockedError();
          let actualTokens = reservedTokens;
          try {
            const usage = await response.usage;
            actualTokens = (readTotalTokens(usage) ?? estimatedTokens) + guardTokenAllowance;
          } catch (error: unknown) {
            this.logger.warn(
              { answerId, error: error instanceof Error ? error.message : String(error) },
              'Could not read provider token usage; keeping the reserved allowance'
            );
          }
          try {
            await this.tokenBudget.settle(reservation, actualTokens);
          } catch (error: unknown) {
            this.logger.warn(
              { answerId, error: error instanceof Error ? error.message : String(error) },
              'Could not settle AI token usage; keeping the reserved allowance'
            );
          }
          return { provider, response };
        },
        (from, to) => this.metrics.recordProviderFailover(from, to),
        (provider, fallback, duration) =>
          this.metrics.recordMastraAgentDuration('theory_evaluator', provider, fallback, duration)
      );
    } catch (error: unknown) {
      if (budgetExceeded) {
        await this.withWorkerAnswer(answerId, (transaction) =>
          transaction.theoryAnswer.updateMany({
            where: { id: answerId, status: 'running' },
            data: {
              status: 'failed',
              failureMessage: THEORY_AI_TOKEN_BUDGET_REACHED,
              completedAt: new Date(),
            },
          })
        );
        this.logger.warn({ answerId }, 'Theory evaluation stopped at the daily AI token budget');
        return;
      }
      if (injectionDetected) {
        await this.withWorkerAnswer(answerId, (transaction) =>
          transaction.theoryAnswer.updateMany({
            where: { id: answerId, status: 'running' },
            data: {
              status: 'failed',
              failureMessage: THEORY_EVALUATION_UNAVAILABLE,
              completedAt: new Date(),
            },
          })
        );
        this.logger.warn({ answerId }, 'Theory evaluation blocked a prompt-injection attempt');
        return;
      }
      if (budgetUnavailable) {
        throw new ServiceUnavailableException(
          'AI token budget service is temporarily unavailable',
          {
            cause: error,
          }
        );
      }
      if (isPromptInjectionGuardFailure(error)) {
        throw new ServiceUnavailableException('AI safety check is temporarily unavailable', {
          cause: error,
        });
      }
      throw error;
    }
    const { provider, response } = providerResult;
    const result = theoryAnswerEvalSchema.parse(response.object ?? theoryEvaluationFallback);
    if (
      result.score === theoryEvaluationFallback.score &&
      result.feedback === theoryEvaluationFallback.feedback
    ) {
      throw new ServiceUnavailableException(THEORY_EVALUATION_UNAVAILABLE);
    }

    const persisted = await this.withWorkerAnswer(answerId, (transaction) =>
      transaction.theoryAnswer.updateMany({
        where: { id: answerId, status: 'running' },
        data: {
          status: 'completed',
          aiScore: Math.max(0, Math.min(10, result.score)),
          aiFeedback: result.feedback,
          evaluationProvider: provider,
          evaluationModel: defaultModel[provider](),
          evaluationPromptVersion: THEORY_EVALUATOR_PROMPT_VERSION,
          completedAt: new Date(),
        },
      })
    );
    if (persisted.count === 0) {
      const latest = await this.withWorkerAnswer(answerId, (transaction) =>
        transaction.theoryAnswer.findUnique({ where: { id: answerId } })
      );
      if (latest?.status === 'completed' || latest?.status === 'failed') return;
      throw new Error(`Theory answer ${answerId} could not transition to completed`);
    }
    this.logger.info({ answerId }, 'Theory answer evaluation completed');
  }

  async markFailed(answerId: string): Promise<void> {
    await this.withWorkerAnswer(answerId, (transaction) =>
      transaction.theoryAnswer.updateMany({
        where: { id: answerId, status: { in: ['queued', 'running'] } },
        data: {
          status: 'failed',
          failureMessage: THEORY_EVALUATION_UNAVAILABLE,
          completedAt: new Date(),
        },
      })
    );
  }

  async findQueuedForDispatch(limit = 100): Promise<ITheoryEvaluationJobData[]> {
    const worker = this.postgres.workerClient_;
    if (!worker) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);
    const queuedAnswers = await worker.$queryRaw<Array<{ answer_id: string }>>`
      SELECT answer_id FROM public.prepai_list_queued_theory_answer_ids(${limit}::integer)
    `;
    return queuedAnswers.map(({ answer_id }) => ({
      idempotencyKey: answer_id,
      answerId: answer_id,
    }));
  }

  private async withWorkerAnswer<T>(
    answerId: string,
    operation: (
      transaction: import('../../generated/postgresql-client/index.js').Prisma.TransactionClient
    ) => Promise<T>
  ): Promise<T> {
    return this.postgres.withWorkerJobContext(answerId, async (transaction) => {
      const [owner] = await transaction.$queryRaw<Array<{ owner_id: string }>>`
        SELECT owner_id FROM public.prepai_get_theory_answer_owner(${answerId})
      `;
      if (!owner) throw new NotFoundException('Theory answer not found');
      await this.postgres.setTenantContext(transaction, owner.owner_id);
      return operation(transaction);
    });
  }

  private database() {
    const pg = this.postgres.client_;
    if (!pg) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);
    return pg;
  }
}

export function estimateTheoryEvaluationTokenReservation(
  prompt: string,
  instructions: string
): number {
  const inputByteAllowance =
    Buffer.byteLength(prompt, 'utf8') + Buffer.byteLength(instructions, 'utf8');
  return inputByteAllowance + MAX_THEORY_EVALUATION_OUTPUT_TOKENS + 256;
}

function readTotalTokens(usage: unknown): number | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const tokenUsage = usage as Record<string, unknown>;
  const total = Number(tokenUsage['totalTokens']);
  if (Number.isSafeInteger(total) && total >= 0) return total;
  const input = Number(tokenUsage['inputTokens'] ?? tokenUsage['promptTokens']);
  const output = Number(tokenUsage['outputTokens'] ?? tokenUsage['completionTokens']);
  const sum = input + output;
  return Number.isSafeInteger(sum) && sum >= 0 ? sum : undefined;
}
