import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/postgresql-client/index.js';
import { PrismaPostgresqlService, PrismaService } from '@/prisma/prisma.service.js';
import { PdfRetrievalService } from './pdf-retrieval.service.js';
import {
  PdfAiTokenBudgetExceededError,
  PdfQuestionGeneratorService,
} from './pdf-question-generator.service.js';
import { PromptInjectionBlockedError } from '../../mastra/prompt-injection-guard.js';

@Injectable()
export class PdfStudyGenerationService {
  constructor(
    private readonly postgres: PrismaPostgresqlService,
    private readonly prisma: PrismaService,
    private readonly retrieval: PdfRetrievalService,
    private readonly generator: PdfQuestionGeneratorService
  ) {}

  async generate(sessionId: string): Promise<void> {
    const { ownerId, session } = await this.loadSession(sessionId);
    if (!session) throw new NotFoundException('PDF study session not found');
    if (['ready', 'insufficient_material', 'failed'].includes(session.pdfGenerationStatus ?? ''))
      return;

    await this.updateSession(sessionId, ownerId, {
      pdfGenerationStatus: 'running',
      pdfGenerationError: null,
    });

    const selections = parseSelections(session.pdfIds, session.pdfRevisions);
    if (!selections) {
      await this.updateSession(sessionId, ownerId, {
        pdfGenerationStatus: 'failed',
        pdfGenerationError: 'invalid_pdf_selection',
      });
      return;
    }

    const sources = await this.prisma.pdfSource.findMany({
      where: {
        id: { in: selections.map((selection) => selection.sourceId) },
        userId: ownerId,
        status: { in: ['ready', 'processing'] },
      },
      select: { id: true, displayName: true, activeRevision: true },
    });
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    if (
      selections.some(
        (selection) => sourcesById.get(selection.sourceId)?.activeRevision !== selection.revision
      )
    ) {
      await this.updateSession(sessionId, ownerId, {
        pdfGenerationStatus: 'failed',
        pdfGenerationError: 'pdf_source_unavailable',
      });
      return;
    }

    const chunks = await this.retrieval.retrieve(
      ownerId,
      selections,
      `Generate ${session.totalQuestions} ${session.difficulty} interview practice questions from the selected study material. Focus on the most important concepts.`
    );
    if (!chunks.length) {
      await this.updateSession(sessionId, ownerId, {
        pdfGenerationStatus: 'insufficient_material',
        pdfGenerationError: 'insufficient_material',
        pdfQuestions: [],
      });
      return;
    }

    let generated: Awaited<ReturnType<PdfQuestionGeneratorService['generate']>>;
    try {
      generated = await this.generator.generate({
        userId: ownerId,
        totalQuestions: session.totalQuestions,
        difficulty: session.difficulty,
        chunks: chunks.map(({ id, pageStart, text }) => ({ id, page: pageStart, text })),
      });
    } catch (error) {
      if (error instanceof PdfAiTokenBudgetExceededError) {
        await this.updateSession(sessionId, ownerId, {
          pdfGenerationStatus: 'failed',
          pdfGenerationError: 'daily_ai_token_budget_exceeded',
        });
        return;
      }
      if (error instanceof PromptInjectionBlockedError) {
        await this.updateSession(sessionId, ownerId, {
          pdfGenerationStatus: 'failed',
          pdfGenerationError: 'unsafe_source_content',
        });
        return;
      }
      throw error;
    }
    const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
    const questions = generated.questions.map((question) => {
      const citations = question.citationChunkIds.map((chunkId) => {
        const chunk = chunksById.get(chunkId);
        const source = chunk && sourcesById.get(chunk.sourceId);
        if (!chunk || !source || chunk.pageStart !== chunk.pageEnd) {
          throw new Error('Question generator returned an invalid citation');
        }
        return {
          pdfId: source.id,
          displayName: source.displayName,
          page: chunk.pageStart,
          chunkId,
        };
      });
      if (!citations.length) throw new Error('Question generator returned an invalid citation');
      return {
        id: randomUUID(),
        question: question.question,
        referenceAnswer: question.referenceAnswer,
        citations,
      };
    });

    await this.updateSession(sessionId, ownerId, {
      pdfGenerationStatus: 'ready',
      pdfGenerationError: null,
      pdfQuestions: questions as Prisma.InputJsonValue,
    });
  }

  async markFailed(sessionId: string): Promise<void> {
    const { ownerId, session } = await this.loadSession(sessionId);
    if (
      !ownerId ||
      !session ||
      !['queued', 'running'].includes(session.pdfGenerationStatus ?? '')
    ) {
      return;
    }
    await this.updateSession(
      sessionId,
      ownerId,
      {
        pdfGenerationStatus: 'failed',
        pdfGenerationError: 'question_generation_failed',
      },
      ['queued', 'running']
    );
  }

  private async loadSession(sessionId: string) {
    return this.postgres.withWorkerJobContext(sessionId, async (transaction) => {
      const [owner] = await transaction.$queryRaw<Array<{ owner_id: string }>>`
        SELECT owner_id FROM public.prepai_get_pdf_study_session_owner(${sessionId})
      `;
      if (!owner) return { ownerId: undefined, session: undefined };
      await this.postgres.setTenantContext(transaction, owner.owner_id);
      await this.postgres.setWorkerSessionContext(transaction, sessionId);
      const session = await transaction.theorySession.findUnique({ where: { id: sessionId } });
      if (!session || session.mode !== 'pdf')
        return { ownerId: owner.owner_id, session: undefined };
      return { ownerId: owner.owner_id, session };
    });
  }

  private async updateSession(
    sessionId: string,
    ownerId: string,
    data: Record<string, unknown>,
    expectedStatuses?: string[]
  ) {
    const updated = await this.postgres.withWorkerJobContext(sessionId, async (transaction) => {
      const [owner] = await transaction.$queryRaw<Array<{ owner_id: string }>>`
        SELECT owner_id FROM public.prepai_get_pdf_study_session_owner(${sessionId})
      `;
      if (!owner || owner.owner_id !== ownerId) return { count: 0 };
      await this.postgres.setTenantContext(transaction, ownerId);
      await this.postgres.setWorkerSessionContext(transaction, sessionId);
      return transaction.theorySession.updateMany({
        where: {
          id: sessionId,
          userId: ownerId,
          mode: 'pdf',
          ...(expectedStatuses ? { pdfGenerationStatus: { in: expectedStatuses } } : {}),
        },
        data,
      });
    });
    if (!updated.count && !expectedStatuses) {
      throw new NotFoundException('PDF study session not found');
    }
  }
}

function parseSelections(
  pdfIds: string[],
  revisions: Prisma.JsonValue | null
): Array<{ sourceId: string; revision: number }> | undefined {
  if (!Array.isArray(pdfIds) || !pdfIds.length || !revisions || typeof revisions !== 'object') {
    return undefined;
  }
  const record = revisions as Record<string, unknown>;
  const selections = pdfIds.map((sourceId) => ({ sourceId, revision: record[sourceId] }));
  if (
    selections.some(
      (selection) => !Number.isInteger(selection.revision) || Number(selection.revision) < 1
    )
  ) {
    return undefined;
  }
  return selections.map(({ sourceId, revision }) => ({ sourceId, revision: Number(revision) }));
}
