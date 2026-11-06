import { describe, expect, it } from 'vitest';
import { getCodingArgumentNames } from './getCodingArgumentNames';

describe('getCodingArgumentNames', () => {
  it('reads positional names from the problem starter for named sample inputs', () => {
    expect(
      getCodingArgumentNames({
        codeJs: 'function twoSum(nums, target) {}',
        codeTs: 'function twoSum(nums: number[], target: number): number[] { return []; }',
        codePy: 'def two_sum(nums, target):\n    pass',
      })
    ).toEqual(['nums', 'target']);
  });

  it('falls back to TypeScript or Python starter signatures when JavaScript has none', () => {
    expect(
      getCodingArgumentNames({
        codeJs: '',
        codeTs: 'function solve(values: number[], limit: number) { return []; }',
        codePy: 'def solve(values, limit):\n    pass',
      })
    ).toEqual(['values', 'limit']);
    expect(
      getCodingArgumentNames({
        codeJs: '',
        codeTs: '',
        codePy: 'def solve(values, limit):\n    pass',
      })
    ).toEqual(['values', 'limit']);
  });
});
