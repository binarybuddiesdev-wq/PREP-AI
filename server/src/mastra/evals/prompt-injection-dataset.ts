import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDatasetSnapshot } from '@mastra/core/datasets';
import { z } from 'zod';

const caseSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  expectedFlagged: z.boolean(),
  text: z.string().min(10),
  rationale: z.string().min(10),
});
const sourceSchema = z.object({
  datasetVersion: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().min(1),
  cases: z.array(caseSchema),
});
export type PromptInjectionEvaluationCase = z.infer<typeof caseSchema>;

const sourcePath = fileURLToPath(
  new URL('../../../evaluation/prompt-injection-cases.json', import.meta.url)
);
const datasetIdentity = 'a2b1f15d-f06a-49d7-8d61-d22ff9fba739';
const fixedTimestamp = '2026-11-04T00:00:00.000Z';

function stableUuid(value: string): string {
  const hash = createHash('sha256').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function createPromptInjectionDataset(value: unknown) {
  const source = sourceSchema.parse(value);
  if (source.datasetVersion !== 1) {
    throw new Error('Unsupported prompt-injection dataset version');
  }
  if (source.cases.length !== 40 || new Set(source.cases.map(({ id }) => id)).size !== 40) {
    throw new Error(
      'Prompt-injection evaluation dataset must contain exactly 40 uniquely identified cases'
    );
  }
  const flaggedCount = source.cases.filter(({ expectedFlagged }) => expectedFlagged).length;
  if (flaggedCount !== 20) {
    throw new Error(
      'Prompt-injection evaluation dataset must contain exactly 20 injection and 20 benign cases'
    );
  }
  const snapshot = createDatasetSnapshot({
    formatVersion: 1,
    datasetIdentity,
    configuration: {
      name: source.name,
      description: source.description,
      metadata: { datasetVersion: source.datasetVersion, caseCount: source.cases.length },
    },
    items: source.cases.map((item) => ({
      itemIdentity: stableUuid(item.id),
      createdAt: fixedTimestamp,
      updatedAt: fixedTimestamp,
      payload: {
        externalId: item.id,
        input: { text: item.text },
        groundTruth: {
          expectedFlagged: item.expectedFlagged,
          category: item.category,
          rationale: item.rationale,
        },
      },
    })),
    provenance: {
      exportedAt: fixedTimestamp,
      sourceDatasetId: source.name,
      itemVersion: source.datasetVersion,
      configurationBasis: 'export-time',
    },
  });
  return { snapshot, cases: source.cases };
}

export function loadPromptInjectionDataset() {
  return createPromptInjectionDataset(JSON.parse(readFileSync(sourcePath, 'utf8')));
}
