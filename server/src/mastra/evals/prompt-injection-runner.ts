import { TripWire } from '@mastra/core/agent';
import type { PromptInjectionDetectionEvent, PromptInjectionResult } from '@mastra/core/processors';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ProviderName } from '../providers.js';
import { createPromptInjectionGuard } from '../prompt-injection-guard.js';
import {
  loadPromptInjectionDataset,
  type PromptInjectionEvaluationCase,
} from './prompt-injection-dataset.js';

export interface PromptInjectionEvaluationCaseResult {
  id: string;
  category: string;
  expectedFlagged: boolean;
  observedFlagged?: boolean;
  detectionResult?: PromptInjectionResult;
  error?: string;
}

export interface PromptInjectionEvaluationMetrics {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  errorCount: number;
}

export function calculatePromptInjectionMetrics(
  results: PromptInjectionEvaluationCaseResult[]
): PromptInjectionEvaluationMetrics {
  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;
  let errorCount = 0;
  for (const result of results) {
    if (result.error || result.observedFlagged === undefined) {
      errorCount += 1;
      continue;
    }
    if (result.expectedFlagged && result.observedFlagged) truePositives += 1;
    else if (!result.expectedFlagged && result.observedFlagged) falsePositives += 1;
    else if (!result.expectedFlagged && !result.observedFlagged) trueNegatives += 1;
    else falseNegatives += 1;
  }
  const predictedPositiveCount = truePositives + falsePositives;
  const actualPositiveCount = truePositives + falseNegatives;
  return {
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision: predictedPositiveCount ? truePositives / predictedPositiveCount : 0,
    recall: actualPositiveCount ? truePositives / actualPositiveCount : 0,
    errorCount,
  };
}

export async function runPromptInjectionEvaluation(
  provider: ProviderName,
  cases: PromptInjectionEvaluationCase[] = loadPromptInjectionDataset().cases
) {
  const results: PromptInjectionEvaluationCaseResult[] = [];
  for (const evaluationCase of cases) {
    let detectionEvent: PromptInjectionDetectionEvent | undefined;
    const processor = createPromptInjectionGuard(provider, (event) => {
      detectionEvent = event;
    });
    try {
      const message: MastraDBMessage = {
        id: evaluationCase.id,
        role: 'user',
        createdAt: new Date('2026-11-04T00:00:00.000Z'),
        content: {
          format: 2,
          parts: [{ type: 'text', text: evaluationCase.text }],
        },
      };
      await processor.processInput({
        messages: [message],
        abort: (reason) => {
          throw new TripWire(reason ?? 'Prompt-injection evaluation blocked', {}, processor.id);
        },
      });
      if (!detectionEvent) {
        results.push({
          id: evaluationCase.id,
          category: evaluationCase.category,
          expectedFlagged: evaluationCase.expectedFlagged,
          error: 'Detector returned without a detection callback',
        });
        continue;
      }
      results.push(toCaseResult(evaluationCase, detectionEvent));
    } catch (error: unknown) {
      if (detectionEvent?.flagged) {
        results.push(toCaseResult(evaluationCase, detectionEvent));
      } else {
        results.push({
          id: evaluationCase.id,
          category: evaluationCase.category,
          expectedFlagged: evaluationCase.expectedFlagged,
          ...(detectionEvent
            ? { observedFlagged: false, detectionResult: detectionEvent.detectionResult }
            : {}),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return { provider, cases: results, metrics: calculatePromptInjectionMetrics(results) };
}

function toCaseResult(
  evaluationCase: PromptInjectionEvaluationCase,
  event: PromptInjectionDetectionEvent
): PromptInjectionEvaluationCaseResult {
  return {
    id: evaluationCase.id,
    category: evaluationCase.category,
    expectedFlagged: evaluationCase.expectedFlagged,
    observedFlagged: event.flagged,
    detectionResult: event.detectionResult,
  };
}
