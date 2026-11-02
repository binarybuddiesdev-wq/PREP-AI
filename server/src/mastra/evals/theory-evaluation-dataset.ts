import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDatasetSnapshot } from '@mastra/core/datasets';
import { z } from 'zod';

const caseSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  scoreRange: z.tuple([z.number().min(0).max(10), z.number().min(0).max(10)]),
  feedbackConcepts: z.array(z.string().min(1)).min(1),
  rationale: z.string().min(1),
});
const sourceSchema = z.object({
  datasetVersion: z.number().int().positive(),
  cases: z.array(caseSchema),
});
export type TheoryEvaluationCase = z.infer<typeof caseSchema>;
export type TheoryEvaluationDatasetSource = z.infer<typeof sourceSchema>;

const sourcePath = fileURLToPath(
  new URL('../../../evaluation/theory-evaluation-cases.json', import.meta.url)
);
const snapshotIdentity = 'b60e58fa-e3f3-4f20-a78a-087f08c8f7a1';
const fixedTimestamp = '2026-11-02T00:00:00.000Z';

function stableUuid(value: string): string {
  const hash = createHash('sha256').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function createTheoryEvaluationSnapshot(value: unknown) {
  const source = sourceSchema.parse(value);
  if (source.cases.length !== 50 || new Set(source.cases.map(({ id }) => id)).size !== 50) {
    throw new Error('Theory evaluation dataset must contain exactly 50 uniquely identified cases');
  }
  const snapshot = createDatasetSnapshot({
    formatVersion: 1,
    datasetIdentity: snapshotIdentity,
    configuration: {
      name: `theory-evaluator-curated-v${source.datasetVersion}`,
      description:
        'Synthetic technical interview answers with curator-authored score bands and feedback concepts.',
      metadata: { datasetVersion: source.datasetVersion, caseCount: source.cases.length },
    },
    items: source.cases.map((item) => ({
      itemIdentity: stableUuid(item.id),
      createdAt: fixedTimestamp,
      updatedAt: fixedTimestamp,
      payload: {
        externalId: item.id,
        input: { question: item.question, answer: item.answer },
        groundTruth: {
          scoreRange: item.scoreRange,
          feedbackConcepts: item.feedbackConcepts,
          rationale: item.rationale,
        },
        metadata: { topic: item.topic },
      },
    })),
    provenance: {
      exportedAt: fixedTimestamp,
      sourceDatasetId: 'theory-evaluator-curated-v1',
      itemVersion: source.datasetVersion,
      configurationBasis: 'export-time',
    },
  });
  return { snapshot, cases: source.cases };
}

export function loadTheoryEvaluationDataset() {
  return createTheoryEvaluationSnapshot(JSON.parse(readFileSync(sourcePath, 'utf8')));
}
