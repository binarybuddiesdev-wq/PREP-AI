import { describe, expect, it } from 'vitest';

const comparisonModulePromise = import('./theory-evaluation-comparison.js').catch(() => null);

describe('theory evaluation experiment comparison', () => {
  it('reports per-scorer averages and uses a strict five-point regression boundary', async () => {
    const comparison = await comparisonModulePromise;
    expect(
      comparison?.compareTheoryEvaluationMetrics(
        { scoreAgreement: 0.8, feedbackCoverage: 0.8, failedCount: 0 },
        { scoreAgreement: 0.75, feedbackCoverage: 0.75, failedCount: 0 }
      )
    ).toMatchObject({
      baselineScore: 0.8,
      candidateScore: 0.75,
      delta: -0.05,
      regression: false,
      passed: true,
    });
  });

  it('fails when quality drops by more than five points or either run has failed cases', async () => {
    const comparison = await comparisonModulePromise;
    expect(
      comparison?.compareTheoryEvaluationMetrics(
        { scoreAgreement: 0.9, feedbackCoverage: 0.9, failedCount: 0 },
        { scoreAgreement: 0.8, feedbackCoverage: 0.8, failedCount: 0 }
      )
    ).toMatchObject({ delta: -0.1, regression: true, passed: false });
    expect(
      comparison?.compareTheoryEvaluationMetrics(
        { scoreAgreement: 0.9, feedbackCoverage: 0.9, failedCount: 1 },
        { scoreAgreement: 0.9, feedbackCoverage: 0.9, failedCount: 0 }
      )
    ).toMatchObject({ regression: false, passed: false });
  });
});
