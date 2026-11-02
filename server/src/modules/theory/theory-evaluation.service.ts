import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { z } from 'zod';
import {
  THEORY_DATABASE_UNAVAILABLE,
  THEORY_EVALUATION_UNAVAILABLE,
} from '@/common/constants/api.constants.js';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { mastra } from '../../mastra/mastra.config.js';
import { chatWithFailover, defaultModel, getModel } from '../../mastra/providers.js';
import {
  currentTheoryEvaluatorPrompt,
  THEORY_EVALUATOR_PROMPT_VERSION,
} from '../../mastra/agents/theory-evaluator-prompts.js';
import type {
  ITheoryEvaluationJobData,
  ITheoryEvaluationResult,
} from './theory-evaluation.types.js';

const MAX_THEORY_EVALUATION_FEEDBACK_LENGTH = 2000;

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
    @InjectPinoLogger(TheoryEvaluationService.name) private readonly logger: PinoLogger
  ) {}

  async evaluate(answerId: string): Promise<void> {
    const pg = this.database();
    const answer = await pg.theoryAnswer.findUnique({ where: { id: answerId } });
    if (!answer) throw new NotFoundException('Theory answer not found');
    if (answer.status === 'completed' || answer.status === 'failed') return;

    await pg.theoryAnswer.updateMany({
      where: { id: answerId, status: 'queued' },
      data: { status: 'running', startedAt: new Date() },
    });

    const agent = mastra.getAgent('theoryEvaluatorAgent');
    const prompt = currentTheoryEvaluatorPrompt.buildPrompt({
      question: answer.questionText,
      answer: answer.userAnswer,
    });
    const { provider, response } = await chatWithFailover(async (provider) => ({
      provider,
      response: await agent.generate(prompt, {
        model: getModel(provider),
        instructions: currentTheoryEvaluatorPrompt.instructions,
        structuredOutput: {
          schema: theoryAnswerEvalSchema,
          jsonPromptInjection: true,
          errorStrategy: 'fallback',
          fallbackValue: theoryEvaluationFallback,
        },
      }),
    }));
    const result = theoryAnswerEvalSchema.parse(response.object ?? theoryEvaluationFallback);
    if (
      result.score === theoryEvaluationFallback.score &&
      result.feedback === theoryEvaluationFallback.feedback
    ) {
      throw new ServiceUnavailableException(THEORY_EVALUATION_UNAVAILABLE);
    }

    const persisted = await pg.theoryAnswer.updateMany({
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
    });
    if (persisted.count === 0) {
      const latest = await pg.theoryAnswer.findUnique({ where: { id: answerId } });
      if (latest?.status === 'completed' || latest?.status === 'failed') return;
      throw new Error(`Theory answer ${answerId} could not transition to completed`);
    }
    this.logger.info({ answerId }, 'Theory answer evaluation completed');
  }

  async markFailed(answerId: string): Promise<void> {
    await this.database().theoryAnswer.updateMany({
      where: { id: answerId, status: { in: ['queued', 'running'] } },
      data: {
        status: 'failed',
        failureMessage: THEORY_EVALUATION_UNAVAILABLE,
        completedAt: new Date(),
      },
    });
  }

  async findQueuedForDispatch(limit = 100): Promise<ITheoryEvaluationJobData[]> {
    const queuedAnswers = await this.database().theoryAnswer.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    return queuedAnswers.map(({ id }) => ({ idempotencyKey: id, answerId: id }));
  }

  private database() {
    const pg = this.postgres.client_;
    if (!pg) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);
    return pg;
  }
}
