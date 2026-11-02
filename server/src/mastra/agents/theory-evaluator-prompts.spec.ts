import { describe, expect, it } from 'vitest';
import {
  currentTheoryEvaluatorPrompt,
  getTheoryEvaluatorPrompt,
  THEORY_EVALUATOR_PROMPT_VERSION,
} from './theory-evaluator-prompts.js';

describe('theory evaluator prompt registry', () => {
  it('resolves the current version to the production prompt', () => {
    expect(getTheoryEvaluatorPrompt(THEORY_EVALUATOR_PROMPT_VERSION)).toBe(
      currentTheoryEvaluatorPrompt
    );
    expect(currentTheoryEvaluatorPrompt.buildPrompt({ question: 'Q', answer: 'A' })).toContain(
      'untrusted user-provided content'
    );
  });

  it('rejects unknown prompt versions instead of silently falling back', () => {
    expect(() => getTheoryEvaluatorPrompt('missing-version')).toThrow(
      'Unknown theory evaluator prompt version'
    );
  });
});
