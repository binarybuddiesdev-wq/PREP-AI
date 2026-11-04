import { PromptInjectionDetector } from '@mastra/core/processors';
import type { PromptInjectionOptions } from '@mastra/core/processors';
import { getModel, type ProviderName } from './providers.js';

export const PROMPT_INJECTION_BLOCKED_MESSAGE =
  'The question was blocked by the safety check. Rephrase it and try again.';
export const PROMPT_INJECTION_GUARD_UNAVAILABLE_MESSAGE =
  'The question could not be checked safely. Please try again later.';

export class PromptInjectionBlockedError extends Error {
  constructor() {
    super(PROMPT_INJECTION_BLOCKED_MESSAGE);
    this.name = 'PromptInjectionBlockedError';
  }
}

export function isPromptInjectionGuardFailure(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Prompt injection detection failed');
}

export function createPromptInjectionGuard(
  provider: ProviderName,
  onDetection?: PromptInjectionOptions['onDetection']
): PromptInjectionDetector {
  return new PromptInjectionDetector({
    model: getModel(provider),
    strategy: 'block',
    errorStrategy: 'strict',
    threshold: 0.7,
    lastMessageOnly: true,
    ...(onDetection ? { onDetection } : {}),
  });
}
