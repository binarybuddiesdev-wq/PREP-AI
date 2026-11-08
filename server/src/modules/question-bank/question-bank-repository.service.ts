import { Injectable } from '@nestjs/common';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { PistonClient } from '@/modules/coding/piston.client.js';
import { upsertQuestionBatchWithUniquenessClaims } from '@/modules/question/question-seed.js';
import { Prisma as PostgresPrisma } from '../../generated/postgresql-client/index.js';
import { createQuestionConceptFingerprint } from './question-bank-content.js';
import { createQuestionContentFingerprint } from './question-bank-content.js';
import type { ITheoryBankQuestion, ICodingBankProblem } from './question-bank-content.js';

@Injectable()
export class QuestionBankRepositoryService {
  constructor(
    private readonly mongo: PrismaService,
    private readonly postgres: PrismaPostgresqlService,
    private readonly piston: PistonClient
  ) {}

  async getTheoryContext(topicSlug: string) {
    const topic = await this.mongo.topic.findUnique({ where: { slug: topicSlug } });
    if (!topic) throw new Error(`Question bank topic is not seeded: ${topicSlug}`);
    const records = await this.mongo.question.findMany({
      where: { topicId: topic.id },
      select: { question: true, referenceAnswer: true, difficulty: true },
    });
    const concepts = await this.mongo.questionConceptUniqueness.findMany({
      where: { topicId: topic.id },
      select: { fingerprint: true },
    });
    return { topic, records, concepts };
  }

  async persistTheoryBatch(questions: ITheoryBankQuestion[]): Promise<number> {
    if (!questions.length) return 0;
    const { topicSlug, difficulty } = questions[0]!;
    const { topic, records } = await this.getTheoryContext(topicSlug);
    const prompts = new Set(
      records.map(({ question }) => createQuestionContentFingerprint(question))
    );
    const concepts = new Set<string>();
    for (const item of questions) {
      if (item.topicSlug !== topicSlug || item.difficulty !== difficulty) {
        throw new Error('Question bank repository received a mixed theory bucket');
      }
      const key = `${item.learningObjective.trim().toLowerCase()}:${item.scenarioKey.trim().toLowerCase()}`;
      if (prompts.has(createQuestionContentFingerprint(item.question)) || concepts.has(key)) {
        throw new Error('Question bank repository rejected a duplicate theory item');
      }
      concepts.add(key);
    }
    const results = await upsertQuestionBatchWithUniquenessClaims(
      this.mongo,
      questions.map((item) => ({
        topicId: topic.id,
        question: item.question,
        difficulty: item.difficulty,
        referenceAnswer: item.referenceAnswer,
        promptFingerprint: createQuestionContentFingerprint(item.question),
        conceptFingerprint: createQuestionConceptFingerprint({
          topic: item.topicSlug,
          difficulty: item.difficulty,
          learningObjective: item.learningObjective,
          scenarioKey: item.scenarioKey,
        }),
      }))
    );
    return results.filter(Boolean).length;
  }

  async getCodingContext(topic: string) {
    const client = this.postgres.workerClient_ ?? this.postgres.client_;
    if (!client) throw new Error('Question bank PostgreSQL client is unavailable');
    const records = await client.codingQuestion.findMany({
      where: { topic },
      select: {
        title: true,
        slug: true,
        description: true,
        conceptFingerprint: true,
        promptFingerprint: true,
      },
    });
    return records;
  }

  async persistCodingBatch(problems: ICodingBankProblem[]): Promise<number> {
    if (!problems.length) return 0;
    const client = this.postgres.workerClient_ ?? this.postgres.client_;
    if (!client) throw new Error('Question bank PostgreSQL client is unavailable');
    const { topic, difficulty } = problems[0]!;
    const existing = await this.getCodingContext(topic);
    const knownSlugs = new Set(existing.map(({ slug }) => slug));
    const knownConcepts = new Set(
      existing.flatMap(({ conceptFingerprint }) => (conceptFingerprint ? [conceptFingerprint] : []))
    );
    const knownPrompts = new Set(
      existing.flatMap(({ promptFingerprint }) => (promptFingerprint ? [promptFingerprint] : []))
    );
    for (const problem of problems) {
      if (problem.topic !== topic || problem.difficulty !== difficulty) {
        throw new Error('Question bank repository received a mixed coding bucket');
      }
      const fingerprint = createQuestionConceptFingerprint(problem);
      const promptFingerprint = createQuestionContentFingerprint(problem.description);
      if (
        knownSlugs.has(problem.slug) ||
        knownConcepts.has(fingerprint) ||
        knownPrompts.has(promptFingerprint)
      ) {
        throw new Error('Question bank repository rejected a duplicate coding item');
      }
      knownSlugs.add(problem.slug);
      knownConcepts.add(fingerprint);
      knownPrompts.add(promptFingerprint);
      for (const language of ['javascript', 'typescript', 'python'] as const) {
        const solution = problem.referenceSolutions[language];
        const result = await this.piston.execute(solution, language, problem.examples);
        if (result.status !== 'accepted') {
          throw new Error(`Generated coding reference solution failed ${language} examples`);
        }
      }
    }
    await client.$transaction(async (transaction) => {
      for (const problem of problems) {
        await transaction.codingQuestion.create({
          data: {
            title: problem.title,
            slug: problem.slug,
            description: problem.description,
            difficulty: problem.difficulty,
            topic: problem.topic,
            examples: problem.examples as PostgresPrisma.InputJsonValue,
            constraints: problem.constraints,
            codeJs: problem.codeJs,
            codeTs: problem.codeTs,
            codePy: problem.codePy,
            conceptFingerprint: createQuestionConceptFingerprint(problem),
            promptFingerprint: createQuestionContentFingerprint(problem.description),
          },
        });
      }
    });
    return problems.length;
  }

  async count(kind: 'theory' | 'coding', topic: string, difficulty: string): Promise<number> {
    if (kind === 'theory') {
      const record = await this.mongo.topic.findUnique({
        where: { slug: topic },
        select: { id: true },
      });
      if (!record) return 0;
      return this.mongo.question.count({ where: { topicId: record.id, difficulty } });
    }
    const client = this.postgres.workerClient_ ?? this.postgres.client_;
    if (!client) return 0;
    return client.codingQuestion.count({ where: { topic, difficulty } });
  }
}
