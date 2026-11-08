import { describe, expect, it } from 'vitest';
import { getQuestionBankPolicy } from './question-bank.policy.js';
import { questionBankTopics } from './question-bank-catalog.js';

describe('getQuestionBankPolicy', () => {
  it('keeps a deeper theory pool and replenishes before learners exhaust it', () => {
    expect(getQuestionBankPolicy('theory')).toEqual({
      target: 50,
      lowWater: 20,
      batchSize: 10,
      difficulties: ['Junior', 'Mid', 'Senior'],
    });
  });

  it('keeps a coding problem pool and replenishes it before exhaustion', () => {
    expect(getQuestionBankPolicy('coding')).toEqual({
      target: 20,
      lowWater: 8,
      batchSize: 1,
      difficulties: ['Easy', 'Medium', 'Hard'],
    });
  });
});

describe('question bank topic catalog', () => {
  it('covers every practice and coding topic, including separate system design levels', () => {
    expect(
      questionBankTopics.filter(({ category }) => category === 'practice').map(({ slug }) => slug)
    ).toEqual([
      'react',
      'typescript',
      'javascript',
      'html',
      'css',
      'nodejs',
      'expressjs',
      'nestjs',
      'mongodb',
      'postgresql',
      'redis',
      'system-design',
      'high-level-system-design',
      'low-level-system-design',
    ]);
    expect(questionBankTopics.filter(({ category }) => category === 'coding')).toHaveLength(11);
  });
});
