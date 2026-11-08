import { createHash } from 'node:crypto';
import { z } from 'zod';

export const theoryBankQuestionSchema = z
  .object({
    topicSlug: z.string().min(1).max(80),
    difficulty: z.enum(['Junior', 'Mid', 'Senior']),
    learningObjective: z.string().min(3).max(100),
    scenarioKey: z.string().min(3).max(100),
    scenario: z.string().min(40).max(1_500),
    question: z.string().min(20).max(1_000),
    referenceAnswer: z.string().min(20).max(2_000),
  })
  .strict();

export type ITheoryBankQuestion = z.infer<typeof theoryBankQuestionSchema>;

export interface ITheoryBatchExpectation {
  topicSlug: string;
  difficulty: ITheoryBankQuestion['difficulty'];
  count: number;
  existingFingerprints?: ReadonlySet<string>;
  existingConceptFingerprints?: ReadonlySet<string>;
}

export const codingBankProblemSchema = z
  .object({
    topic: z.string().min(1).max(80),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    title: z.string().min(8).max(120),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    description: z.string().min(80).max(2_500),
    learningObjective: z.string().min(3).max(100),
    scenarioKey: z.string().min(3).max(100),
    examples: z
      .array(
        z.object({
          input: z.array(z.unknown()),
          output: z.unknown(),
          explanation: z.string().min(10).max(300),
        })
      )
      .min(2)
      .max(5),
    constraints: z.array(z.string().min(5).max(300)).min(1).max(12),
    codeJs: z.string().min(20).max(2_000),
    codeTs: z.string().min(20).max(2_000),
    codePy: z.string().min(20).max(2_000),
    referenceSolutions: z.object({
      javascript: z.string().min(20).max(8_000),
      typescript: z.string().min(20).max(8_000),
      python: z.string().min(20).max(8_000),
    }),
  })
  .strict();

export type ICodingBankProblem = z.infer<typeof codingBankProblemSchema>;

export interface ICodingBatchExpectation {
  topic: string;
  difficulty: ICodingBankProblem['difficulty'];
  count: number;
  existingConceptFingerprints?: ReadonlySet<string>;
  existingQuestionFingerprints?: ReadonlySet<string>;
}

/** Normalize wording so punctuation/case-only rewrites are rejected as duplicates. */
export const normalizeQuestionContent = (text: string): string =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const createQuestionContentFingerprint = (text: string): string =>
  createHash('sha256').update(normalizeQuestionContent(text)).digest('hex');

export const createQuestionConceptFingerprint = (input: {
  topic: string;
  difficulty: string;
  learningObjective: string;
  scenarioKey: string;
}): string =>
  createHash('sha256')
    .update(
      JSON.stringify([
        normalizeQuestionContent(input.topic),
        normalizeQuestionContent(input.learningObjective),
        normalizeQuestionContent(input.scenarioKey),
      ])
    )
    .digest('hex');

export const validateTheoryQuestionBatch = (
  input: unknown,
  expected: ITheoryBatchExpectation
): ITheoryBankQuestion[] => {
  const parsed = z.array(theoryBankQuestionSchema).safeParse(input);
  if (!parsed.success) throw new Error('Generated theory questions have an invalid structure');
  if (parsed.data.length !== expected.count) {
    throw new Error(`Theory generator must return exactly ${expected.count} questions`);
  }

  const promptFingerprints = new Set<string>();
  const scenarioKeys = new Set<string>();
  for (const item of parsed.data) {
    if (item.topicSlug !== expected.topicSlug || item.difficulty !== expected.difficulty) {
      throw new Error('Generated theory question has the wrong topic or difficulty');
    }
    const questionFingerprint = createQuestionContentFingerprint(item.question);
    const scenarioFingerprint = createQuestionContentFingerprint(item.scenario);
    const scenarioKey = `${normalizeQuestionContent(item.learningObjective)}:${normalizeQuestionContent(item.scenarioKey)}`;
    const conceptFingerprint = createQuestionConceptFingerprint({
      topic: item.topicSlug,
      difficulty: item.difficulty,
      learningObjective: item.learningObjective,
      scenarioKey: item.scenarioKey,
    });
    if (
      promptFingerprints.has(questionFingerprint) ||
      promptFingerprints.has(scenarioFingerprint) ||
      scenarioKeys.has(scenarioKey) ||
      expected.existingConceptFingerprints?.has(conceptFingerprint) ||
      expected.existingFingerprints?.has(questionFingerprint) ||
      expected.existingFingerprints?.has(scenarioFingerprint)
    ) {
      throw new Error('Generated theory batch contains a duplicate scenario question');
    }
    promptFingerprints.add(questionFingerprint);
    promptFingerprints.add(scenarioFingerprint);
    scenarioKeys.add(scenarioKey);
  }
  return parsed.data;
};

export const validateCodingProblemBatch = (
  input: unknown,
  expected: ICodingBatchExpectation
): ICodingBankProblem[] => {
  const parsed = z.array(codingBankProblemSchema).safeParse(input);
  if (!parsed.success) throw new Error('Generated coding problems have an invalid structure');
  if (parsed.data.length !== expected.count) {
    throw new Error(`Coding generator must return exactly ${expected.count} problems`);
  }

  const conceptFingerprints = new Set<string>();
  const questionFingerprints = new Set<string>();
  const slugs = new Set<string>();
  for (const item of parsed.data) {
    if (item.topic !== expected.topic || item.difficulty !== expected.difficulty) {
      throw new Error('Generated coding problem has the wrong topic or difficulty');
    }
    if (
      !/^function\s+solution\s*\(/.test(item.codeJs.trim()) ||
      !/^function\s+solution\s*\(/.test(item.codeTs.trim()) ||
      !/^def\s+solution\s*\(/.test(item.codePy.trim())
    ) {
      throw new Error('Generated coding problem has an invalid starter function signature');
    }
    const conceptFingerprint = createQuestionConceptFingerprint({
      topic: item.topic,
      difficulty: item.difficulty,
      learningObjective: item.learningObjective,
      scenarioKey: item.scenarioKey,
    });
    const questionFingerprint = createQuestionContentFingerprint(item.description);
    if (
      conceptFingerprints.has(conceptFingerprint) ||
      questionFingerprints.has(questionFingerprint) ||
      slugs.has(item.slug) ||
      expected.existingConceptFingerprints?.has(conceptFingerprint) ||
      expected.existingQuestionFingerprints?.has(questionFingerprint)
    ) {
      throw new Error('Generated coding batch contains a duplicate problem scenario');
    }
    conceptFingerprints.add(conceptFingerprint);
    questionFingerprints.add(questionFingerprint);
    slugs.add(item.slug);
  }
  return parsed.data;
};
