import { describe, expect, it } from 'vitest';

import type { ICodingProblemSummary } from '@/core';
import { filterCodingProblems, getCodingProblemTopics } from './filterCodingProblems';

const problems: ICodingProblemSummary[] = [
  {
    id: 'array-easy',
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Find a pair.',
    difficulty: 'Easy',
    topic: 'Arrays',
    isSolved: true,
  },
  {
    id: 'tree-hard',
    title: 'Binary Tree Paths',
    slug: 'binary-tree-paths',
    description: 'List root-to-leaf paths.',
    difficulty: 'Hard',
    topic: 'Trees',
    isSolved: false,
  },
  {
    id: 'array-medium',
    title: 'Product Except Self',
    slug: 'product-except-self',
    description: 'Build a product array.',
    difficulty: 'Medium',
    topic: 'Arrays',
    isSolved: false,
  },
];

describe('coding problem filters', () => {
  it('combines topic and difficulty filters without changing source order', () => {
    expect(filterCodingProblems(problems, 'Arrays', 'Medium')).toEqual([problems[2]]);
    expect(filterCodingProblems(problems, null, 'Hard')).toEqual([problems[1]]);
    expect(filterCodingProblems(problems, null, null)).toEqual(problems);
  });

  it('returns unique topic choices in their first-seen order', () => {
    expect(getCodingProblemTopics(problems)).toEqual(['Arrays', 'Trees']);
  });
});
