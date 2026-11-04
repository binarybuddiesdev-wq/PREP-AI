import { describe, expect, it } from 'vitest';

import { codingKeys } from './coding.keys';

describe('codingKeys', () => {
  it('scopes catalogue and problem detail caches to the authenticated user', () => {
    expect(codingKeys.all).toEqual(['prepai', 'coding']);
    expect(codingKeys.problems('user-one')).toEqual(['prepai', 'coding', 'user-one', 'problems']);
    expect(codingKeys.problem('user-one', 'two-sum')).toEqual([
      'prepai',
      'coding',
      'user-one',
      'problem',
      'two-sum',
    ]);
    expect(codingKeys.problems('user-one')).not.toEqual(codingKeys.problems('user-two'));
  });
});
