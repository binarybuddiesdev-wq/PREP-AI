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

  it('redacts personal identifiers in the current prompt and retains the v1 prompt', () => {
    const question = 'How should I contact learner@example.com?';
    const answer = 'Call me at +1 415 555 2671.';

    expect(THEORY_EVALUATOR_PROMPT_VERSION).toBe('theory-evaluator-v2');
    expect(currentTheoryEvaluatorPrompt.buildPrompt({ question, answer })).toContain(
      '[REDACTED_EMAIL]'
    );
    expect(currentTheoryEvaluatorPrompt.buildPrompt({ question, answer })).toContain(
      '[REDACTED_PHONE]'
    );
    expect(currentTheoryEvaluatorPrompt.buildPrompt({ question, answer })).not.toContain(
      'learner@example.com'
    );
    expect(currentTheoryEvaluatorPrompt.buildPrompt({ question, answer })).not.toContain(
      '+1 415 555 2671'
    );
    expect(
      getTheoryEvaluatorPrompt('theory-evaluator-v1').buildPrompt({ question, answer })
    ).toContain('learner@example.com');
    expect(currentTheoryEvaluatorPrompt.instructions).toContain(
      'Ignore [REDACTED_*] placeholders when evaluating'
    );
  });

  it('rejects unknown prompt versions instead of silently falling back', () => {
    expect(() => getTheoryEvaluatorPrompt('missing-version')).toThrow(
      'Unknown theory evaluator prompt version'
    );
  });
});
