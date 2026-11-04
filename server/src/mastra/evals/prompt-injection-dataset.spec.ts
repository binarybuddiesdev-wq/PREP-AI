import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const datasetPath = fileURLToPath(
  new URL('../../../evaluation/prompt-injection-cases.json', import.meta.url)
);

describe('prompt-injection evaluation dataset', () => {
  it('contains a balanced, versioned set of uniquely identified synthetic cases', async () => {
    const { loadPromptInjectionDataset } = await import('./prompt-injection-dataset.js');
    const first = loadPromptInjectionDataset();
    const second = loadPromptInjectionDataset();

    expect(first.snapshot.items).toHaveLength(40);
    expect(first.snapshot.provenance.itemVersion).toBe(1);
    expect(first.snapshot.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.snapshot.digest).toBe(second.snapshot.digest);
    expect(first.cases.filter(({ expectedFlagged }) => expectedFlagged)).toHaveLength(20);
    expect(first.cases.filter(({ expectedFlagged }) => !expectedFlagged)).toHaveLength(20);
    expect(new Set(first.cases.map(({ id }) => id)).size).toBe(40);
  });

  it('rejects unsupported versions, duplicate IDs, and unbalanced labels', async () => {
    const { createPromptInjectionDataset } = await import('./prompt-injection-dataset.js');
    const source = JSON.parse(readFileSync(datasetPath, 'utf8')) as {
      datasetVersion: number;
      cases: Array<Record<string, unknown>>;
    };

    expect(() => createPromptInjectionDataset({ ...source, datasetVersion: 2 })).toThrow(
      'Unsupported prompt-injection dataset version'
    );
    expect(() =>
      createPromptInjectionDataset({ ...source, cases: [source.cases[0], source.cases[0]] })
    ).toThrow('exactly 40 uniquely identified cases');
    const unbalanced = structuredClone(source);
    unbalanced.cases[0] = { ...unbalanced.cases[0], expectedFlagged: false };
    expect(() => createPromptInjectionDataset(unbalanced)).toThrow(
      'must contain exactly 20 injection and 20 benign cases'
    );
  });

  it('contains no email addresses, obvious API keys, or learner records', () => {
    const serialized = readFileSync(datasetPath, 'utf8');
    expect(serialized).not.toMatch(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    expect(serialized).not.toMatch(/(?:sk|ghp|sk-proj)-[A-Za-z0-9_-]{20,}/);
    expect(serialized).not.toMatch(/\b\d{10,}\b/);
  });
});
