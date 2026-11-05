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

  it('scopes session history pages and session details to the authenticated user', () => {
    expect(codingKeys.sessionHistories('user-one')).toEqual([
      'prepai',
      'coding',
      'user-one',
      'sessions',
    ]);
    expect(codingKeys.sessionHistory('user-one', 2, 20)).toEqual([
      'prepai',
      'coding',
      'user-one',
      'sessions',
      { page: 2, limit: 20 },
    ]);
    expect(codingKeys.sessionDetail('user-one', 'session-one')).toEqual([
      'prepai',
      'coding',
      'user-one',
      'session',
      'session-one',
      'detail',
    ]);
    expect(codingKeys.sessionHistory('user-one', 2, 20)).not.toEqual(
      codingKeys.sessionHistory('user-two', 2, 20)
    );
    expect(codingKeys.sessionDetail('user-one', 'session-one')).not.toEqual(
      codingKeys.sessionDetail('user-two', 'session-one')
    );
    expect(codingKeys.sessionHistories('user-one')).not.toEqual(
      codingKeys.sessionHistories('user-two')
    );
  });
});
