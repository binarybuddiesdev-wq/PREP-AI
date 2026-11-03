import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIdempotencyOperationId } from '../../src/common/idempotency/idempotency.js';
import { QuestionService } from '../../src/modules/question/question.service.js';
import { createQuestionFingerprint } from '../../src/modules/question/question-fingerprint.js';
import { upsertQuestionWithUniquenessClaim } from '../../src/modules/question/question-seed.js';
import {
  connectIsolationTestDatabases,
  createIntegrationLogger,
  disconnectIsolationTestDatabases,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;

describe('MongoDB question uniqueness', () => {
  let database: TDatabase | undefined;

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
  }, 30_000);

  afterAll(async () => {
    if (database) await disconnectIsolationTestDatabases(database);
  }, 30_000);

  it('allows only one concurrent create when requests use different idempotency keys', async () => {
    const mongo = database!.mongo;
    const suffix = randomUUID();
    const topic = await mongo.topic.create({
      data: {
        name: `Question uniqueness ${suffix}`,
        slug: `question-uniqueness-${suffix}`,
        category: 'practice',
      },
    });
    const service = new QuestionService(mongo, createIntegrationLogger() as never);
    const payload = {
      question: `Race question ${suffix}?`,
      topicId: topic.id,
      difficulty: 'Junior',
      referenceAnswer: 'A single committed question.',
    };
    const actorId = `question-uniqueness-${suffix}`;
    const operationIds = ['race-key-a', 'race-key-b'].map((key) =>
      createIdempotencyOperationId(actorId, 'question-create', key)
    );
    const fingerprint = createQuestionFingerprint(payload);

    try {
      const results = await Promise.allSettled([
        service.createQuestion(payload, { actorId, key: 'race-key-a' }),
        service.createQuestion(payload, { actorId, key: 'race-key-b' }),
      ]);
      const created = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(created).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        status: 'rejected',
        reason: expect.any(ConflictException),
      });
      await expect(mongo.question.count({ where: { question: payload.question } })).resolves.toBe(
        1
      );
      await expect(mongo.questionUniqueness.count({ where: { fingerprint } })).resolves.toBe(1);
    } finally {
      await mongo.idempotencyOperation.deleteMany({ where: { operationId: { in: operationIds } } });
      const questions = await mongo.question.findMany({
        where: { topicId: topic.id },
        select: { id: true },
      });
      await mongo.questionUniqueness.deleteMany({
        where: { questionId: { in: questions.map(({ id }) => id) } },
      });
      await mongo.question.deleteMany({ where: { topicId: topic.id } });
      await mongo.topic.deleteMany({ where: { id: topic.id } });
    }
  });

  it('releases a uniqueness claim after deletion so a later create can use it', async () => {
    const mongo = database!.mongo;
    const suffix = randomUUID();
    const topic = await mongo.topic.create({
      data: {
        name: `Question delete ${suffix}`,
        slug: `question-delete-${suffix}`,
        category: 'practice',
      },
    });
    const service = new QuestionService(mongo, createIntegrationLogger() as never);
    const payload = {
      question: `Reusable question ${suffix}?`,
      topicId: topic.id,
      difficulty: 'Mid',
    };
    const fingerprint = createQuestionFingerprint(payload);

    try {
      const first = await service.createQuestion(payload);
      await service.deleteQuestion(first.id.toUpperCase());
      const replacement = await service.createQuestion(payload);

      expect(replacement.id).not.toBe(first.id);
      await expect(
        mongo.questionUniqueness.findUnique({ where: { fingerprint } })
      ).resolves.toMatchObject({ questionId: replacement.id });
    } finally {
      await mongo.questionUniqueness.deleteMany({ where: { fingerprint } });
      await mongo.question.deleteMany({ where: { topicId: topic.id } });
      await mongo.topic.deleteMany({ where: { id: topic.id } });
    }
  });

  it('preserves claims on an edit collision and moves the claim after the conflict is removed', async () => {
    const mongo = database!.mongo;
    const suffix = randomUUID();
    const topic = await mongo.topic.create({
      data: {
        name: `Question edit ${suffix}`,
        slug: `question-edit-${suffix}`,
        category: 'practice',
      },
    });
    const service = new QuestionService(mongo, createIntegrationLogger() as never);
    const firstPayload = {
      question: `First question ${suffix}?`,
      topicId: topic.id,
      difficulty: 'Senior',
    };
    const secondPayload = {
      question: `Second question ${suffix}?`,
      topicId: topic.id,
      difficulty: 'Senior',
    };
    const firstFingerprint = createQuestionFingerprint(firstPayload);
    const secondFingerprint = createQuestionFingerprint(secondPayload);
    try {
      const first = await service.createQuestion(firstPayload);
      const second = await service.createQuestion(secondPayload);

      await expect(
        service.updateQuestion(second.id, { question: firstPayload.question })
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(mongo.question.findUnique({ where: { id: second.id } })).resolves.toMatchObject({
        question: secondPayload.question,
      });
      await expect(
        mongo.questionUniqueness.findUnique({ where: { fingerprint: secondFingerprint } })
      ).resolves.toMatchObject({ questionId: second.id });

      await service.deleteQuestion(first.id);
      await service.updateQuestion(second.id, { question: firstPayload.question });

      await expect(
        mongo.questionUniqueness.findUnique({ where: { fingerprint: firstFingerprint } })
      ).resolves.toMatchObject({ questionId: second.id });
      await expect(
        mongo.questionUniqueness.findUnique({ where: { fingerprint: secondFingerprint } })
      ).resolves.toBeNull();
    } finally {
      const questions = await mongo.question.findMany({
        where: { topicId: topic.id },
        select: { id: true },
      });
      await mongo.questionUniqueness.deleteMany({
        where: { questionId: { in: questions.map(({ id }) => id) } },
      });
      await mongo.question.deleteMany({ where: { topicId: topic.id } });
      await mongo.topic.deleteMany({ where: { id: topic.id } });
    }
  });

  it('preserves a concurrent answer edit while retrying a question-text edit', async () => {
    const mongo = database!.mongo;
    const suffix = randomUUID();
    const topic = await mongo.topic.create({
      data: {
        name: `Question update race ${suffix}`,
        slug: `question-update-race-${suffix}`,
        category: 'practice',
      },
    });
    const service = new QuestionService(mongo, createIntegrationLogger() as never);
    const firstPayload = {
      question: `Race source ${suffix}?`,
      topicId: topic.id,
      difficulty: 'Junior',
      referenceAnswer: 'Original answer.',
    };
    let questionId: string | undefined;

    try {
      const question = await service.createQuestion(firstPayload);
      questionId = question.id;
      const [textEdit, answerEdit] = await Promise.all([
        service.updateQuestion(question.id, { question: `Race destination ${suffix}?` }),
        service.updateQuestion(question.id, { referenceAnswer: 'Concurrent answer.' }),
      ]);

      expect(textEdit.id).toBe(answerEdit.id);
      await expect(
        mongo.question.findUnique({ where: { id: question.id } })
      ).resolves.toMatchObject({
        question: `Race destination ${suffix}?`,
        referenceAnswer: 'Concurrent answer.',
      });
    } finally {
      if (questionId) {
        await mongo.questionUniqueness.deleteMany({ where: { questionId } });
        await mongo.question.deleteMany({ where: { id: questionId } });
      }
      await mongo.topic.deleteMany({ where: { id: topic.id } });
    }
  });

  it('returns a duplicate conflict when two different questions race to the same tuple', async () => {
    const mongo = database!.mongo;
    const suffix = randomUUID();
    const topic = await mongo.topic.create({
      data: {
        name: `Question edit race ${suffix}`,
        slug: `question-edit-race-${suffix}`,
        category: 'practice',
      },
    });
    const service = new QuestionService(mongo, createIntegrationLogger() as never);
    const firstPayload = {
      question: `Edit source A ${suffix}?`,
      topicId: topic.id,
      difficulty: 'Mid',
    };
    const secondPayload = {
      question: `Edit source B ${suffix}?`,
      topicId: topic.id,
      difficulty: 'Mid',
    };
    let questionIds: string[] = [];

    try {
      const [first, second] = await Promise.all([
        service.createQuestion(firstPayload),
        service.createQuestion(secondPayload),
      ]);
      questionIds = [first.id, second.id];
      const target = `Shared target ${suffix}?`;
      const results = await Promise.allSettled([
        service.updateQuestion(first.id, { question: target }),
        service.updateQuestion(second.id, { question: target }),
      ]);
      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        status: 'rejected',
        reason: expect.any(ConflictException),
      });
      await expect(mongo.question.count({ where: { question: target } })).resolves.toBe(1);
    } finally {
      await mongo.questionUniqueness.deleteMany({ where: { questionId: { in: questionIds } } });
      await mongo.question.deleteMany({ where: { topicId: topic.id } });
      await mongo.topic.deleteMany({ where: { id: topic.id } });
    }
  });

  it('makes questions inserted by the seed path visible to edit duplicate checks', async () => {
    const mongo = database!.mongo;
    const suffix = randomUUID();
    const topic = await mongo.topic.create({
      data: {
        name: `Question seed ${suffix}`,
        slug: `question-seed-${suffix}`,
        category: 'practice',
      },
    });
    const service = new QuestionService(mongo, createIntegrationLogger() as never);
    const seededPayload = {
      topicId: topic.id,
      question: `Seeded question ${suffix}?`,
      difficulty: 'Senior',
      referenceAnswer: 'Seed answer.',
    };

    try {
      await expect(upsertQuestionWithUniquenessClaim(mongo, seededPayload)).resolves.toBe(true);
      const other = await service.createQuestion({
        ...seededPayload,
        question: `Another question ${suffix}?`,
      });

      await expect(
        service.updateQuestion(other.id, { question: seededPayload.question })
      ).rejects.toBeInstanceOf(ConflictException);
    } finally {
      const questions = await mongo.question.findMany({
        where: { topicId: topic.id },
        select: { id: true },
      });
      await mongo.questionUniqueness.deleteMany({
        where: { questionId: { in: questions.map(({ id }) => id) } },
      });
      await mongo.question.deleteMany({ where: { topicId: topic.id } });
      await mongo.topic.deleteMany({ where: { id: topic.id } });
    }
  });
});
