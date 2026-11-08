import { describe, expect, it, vi } from 'vitest';
import { PdfStudyGenerationService } from './pdf-study-generation.service.js';
import { PdfAiTokenBudgetExceededError } from './pdf-question-generator.service.js';
import { PromptInjectionBlockedError } from '../../mastra/prompt-injection-guard.js';

describe('PdfStudyGenerationService', () => {
  function setup(
    chunks = [
      {
        id: 'chunk_1',
        sourceId: 'pdf_1',
        pageStart: 3,
        pageEnd: 3,
        text: 'retrieved text',
        similarity: 0.9,
      },
    ]
  ) {
    const session = {
      id: 'session_1',
      userId: 'user_1',
      mode: 'pdf',
      difficulty: 'Mid',
      totalQuestions: 1,
      pdfIds: ['pdf_1'],
      pdfRevisions: { pdf_1: 2 },
      pdfGenerationStatus: 'queued',
      pdfQuestions: null,
    };
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ owner_id: 'user_1' }]),
      theorySession: {
        findUnique: vi.fn().mockResolvedValue(session),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const postgres = {
      withWorkerJobContext: vi.fn(async (_jobId: string, operation) => operation(transaction)),
      setTenantContext: vi.fn(),
      setWorkerSessionContext: vi.fn(),
    };
    const prisma = {
      pdfSource: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'pdf_1', displayName: 'guide.pdf', status: 'ready', activeRevision: 2 },
          ]),
      },
    };
    const retrieval = { retrieve: vi.fn().mockResolvedValue(chunks) };
    const generator = {
      generate: vi.fn().mockResolvedValue({
        questions: [
          {
            question: 'What is the core idea?',
            referenceAnswer: 'The core idea.',
            citationChunkIds: ['chunk_1'],
          },
        ],
      }),
    };
    const service = new PdfStudyGenerationService(
      postgres as never,
      prisma as never,
      retrieval as never,
      generator as never
    );
    return { service, session, transaction, postgres, prisma, retrieval, generator };
  }

  it('loads owner from persisted session, checks selected revisions, and persists only verified citations', async () => {
    const { service, transaction, postgres, retrieval, generator } = setup();
    await service.generate('session_1');

    expect(postgres.setTenantContext).toHaveBeenCalledWith(transaction, 'user_1');
    expect(postgres.setWorkerSessionContext).toHaveBeenCalledWith(transaction, 'session_1');
    expect(retrieval.retrieve).toHaveBeenCalledWith(
      'user_1',
      [{ sourceId: 'pdf_1', revision: 2 }],
      expect.any(String)
    );
    expect(generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1', totalQuestions: 1, difficulty: 'Mid' })
    );
    const savedQuestions =
      transaction.theorySession.updateMany.mock.calls.at(-1)?.[0].data.pdfQuestions;
    expect(savedQuestions).toHaveLength(1);
    expect(savedQuestions[0].citations).toEqual([
      { pdfId: 'pdf_1', displayName: 'guide.pdf', page: 3, chunkId: 'chunk_1' },
    ]);
  });

  it.each([
    [new PdfAiTokenBudgetExceededError(), 'daily_ai_token_budget_exceeded'],
    [new PromptInjectionBlockedError(), 'unsafe_source_content'],
  ])('persists terminal PDF generation error for %s', async (error, code) => {
    const { service, transaction, generator } = setup();
    generator.generate.mockRejectedValueOnce(error);

    await expect(service.generate('session_1')).resolves.toBeUndefined();

    expect(transaction.theorySession.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          pdfGenerationStatus: 'failed',
          pdfGenerationError: code,
        },
      })
    );
  });

  it('persists insufficient-material without calling the generator when retrieval is empty', async () => {
    const { service, transaction, generator } = setup([]);
    await service.generate('session_1');
    expect(generator.generate).not.toHaveBeenCalled();
    expect(transaction.theorySession.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pdfGenerationStatus: 'insufficient_material' }),
      })
    );
  });

  it('rejects and does not persist citations invented by the model', async () => {
    const { service, transaction, generator } = setup();
    generator.generate.mockResolvedValue({
      questions: [
        {
          question: 'What is the core idea?',
          referenceAnswer: 'Answer',
          citationChunkIds: ['other_chunk'],
        },
      ],
    });
    await expect(service.generate('session_1')).rejects.toThrow(
      'Question generator returned an invalid citation'
    );
    expect(transaction.theorySession.updateMany).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pdfGenerationStatus: 'ready' }) })
    );
  });

  it('does not rerun terminal sessions and rejects sessions without trusted ownership', async () => {
    const terminal = setup();
    terminal.transaction.theorySession.findUnique.mockResolvedValue({
      ...terminal.session,
      pdfGenerationStatus: 'ready',
    });
    await terminal.service.generate('session_1');
    expect(terminal.retrieval.retrieve).not.toHaveBeenCalled();

    const missing = setup();
    missing.transaction.$queryRaw.mockResolvedValue([]);
    await expect(missing.service.generate('session_1')).rejects.toThrow(
      'PDF study session not found'
    );
    const wrongMode = setup();
    wrongMode.transaction.theorySession.findUnique.mockResolvedValue({
      ...wrongMode.session,
      mode: 'topic',
    });
    await expect(wrongMode.service.generate('session_1')).rejects.toThrow(
      'PDF study session not found'
    );
  });

  it('marks invalid selections or unavailable source revisions as safe failures', async () => {
    const invalid = setup();
    invalid.transaction.theorySession.findUnique.mockResolvedValue({
      ...invalid.session,
      pdfRevisions: null,
    });
    await invalid.service.generate('session_1');
    expect(invalid.transaction.theorySession.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pdfGenerationError: 'invalid_pdf_selection' }),
      })
    );

    const stale = setup();
    stale.prisma.pdfSource.findMany.mockResolvedValue([
      { id: 'pdf_1', displayName: 'guide.pdf', activeRevision: 3 },
    ]);
    await stale.service.generate('session_1');
    expect(stale.retrieval.retrieve).not.toHaveBeenCalled();
    expect(stale.transaction.theorySession.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pdfGenerationError: 'pdf_source_unavailable' }),
      })
    );

    const badRevision = setup();
    badRevision.transaction.theorySession.findUnique.mockResolvedValue({
      ...badRevision.session,
      pdfRevisions: { pdf_1: 'invalid' },
    });
    await badRevision.service.generate('session_1');
    expect(badRevision.transaction.theorySession.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pdfGenerationError: 'invalid_pdf_selection' }),
      })
    );
  });

  it('rejects cross-source, page-spanning, and empty citations', async () => {
    const crossSource = setup([
      {
        id: 'chunk_1',
        sourceId: 'other_pdf',
        pageStart: 3,
        pageEnd: 3,
        text: 'text',
        similarity: 0.9,
      },
    ]);
    await expect(crossSource.service.generate('session_1')).rejects.toThrow(
      'Question generator returned an invalid citation'
    );

    const spanning = setup([
      { id: 'chunk_1', sourceId: 'pdf_1', pageStart: 2, pageEnd: 3, text: 'text', similarity: 0.9 },
    ]);
    await expect(spanning.service.generate('session_1')).rejects.toThrow(
      'Question generator returned an invalid citation'
    );

    const empty = setup();
    empty.generator.generate.mockResolvedValue({
      questions: [{ question: 'Question', referenceAnswer: 'Answer', citationChunkIds: [] }],
    });
    await expect(empty.service.generate('session_1')).rejects.toThrow(
      'Question generator returned an invalid citation'
    );
  });

  it('marks a generation failure only after loading the persisted owner', async () => {
    const missing = setup();
    missing.transaction.$queryRaw.mockResolvedValue([]);
    await missing.service.markFailed('missing');
    expect(missing.transaction.theorySession.updateMany).not.toHaveBeenCalled();

    const existing = setup();
    await existing.service.markFailed('session_1');
    expect(existing.transaction.theorySession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'session_1',
          userId: 'user_1',
          mode: 'pdf',
          pdfGenerationStatus: { in: ['queued', 'running'] },
        },
        data: { pdfGenerationStatus: 'failed', pdfGenerationError: 'question_generation_failed' },
      })
    );
  });

  it('does not mark a session failed after questions were already prepared', async () => {
    const completed = setup();
    completed.transaction.theorySession.findUnique.mockResolvedValue({
      ...completed.session,
      pdfGenerationStatus: 'ready',
      pdfQuestions: [{ id: 'question_1' }],
    });

    await completed.service.markFailed('session_1');

    expect(completed.transaction.theorySession.updateMany).not.toHaveBeenCalled();
  });

  it('does not update a session if the trusted owner changes between reads', async () => {
    const changedOwner = setup();
    changedOwner.transaction.$queryRaw
      .mockResolvedValueOnce([{ owner_id: 'user_1' }])
      .mockResolvedValueOnce([{ owner_id: 'other_user' }]);
    await expect(changedOwner.service.generate('session_1')).rejects.toThrow(
      'PDF study session not found'
    );
    expect(changedOwner.transaction.theorySession.updateMany).not.toHaveBeenCalled();
  });
});
