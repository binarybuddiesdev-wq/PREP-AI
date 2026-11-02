import { beforeEach, describe, expect, it, vi } from 'vitest';
import { afterEach } from 'vitest';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { TheoryEvaluationService } from './theory-evaluation.service.js';

const mockGenerate = vi.fn();

vi.mock('../../mastra/mastra.config.js', () => ({
  mastra: { getAgent: () => ({ generate: mockGenerate }) },
}));

describe('TheoryEvaluationService', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('evaluates a queued answer and persists its completed score and feedback', async () => {
    const answer = {
      id: 'answer_001',
      status: 'queued',
      questionText: 'What is React?',
      userAnswer: 'A UI library',
    };
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi.fn().mockResolvedValue(answer),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    vi.stubEnv('LLM_PROVIDER', 'nvidia');
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    mockGenerate.mockResolvedValue({ object: { score: 8, feedback: 'Clear answer.' }, text: '{}' });
    const service = new TheoryEvaluationService(
      postgres as unknown as PrismaPostgresqlService,
      logger as never
    );

    await service.evaluate('answer_001');

    expect(postgres.client_.theoryAnswer.updateMany).toHaveBeenCalledWith({
      where: { id: 'answer_001', status: 'running' },
      data: {
        status: 'completed',
        aiScore: 8,
        aiFeedback: 'Clear answer.',
        completedAt: expect.any(Date),
      },
    });
    vi.unstubAllEnvs();
  });

  it('does not call the model again when the answer is already completed', async () => {
    const postgres = {
      client_: { theoryAnswer: { findUnique: vi.fn().mockResolvedValue({ status: 'completed' }) } },
    };
    const service = new TheoryEvaluationService(
      postgres as unknown as PrismaPostgresqlService,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );

    await service.evaluate('answer_001');

    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('does not call the model for an answer that has already failed', async () => {
    const postgres = {
      client_: {
        theoryAnswer: { findUnique: vi.fn().mockResolvedValue({ status: 'failed' }) },
      },
    };
    const service = new TheoryEvaluationService(
      postgres as unknown as PrismaPostgresqlService,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );

    await service.evaluate('answer_001');

    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when a queued job has no persisted answer', async () => {
    const postgres = {
      client_: { theoryAnswer: { findUnique: vi.fn().mockResolvedValue(null) } },
    };
    const service = new TheoryEvaluationService(
      postgres as unknown as PrismaPostgresqlService,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );

    await expect(service.evaluate('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats Mastra fallback output as a failed evaluation rather than saving a score', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'answer_001',
            status: 'queued',
            questionText: 'Question?',
            userAnswer: 'Answer.',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    vi.stubEnv('LLM_PROVIDER', 'nvidia');
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    mockGenerate.mockResolvedValue({ object: null, text: '{}' });
    const service = new TheoryEvaluationService(
      postgres as unknown as PrismaPostgresqlService,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );

    await expect(service.evaluate('answer_001')).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(postgres.client_.theoryAnswer.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a completed answer when another attempt already saved it', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce({
              id: 'answer_001',
              status: 'queued',
              questionText: 'Question?',
              userAnswer: 'Answer.',
            })
            .mockResolvedValueOnce({ status: 'completed' }),
          updateMany: vi
            .fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 0 }),
        },
      },
    };
    vi.stubEnv('LLM_PROVIDER', 'nvidia');
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    mockGenerate.mockResolvedValue({ object: { score: 8, feedback: 'Good.' }, text: '{}' });
    const service = new TheoryEvaluationService(
      postgres as unknown as PrismaPostgresqlService,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );

    await expect(service.evaluate('answer_001')).resolves.toBeUndefined();
  });

  it('fails when the persisted answer leaves the running state unexpectedly', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce({
              id: 'answer_001',
              status: 'queued',
              questionText: 'Question?',
              userAnswer: 'Answer.',
            })
            .mockResolvedValueOnce({ status: 'failed' }),
          updateMany: vi
            .fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 0 }),
        },
      },
    };
    vi.stubEnv('LLM_PROVIDER', 'nvidia');
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    mockGenerate.mockResolvedValue({ object: { score: 8, feedback: 'Good.' }, text: '{}' });
    const service = new TheoryEvaluationService(
      postgres as unknown as PrismaPostgresqlService,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );

    await expect(service.evaluate('answer_001')).resolves.toBeUndefined();
  });

  it('returns 503 when PostgreSQL is unavailable', async () => {
    const service = new TheoryEvaluationService(
      { client_: undefined } as unknown as PrismaPostgresqlService,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );

    await expect(service.findQueuedForDispatch()).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('rejects feedback longer than the supported response bound', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'answer_001',
            status: 'queued',
            questionText: 'Question?',
            userAnswer: 'Answer.',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    vi.stubEnv('LLM_PROVIDER', 'nvidia');
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    mockGenerate.mockResolvedValue({
      object: { score: 8, feedback: 'x'.repeat(2001) },
      text: '{}',
    });
    const service = new TheoryEvaluationService(
      postgres as unknown as PrismaPostgresqlService,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );

    await expect(service.evaluate('answer_001')).rejects.toThrow();
    expect(postgres.client_.theoryAnswer.updateMany).toHaveBeenCalledTimes(1);
  });

  it('persists queued answer IDs for restart redispatch', async () => {
    const queuedAnswer = {
      id: 'answer_001',
      sessionId: 'session_001',
      session: { userId: 'user_001' },
    };
    const postgres = {
      client_: { theoryAnswer: { findMany: vi.fn().mockResolvedValue([queuedAnswer]) } },
    };
    const service = new TheoryEvaluationService(
      postgres as unknown as PrismaPostgresqlService,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );

    await expect(service.findQueuedForDispatch()).resolves.toEqual([
      { idempotencyKey: 'answer_001', answerId: 'answer_001' },
    ]);
    expect(postgres.client_.theoryAnswer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'queued' } })
    );
  });

  it('marks an answer failed after retries are exhausted', async () => {
    const postgres = {
      client_: { theoryAnswer: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } },
    };
    const service = new TheoryEvaluationService(
      postgres as unknown as PrismaPostgresqlService,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );

    await service.markFailed('answer_001');

    expect(postgres.client_.theoryAnswer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'answer_001', status: { in: ['queued', 'running'] } },
        data: expect.objectContaining({ status: 'failed', completedAt: expect.any(Date) }),
      })
    );
  });
});
