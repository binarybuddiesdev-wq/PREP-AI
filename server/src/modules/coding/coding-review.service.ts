import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { z } from 'zod';
import { MetricsService } from '../metrics/metrics.service.js';
import { CODING_DATABASE_UNAVAILABLE } from '@/common/constants/api.constants.js';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { mastra } from '../../mastra/mastra.config.js';
import { chatWithFailover, defaultModel, getModel } from '../../mastra/providers.js';
import {
  buildCodingReviewPrompt,
  CODING_REVIEW_PROMPT_VERSION,
} from '../../mastra/agents/coding-review-prompts.js';
import type { ICodingReviewJobData, ICodingReviewResult } from './coding-review.types.js';
import { Prisma } from '../../generated/postgresql-client/index.js';

const codingReviewSchema = z
  .object({
    summary: z.string().min(1).max(800),
    timeComplexity: z.string().min(1).max(100),
    spaceComplexity: z.string().min(1).max(100),
    strengths: z.array(z.string().min(1).max(300)).max(4),
    improvements: z.array(z.string().min(1).max(300)).min(1).max(5),
  })
  .strict();

@Injectable()
export class CodingReviewService {
  constructor(
    private readonly postgres: PrismaPostgresqlService,
    @InjectPinoLogger(CodingReviewService.name) private readonly logger: PinoLogger,
    private readonly metrics: MetricsService
  ) {}

  async review(executionId: string): Promise<void> {
    const context = await this.withWorkerExecution(executionId, async (transaction, owner) => {
      const execution = await transaction.codingExecution.findFirst({
        where: { id: executionId, userId: owner.owner_id },
        select: {
          id: true,
          operation: true,
          status: true,
          language: true,
          sourceCode: true,
          result: true,
          problemId: true,
        },
      });
      if (!execution || execution.operation !== 'submit' || execution.status !== 'completed') {
        return null;
      }
      const answer = await transaction.codingAnswer.findFirst({
        where: { executionId, userId: owner.owner_id },
        select: { id: true, aiReviewStatus: true },
      });
      if (!answer) return null;
      const problem = await transaction.codingQuestion.findUnique({
        where: { id: execution.problemId },
        select: { title: true, description: true, constraints: true },
      });
      if (!problem) return null;
      const runResult = (execution.result ?? {}) as Record<string, unknown>;
      return {
        answer,
        problem,
        language: execution.language,
        sourceCode: execution.sourceCode,
        testCasesPassed: Number(runResult['testCasesPassed'] ?? 0),
        testCasesTotal: Number(runResult['testCasesTotal'] ?? 0),
      };
    });
    if (!context) throw new NotFoundException('Coding review source not found');
    if (context.answer.aiReviewStatus === 'completed' || context.answer.aiReviewStatus === 'failed')
      return;
    if (!['queued', 'running'].includes(context.answer.aiReviewStatus)) return;

    if (context.answer.aiReviewStatus === 'queued') {
      const claimed = await this.withWorkerExecution(executionId, (transaction, owner) =>
        transaction.codingAnswer.updateMany({
          where: { id: context.answer.id, userId: owner.owner_id, aiReviewStatus: 'queued' },
          data: { aiReviewStatus: 'running', aiReviewFailureMessage: null },
        })
      );
      if (claimed.count !== 1) return;
    }

    const agent = mastra.getAgent('codingReviewAgent');
    const prompt = buildCodingReviewPrompt({
      title: context.problem.title,
      description: context.problem.description,
      constraints: context.problem.constraints,
      language: context.language,
      sourceCode: context.sourceCode,
      testCasesPassed: context.testCasesPassed,
      testCasesTotal: context.testCasesTotal,
    });
    const generated = await chatWithFailover(
      async (provider) => ({
        provider,
        result: codingReviewSchema.parse(
          (
            await agent.generate(prompt, {
              model: getModel(provider),
              modelSettings: { maxOutputTokens: 1_024 },
              structuredOutput: { schema: codingReviewSchema, jsonPromptInjection: true },
            })
          ).object
        ),
      }),
      (from, to) => this.metrics.recordProviderFailover(from, to)
    );
    await this.persistReview(executionId, context.answer.id, generated.result, generated.provider);
  }

  async markFailed(executionId: string): Promise<void> {
    const answerId = await this.withWorkerExecution(executionId, async (transaction, owner) => {
      const answer = await transaction.codingAnswer.findFirst({
        where: { executionId, userId: owner.owner_id },
        select: { id: true },
      });
      if (!answer) return undefined;
      await transaction.codingAnswer.updateMany({
        where: {
          id: answer.id,
          userId: owner.owner_id,
          aiReviewStatus: { in: ['queued', 'running'] },
        },
        data: { aiReviewStatus: 'failed', aiReviewFailureMessage: 'review_unavailable' },
      });
      return answer.id;
    });
    if (answerId)
      this.logger.warn({ executionId, answerId }, 'Coding review reached terminal failure');
  }

  async findQueuedForDispatch(limit = 100): Promise<ICodingReviewJobData[]> {
    const worker = this.postgres.workerClient_;
    if (!worker) throw new ServiceUnavailableException(CODING_DATABASE_UNAVAILABLE);
    const queued = await worker.$queryRaw<Array<{ execution_id: string }>>`
      SELECT execution_id FROM public.prepai_list_queued_coding_review_execution_ids(${limit}::integer)
    `;
    return queued.map(({ execution_id }) => ({
      idempotencyKey: execution_id,
      executionId: execution_id,
    }));
  }

  private async persistReview(
    executionId: string,
    answerId: string,
    result: ICodingReviewResult,
    provider: 'nvidia' | 'groq'
  ): Promise<void> {
    await this.withWorkerExecution(executionId, async (transaction, owner) => {
      const updated = await transaction.codingAnswer.updateMany({
        where: {
          id: answerId,
          userId: owner.owner_id,
          aiReviewStatus: 'running',
        },
        data: {
          aiReviewStatus: 'completed',
          aiReviewFailureMessage: null,
          aiReviewJson: result as unknown as Prisma.InputJsonValue,
          aiReviewProvider: provider,
          aiReviewModel: defaultModel[provider](),
          aiReviewPromptVersion: CODING_REVIEW_PROMPT_VERSION,
        },
      });
      if (updated.count === 1) return;
      const latest = await transaction.codingAnswer.findFirst({
        where: { id: answerId, userId: owner.owner_id },
        select: { aiReviewStatus: true },
      });
      if (latest?.aiReviewStatus === 'completed' || latest?.aiReviewStatus === 'failed') return;
      throw new Error('Coding review could not transition to completed');
    });
  }

  private async withWorkerExecution<T>(
    executionId: string,
    operation: (
      transaction: import('../../generated/postgresql-client/index.js').Prisma.TransactionClient,
      owner: { owner_id: string; session_id: string }
    ) => Promise<T>
  ): Promise<T> {
    return this.postgres.withWorkerJobContext(executionId, async (transaction) => {
      const [owner] = await transaction.$queryRaw<Array<{ owner_id: string; session_id: string }>>`
        SELECT owner_id, session_id FROM public.prepai_get_coding_execution_owner(${executionId})
      `;
      if (!owner) throw new NotFoundException('Coding execution not found');
      await this.postgres.setTenantContext(transaction, owner.owner_id);
      await this.postgres.setWorkerSessionContext(transaction, owner.session_id);
      return operation(transaction, owner);
    });
  }
}
