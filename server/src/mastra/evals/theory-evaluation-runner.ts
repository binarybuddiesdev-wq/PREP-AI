import { randomUUID } from 'node:crypto';
import { runExperiment } from '@mastra/core/datasets';
import { z } from 'zod';
import { getTheoryEvaluatorPrompt } from '../agents/theory-evaluator-prompts.js';
import { mastra } from '../mastra.config.js';
import { getModel, type ProviderName } from '../providers.js';
import { loadTheoryEvaluationDataset } from './theory-evaluation-dataset.js';
import { createTheoryEvaluationScorers } from './theory-evaluation-scorers.js';

const answerInputSchema = z.object({ question: z.string(), answer: z.string() });
export interface TheoryEvaluationVariant {
  name: string;
  provider: ProviderName;
  modelName: string;
  promptVersion: string;
}

export async function runTheoryEvaluationVariant(variant: TheoryEvaluationVariant) {
  const { snapshot, cases } = loadTheoryEvaluationDataset();
  getTheoryEvaluatorPrompt(variant.promptVersion);
  return runExperiment(mastra, {
    experimentId: randomUUID(),
    name: variant.name,
    version: 1,
    maxConcurrency: 1,
    data: cases.map((item) => ({
      id: item.id,
      input: { question: item.question, answer: item.answer },
      groundTruth: {
        scoreRange: item.scoreRange,
        feedbackConcepts: item.feedbackConcepts,
        rationale: item.rationale,
      },
      metadata: { topic: item.topic },
    })),
    task: async ({ input }) => {
      const agent = mastra.getAgent('theoryEvaluatorAgent');
      const prompt = getTheoryEvaluatorPrompt(variant.promptVersion);
      const validatedInput = answerInputSchema.parse(input);
      const response = await agent.generate(prompt.buildPrompt(validatedInput), {
        model: getModel(variant.provider, variant.modelName),
        instructions: prompt.instructions,
        structuredOutput: {
          schema: z.object({ score: z.number().min(0).max(10), feedback: z.string().max(2000) }),
          jsonPromptInjection: true,
          errorStrategy: 'strict',
        },
      });
      return response.object;
    },
    scorers: createTheoryEvaluationScorers(),
    metadata: {
      datasetDigest: snapshot.digest,
      datasetVersion: snapshot.provenance.itemVersion,
      provider: variant.provider,
      modelName: variant.modelName,
      promptVersion: variant.promptVersion,
    },
    persistence: { experiments: 'none', scores: 'none' },
  });
}
