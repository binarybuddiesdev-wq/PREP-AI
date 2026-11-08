import { describe, expect, it } from 'vitest';
import { balancedParenthesesQuestion } from './coding-question-seeds.js';

describe('balanced parentheses coding question seed', () => {
  it('uses examples that agree with the balanced-parentheses rule', () => {
    expect(balancedParenthesesQuestion.description).toContain("'a(b)c' and 'a(b)' are valid");
    expect(balancedParenthesesQuestion.examples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: ['a(b)c'], output: true }),
        expect.objectContaining({ input: ['a(b)'], output: true }),
        expect.objectContaining({ input: ['a)b('], output: false }),
      ])
    );
  });
});
