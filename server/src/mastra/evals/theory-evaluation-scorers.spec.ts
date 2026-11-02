import { describe, expect, it } from 'vitest';

const scorersModulePromise = import('./theory-evaluation-scorers.js').catch(() => null);

describe('theory evaluation rubric scorers', () => {
  it('gives full score agreement inside the human score range', async () => {
    const scorers = await scorersModulePromise;
    expect(scorers?.scoreTheoryScoreBand([7, 8], 8)).toBe(1);
  });

  it('penalizes a one-point range miss by one half and bottoms out two points away', async () => {
    const scorers = await scorersModulePromise;
    expect(scorers?.scoreTheoryScoreBand([7, 8], 9)).toBe(0.5);
    expect(scorers?.scoreTheoryScoreBand([7, 8], 10)).toBe(0);
  });

  it('measures expected feedback concept coverage without an extra model call', async () => {
    const scorers = await scorersModulePromise;
    expect(
      scorers?.scoreTheoryFeedbackCoverage(['atomicity', 'rollback'], 'Atomicity matters.')
    ).toBe(0.5);
    expect(scorers?.scoreTheoryFeedbackCoverage([], 'Constructive feedback.')).toBe(1);
  });

  it('exposes deterministic rubric metrics through Mastra scorer instances', async () => {
    const scorers = await scorersModulePromise;
    const instances = scorers?.createTheoryEvaluationScorers();
    expect(instances).toHaveLength(2);
    const result = await instances![0].run({
      runId: 'test-run',
      input: { question: 'How?', answer: 'Because.' },
      output: { score: 8, feedback: 'Atomicity and rollback.' },
      groundTruth: {
        scoreRange: [7, 8],
        feedbackConcepts: ['atomicity', 'rollback'],
        rationale: 'Good answer.',
      },
    });
    expect(result.score).toBe(1);
    const feedbackResult = await instances![1].run({
      runId: 'feedback-test-run',
      input: { question: 'How?', answer: 'Because.' },
      output: { score: 8, feedback: 'Atomicity is correct.' },
      groundTruth: {
        scoreRange: [7, 8],
        feedbackConcepts: ['atomicity', 'rollback'],
        rationale: 'A sound answer.',
      },
    });
    expect(feedbackResult.score).toBe(0.5);
  });
});
