import { beforeEach, describe, expect, it, vi } from 'vitest';
import { afterEach } from 'vitest';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { THEORY_EVALUATOR_PROMPT_VERSION } from '../../mastra/agents/theory-evaluator-agent.js';
import { TheoryEvaluationService } from './theory-evaluation.service.js';
import { TheoryAiTokenBudgetService } from './theory-ai-token-budget.service.js';

const mockGenerate = vi.fn();
const mockTokenBudget = {
  reserve: vi.fn(),
  settle: vi.fn(),
};

vi.mock('../../mastra/mastra.config.js', () => ({
  mastra: { getAgent: () => ({ generate: mockGenerate }) },
}));

describe('TheoryEvaluationService', () => {
  const createService = (postgres: unknown, logger: unknown) =>
    new TheoryEvaluationService(
      postgres as PrismaPostgresqlService,
      logger as never,
      mockTokenBudget as unknown as TheoryAiTokenBudgetService
    );

  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenBudget.reserve.mockResolvedValue({
      allowed: true,
      count: 1200,
      quotaKey: 'quota:user_001:2026-11-02:ai_tokens',
      reservationKey: 'quota:user_001:2026-11-02:ai_tokens:reservation:attempt_1',
      ttlSeconds: 3600,
    });
    mockTokenBudget.settle.mockResolvedValue(undefined);
  });

  it('evaluates a queued answer and persists its completed score and feedback', async () => {
    const answer = {
      id: 'answer_001',
      session: { userId: 'user_001' },
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
    mockGenerate.mockResolvedValue({
      object: { score: 8, feedback: 'Clear answer.' },
      text: '{}',
      usage: Promise.resolve({ totalTokens: 640 }),
    });
    const service = createService(postgres, logger);

    await service.evaluate('answer_001');

    expect(postgres.client_.theoryAnswer.updateMany).toHaveBeenCalledWith({
      where: { id: 'answer_001', status: 'running' },
      data: {
        status: 'completed',
        aiScore: 8,
        aiFeedback: 'Clear answer.',
        evaluationProvider: 'nvidia',
        evaluationModel: 'meta/llama-3.1-8b-instruct',
        evaluationPromptVersion: THEORY_EVALUATOR_PROMPT_VERSION,
        completedAt: expect.any(Date),
      },
    });
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.stringContaining('Evaluate the technical interview answer'),
      expect.objectContaining({
        instructions: expect.stringContaining('You are an expert technical interviewer'),
        modelSettings: { maxOutputTokens: 512 },
      })
    );
    expect(mockTokenBudget.reserve).toHaveBeenCalledWith(
      'user_001',
      expect.any(String),
      expect.any(Number)
    );
    expect(mockTokenBudget.settle).toHaveBeenCalledWith(
      expect.objectContaining({ allowed: true }),
      640
    );
    vi.unstubAllEnvs();
  });

  it('persists the provider and model that succeeded after failover', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'answer_001',
            session: { userId: 'user_001' },
            status: 'queued',
            questionText: 'Question?',
            userAnswer: 'Answer.',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    vi.stubEnv('NVIDIA_API_KEY', 'test-nvidia-key');
    vi.stubEnv('NVIDIA_MODEL', 'test/nvidia-model');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    vi.stubEnv('GROQ_MODEL', 'test/groq-model');
    mockGenerate.mockRejectedValueOnce(new Error('NVIDIA unavailable')).mockResolvedValueOnce({
      object: { score: 8, feedback: 'Good.' },
      text: '{}',
      usage: Promise.resolve({ promptTokens: 500, completionTokens: 200 }),
    });
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await service.evaluate('answer_001');

    expect(mockTokenBudget.reserve).toHaveBeenCalledTimes(2);
    expect(mockTokenBudget.settle).toHaveBeenCalledWith(
      expect.objectContaining({ allowed: true }),
      700
    );

    expect(postgres.client_.theoryAnswer.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'answer_001', status: 'running' },
      data: expect.objectContaining({
        evaluationProvider: 'groq',
        evaluationModel: 'test/groq-model',
        evaluationPromptVersion: THEORY_EVALUATOR_PROMPT_VERSION,
      }),
    });
  });

  it('keeps the conservative reservation when provider token usage is unavailable', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'answer_001',
            status: 'queued',
            questionText: 'Question?',
            userAnswer: 'Answer.',
            session: { userId: 'user_001' },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    mockGenerate.mockResolvedValueOnce({ object: { score: 8, feedback: 'Good.' }, text: '{}' });
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await service.evaluate('answer_001');

    const [userId, , reservedTokens] = mockTokenBudget.reserve.mock.calls[0];
    expect(userId).toBe('user_001');
    expect(reservedTokens).toBeGreaterThan(768);
    expect(mockTokenBudget.settle).toHaveBeenCalledWith(
      expect.objectContaining({ allowed: true }),
      reservedTokens
    );
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it('does not repeat a successful provider call when usage reporting rejects', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'answer_001',
            status: 'queued',
            questionText: 'Question?',
            userAnswer: 'Answer.',
            session: { userId: 'user_001' },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    mockGenerate.mockResolvedValueOnce({
      object: { score: 8, feedback: 'Good.' },
      text: '{}',
      usage: Promise.reject(new Error('usage unavailable')),
    });
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await service.evaluate('answer_001');

    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(mockTokenBudget.settle).toHaveBeenCalledOnce();
  });

  it('keeps a successful evaluation when Redis settlement fails after the provider call', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'answer_001',
            status: 'queued',
            questionText: 'Question?',
            userAnswer: 'Answer.',
            session: { userId: 'user_001' },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    vi.stubEnv('LLM_PROVIDER', 'nvidia');
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    mockGenerate.mockResolvedValueOnce({
      object: { score: 8, feedback: 'Good.' },
      text: '{}',
      usage: Promise.resolve({ totalTokens: 640 }),
    });
    mockTokenBudget.settle.mockRejectedValueOnce(new Error('Redis unavailable'));
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const service = createService(postgres, logger);

    await expect(service.evaluate('answer_001')).resolves.toBeUndefined();

    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(postgres.client_.theoryAnswer.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed', aiScore: 8 }),
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ answerId: 'answer_001', error: 'Redis unavailable' }),
      'Could not settle AI token usage; keeping the reserved allowance'
    );
  });

  it('does not call the model again when the answer is already completed', async () => {
    const postgres = {
      client_: { theoryAnswer: { findUnique: vi.fn().mockResolvedValue({ status: 'completed' }) } },
    };
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await service.evaluate('answer_001');

    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('does not call the model for an answer that has already failed', async () => {
    const postgres = {
      client_: {
        theoryAnswer: { findUnique: vi.fn().mockResolvedValue({ status: 'failed' }) },
      },
    };
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await service.evaluate('answer_001');

    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when a queued job has no persisted answer', async () => {
    const postgres = {
      client_: { theoryAnswer: { findUnique: vi.fn().mockResolvedValue(null) } },
    };
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await expect(service.evaluate('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats Mastra fallback output as a failed evaluation rather than saving a score', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'answer_001',
            status: 'queued',
            session: { userId: 'user_001' },
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
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

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
              session: { userId: 'user_001' },
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
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

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
              session: { userId: 'user_001' },
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
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await expect(service.evaluate('answer_001')).resolves.toBeUndefined();
  });

  it('returns 503 when PostgreSQL is unavailable', async () => {
    const service = createService(
      { client_: undefined },
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
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
            session: { userId: 'user_001' },
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
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

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
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

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
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await service.markFailed('answer_001');

    expect(postgres.client_.theoryAnswer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'answer_001', status: { in: ['queued', 'running'] } },
        data: expect.objectContaining({ status: 'failed', completedAt: expect.any(Date) }),
      })
    );
  });

  it('marks the answer failed without calling a provider when the daily token budget is exhausted', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'answer_001',
            status: 'queued',
            session: { userId: 'user_001' },
            questionText: 'Question?',
            userAnswer: 'Answer.',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    mockTokenBudget.reserve.mockResolvedValueOnce({ allowed: false, count: 400_000 });
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await expect(service.evaluate('answer_001')).resolves.toBeUndefined();

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(postgres.client_.theoryAnswer.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'answer_001', status: 'running' },
      data: expect.objectContaining({
        status: 'failed',
        failureMessage: expect.stringContaining('Daily AI token budget'),
      }),
    });
  });

  it('fails closed and leaves the job retryable if Redis cannot reserve tokens', async () => {
    const postgres = {
      client_: {
        theoryAnswer: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'answer_001',
            status: 'queued',
            session: { userId: 'user_001' },
            questionText: 'Question?',
            userAnswer: 'Answer.',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    mockTokenBudget.reserve.mockRejectedValueOnce(new Error('Redis unavailable'));
    const service = createService(postgres, { info: vi.fn(), warn: vi.fn(), error: vi.fn() });

    await expect(service.evaluate('answer_001')).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(postgres.client_.theoryAnswer.updateMany).toHaveBeenCalledTimes(1);
  });
});
