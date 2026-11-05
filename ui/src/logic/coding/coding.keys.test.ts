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

  it('scopes execution caches by user and execution context', () => {
    expect(codingKeys.execution('user-one', 'session-one', 'execution-one')).toEqual([
      'prepai',
      'coding',
      'user-one',
      'session',
      'session-one',
      'execution',
      'execution-one',
    ]);
    expect(codingKeys.execution('user-one', 'session-one', 'execution-one')).not.toEqual(
      codingKeys.execution('user-two', 'session-one', 'execution-one')
    );
  });
});
