import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionBankWorker } from './question-bank.worker.js';

const bullMocks = vi.hoisted(() => ({
  createWorker: vi.fn(),
  worker: { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('bullmq', () => ({ Worker: bullMocks.createWorker }));

describe('QuestionBankWorker', () => {
  const config = { get: vi.fn() };
  const refill = { reserveDailyBatch: vi.fn(), enqueue: vi.fn() };
  const repository = {
    count: vi.fn(),
    getTheoryContext: vi.fn(),
    persistTheoryBatch: vi.fn(),
    getCodingContext: vi.fn(),
    persistCodingBatch: vi.fn(),
  };
  const generator = { generateTheory: vi.fn(), generateCoding: vi.fn() };
  const logger = { error: vi.fn(), warn: vi.fn() };
  let worker: QuestionBankWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    bullMocks.worker.on.mockReturnThis();
    bullMocks.worker.close.mockResolvedValue(undefined);
    bullMocks.createWorker.mockImplementation(function (this: unknown, ..._args: unknown[]) {
      return bullMocks.worker as never;
    });
    config.get.mockReturnValue(40);
    refill.reserveDailyBatch.mockResolvedValue(true);
    repository.count.mockResolvedValue(19);
    repository.getTheoryContext.mockResolvedValue({
      topic: { id: 'topic-1' },
      records: [{ question: 'Earlier scenario' }],
      concepts: [{ fingerprint: 'old-concept' }],
    });
    generator.generateTheory.mockResolvedValue([{ question: 'new scenario' }]);
    repository.persistTheoryBatch.mockResolvedValue(1);
    worker = new QuestionBankWorker(
      config as never,
      refill as never,
      repository as never,
      generator as never,
      logger as never
    );
  });

  it('caps generation to the bucket policy and persists a validated theory batch', async () => {
    const job = {
      data: { kind: 'theory', topic: 'react', difficulty: 'Junior', idempotencyKey: 'key' },
      attemptsMade: 0,
    };
    await expect(
      (worker as never as { process(job: never): Promise<unknown> }).process(job as never)
    ).resolves.toEqual({ inserted: 1 });
    expect(generator.generateTheory).toHaveBeenCalledWith(
      expect.objectContaining({
        topicSlug: 'react',
        count: 10,
        existingPrompts: ['Earlier scenario'],
        existingConceptFingerprints: new Set(['old-concept']),
      })
    );
    expect(repository.persistTheoryBatch).toHaveBeenCalledOnce();
    expect(refill.reserveDailyBatch).toHaveBeenCalledOnce();
    expect(refill.enqueue).not.toHaveBeenCalled();
  });

  it('does not spend generation budget or call Mastra when the target is reached', async () => {
    repository.count.mockResolvedValue(50);
    const job = {
      data: { kind: 'theory', topic: 'react', difficulty: 'Junior', idempotencyKey: 'key' },
      attemptsMade: 0,
    };
    await expect(
      (worker as never as { process(job: never): Promise<unknown> }).process(job as never)
    ).resolves.toEqual({ inserted: 0 });
    expect(refill.reserveDailyBatch).not.toHaveBeenCalled();
    expect(generator.generateTheory).not.toHaveBeenCalled();
  });

  it('does not call providers after the daily generation ceiling is reached', async () => {
    refill.reserveDailyBatch.mockResolvedValue(false);
    const job = {
      data: { kind: 'theory', topic: 'react', difficulty: 'Junior', idempotencyKey: 'key' },
      attemptsMade: 0,
    };
    await expect(
      (worker as never as { process(job: never): Promise<unknown> }).process(job as never)
    ).resolves.toEqual({ inserted: 0 });
    expect(generator.generateTheory).not.toHaveBeenCalled();
  });

  it('does not consume another daily slot for a retry of the same generation job', async () => {
    const job = {
      data: { kind: 'theory', topic: 'react', difficulty: 'Junior', idempotencyKey: 'key' },
      attemptsMade: 1,
    };
    await (worker as never as { process(job: never): Promise<unknown> }).process(job as never);
    expect(refill.reserveDailyBatch).not.toHaveBeenCalled();
  });

  it('generates and persists a bounded coding batch from the matching bucket', async () => {
    repository.count.mockResolvedValue(8);
    repository.getCodingContext.mockResolvedValue([
      {
        description: 'Earlier scenario',
        slug: 'old-problem',
        conceptFingerprint: 'old-concept',
        promptFingerprint: 'old-prompt',
      },
    ]);
    generator.generateCoding.mockResolvedValue([{ slug: 'new-problem' }]);
    repository.persistCodingBatch.mockResolvedValue(1);
    const job = {
      data: { kind: 'coding', topic: 'Arrays', difficulty: 'Easy', idempotencyKey: 'coding-key' },
      attemptsMade: 0,
    };

    await expect(
      (worker as never as { process(job: never): Promise<unknown> }).process(job as never)
    ).resolves.toEqual({ inserted: 1 });

    expect(generator.generateCoding).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'Arrays',
        difficulty: 'Easy',
        count: 1,
        existingPrompts: ['Earlier scenario'],
        existingSlugs: ['old-problem'],
        existingConceptFingerprints: new Set(['old-concept']),
        existingQuestionFingerprints: new Set(['old-prompt']),
      })
    );
    expect(repository.persistCodingBatch).toHaveBeenCalledWith([{ slug: 'new-problem' }]);
  });

  it('rejects a catalog topic mismatch without calling the generator', async () => {
    const job = {
      data: {
        kind: 'theory',
        topic: 'not-a-catalog-topic',
        difficulty: 'Junior',
        idempotencyKey: 'bad-topic',
      },
      attemptsMade: 0,
    };
    await expect(
      (worker as never as { process(job: never): Promise<unknown> }).process(job as never)
    ).rejects.toThrow(/unknown theory topic/i);
    expect(generator.generateTheory).not.toHaveBeenCalled();
  });

  it('starts and closes the BullMQ worker only when background workers are enabled', async () => {
    config.get.mockReturnValue(false);
    await worker.onModuleInit();
    expect(bullMocks.createWorker).not.toHaveBeenCalled();

    config.get.mockReturnValue(true);
    await worker.onModuleInit();
    expect(bullMocks.createWorker).toHaveBeenCalledWith(
      'question-bank-replenishment-queue',
      expect.any(Function),
      expect.objectContaining({ concurrency: 1, maxStalledCount: 1 })
    );
    expect(bullMocks.worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(bullMocks.worker.on).toHaveBeenCalledWith('error', expect.any(Function));
    await worker.onModuleDestroy();
    expect(bullMocks.worker.close).toHaveBeenCalledOnce();
  });
});
