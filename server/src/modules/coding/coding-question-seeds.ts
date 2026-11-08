import type { Prisma } from '../../generated/postgresql-client/index.js';

export const balancedParenthesesQuestion: Prisma.CodingQuestionCreateInput = {
  slug: 'parentheses-checker-snippet',
  title: 'Validating Balanced Parentheses in Code Snippets',
  description:
    "Given a string containing parentheses and letters, determine whether every opening parenthesis is closed in the correct order. For example, 'a(b)c' and 'a(b)' are valid, while 'a)b(' is invalid.",
  difficulty: 'Easy',
  topic: 'Stacks',
  examples: [
    { input: ['a(b)c'], output: true, explanation: 'The opening parenthesis is closed.' },
    { input: ['a(b)'], output: true, explanation: 'The opening parenthesis is closed.' },
    { input: ['a)b('], output: false, explanation: 'A closing parenthesis appears first.' },
  ],
  constraints: ['The input contains only letters, ( and ).'],
  codeJs: 'function solution(value) {\n  // Write your solution here\n}',
  codeTs:
    'function solution(value: string): boolean {\n  // Write your solution here\n  return false;\n}',
  codePy: 'def solution(value):\n    # Write your solution here\n    return False',
};
