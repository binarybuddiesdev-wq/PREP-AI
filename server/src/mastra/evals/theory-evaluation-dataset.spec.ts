import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const datasetPath = fileURLToPath(
  new URL('../../../evaluation/theory-evaluation-cases.json', import.meta.url)
);
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as {
  datasetVersion: number;
  cases: Array<{
    id: string;
    question: string;
    answer: string;
    scoreRange: [number, number];
    feedbackConcepts: string[];
    rationale: string;
  }>;
};

describe('theory evaluation baseline dataset', () => {
  it('contains 50 unique, hand-labeled synthetic technical answers', () => {
    expect(dataset.datasetVersion).toBe(1);
    expect(dataset.cases).toHaveLength(50);
    expect(new Set(dataset.cases.map((item) => item.id)).size).toBe(50);
    expect(
      dataset.cases.every((item) => item.question.length > 10 && item.answer.length > 10)
    ).toBe(true);
    expect(
      dataset.cases.every(
        (item) =>
          item.scoreRange[0] >= 0 &&
          item.scoreRange[1] <= 10 &&
          item.scoreRange[0] <= item.scoreRange[1] &&
          item.feedbackConcepts.length > 0 &&
          item.rationale.length > 10
      )
    ).toBe(true);
  });

  it('builds a repeatable Mastra snapshot with all 50 cases and a content digest', async () => {
    const datasetModule = await import('./theory-evaluation-dataset.js').catch(() => null);
    expect(datasetModule).not.toBeNull();
    const first = datasetModule!.loadTheoryEvaluationDataset();
    const second = datasetModule!.loadTheoryEvaluationDataset();
    expect(first.snapshot.items).toHaveLength(50);
    expect(first.snapshot.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.snapshot.digest).toBe(second.snapshot.digest);
  });

  it('rejects malformed cases and duplicate case identities', async () => {
    const datasetModule = await import('./theory-evaluation-dataset.js');
    expect(() =>
      datasetModule.createTheoryEvaluationSnapshot({ datasetVersion: 1, cases: [] })
    ).toThrow();
    expect(() =>
      datasetModule.createTheoryEvaluationSnapshot({
        datasetVersion: 1,
        cases: [dataset.cases[0], dataset.cases[0]],
      })
    ).toThrow('exactly 50 uniquely identified cases');
  });

  it('contains no email addresses or obvious API-key values', () => {
    const serialized = JSON.stringify(dataset);
    expect(serialized).not.toMatch(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    expect(serialized).not.toMatch(/(?:sk|ghp|sk-proj)-[A-Za-z0-9_-]{20,}/);
  });
});
