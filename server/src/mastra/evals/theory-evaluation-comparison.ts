export interface TheoryEvaluationMetrics {
  scoreAgreement: number;
  feedbackCoverage: number;
  failedCount: number;
}

export function compareTheoryEvaluationMetrics(
  baseline: TheoryEvaluationMetrics,
  candidate: TheoryEvaluationMetrics
) {
  const baselineScore = round((baseline.scoreAgreement + baseline.feedbackCoverage) / 2);
  const candidateScore = round((candidate.scoreAgreement + candidate.feedbackCoverage) / 2);
  const delta = round(candidateScore - baselineScore);
  const regression = delta < -0.05;
  return {
    baselineScore,
    candidateScore,
    delta,
    regression,
    passed: !regression && baseline.failedCount === 0 && candidate.failedCount === 0,
  };
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
