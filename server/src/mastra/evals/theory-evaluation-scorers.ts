import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';

export function scoreTheoryScoreBand(range: [number, number], score: number): number {
  const distance = score < range[0] ? range[0] - score : score > range[1] ? score - range[1] : 0;
  return distance === 0 ? 1 : distance === 1 ? 0.5 : 0;
}

export function scoreTheoryFeedbackCoverage(concepts: string[], feedback: string): number {
  if (concepts.length === 0) return 1;
  const normalizedFeedback = feedback.toLocaleLowerCase();
  return (
    concepts.filter((concept) => normalizedFeedback.includes(concept.toLocaleLowerCase())).length /
    concepts.length
  );
}

const inputSchema = z.object({ question: z.string(), answer: z.string() });
const outputSchema = z.object({ score: z.number(), feedback: z.string() });
const groundTruthSchema = z.object({
  scoreRange: z.tuple([z.number(), z.number()]),
  feedbackConcepts: z.array(z.string()),
  rationale: z.string(),
});

export function createTheoryEvaluationScorers() {
  const scoreAgreement = createScorer({
    id: 'theory-score-band-agreement',
    description: 'Measures whether the model score falls within the curator score band.',
    type: { input: inputSchema, output: outputSchema },
  }).generateScore(({ run }) =>
    scoreTheoryScoreBand(groundTruthSchema.parse(run.groundTruth).scoreRange, run.output.score)
  );
  const feedbackCoverage = createScorer({
    id: 'theory-feedback-concept-coverage',
    description:
      'Measures coverage of expected feedback concepts using deterministic phrase matching.',
    type: { input: inputSchema, output: outputSchema },
  }).generateScore(({ run }) =>
    scoreTheoryFeedbackCoverage(
      groundTruthSchema.parse(run.groundTruth).feedbackConcepts,
      run.output.feedback
    )
  );
  return [scoreAgreement, feedbackCoverage];
}
