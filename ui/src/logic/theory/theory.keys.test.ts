import { describe, expect, it } from 'vitest';

import { theoryKeys } from './theory.keys';

describe('theoryKeys', () => {
  it('roots all keys at the theory resource and scopes them to the current user', () => {
    expect(theoryKeys.all).toEqual(['prepai', 'theory']);
    expect(theoryKeys.practiceTopics('user-one')).toEqual([
      'prepai',
      'theory',
      'user-one',
      'practice-topics',
    ]);
    expect(theoryKeys.practiceTopics('user-one')).not.toEqual(
      theoryKeys.practiceTopics('user-two')
    );
  });

  it('includes identifiers and request parameters for dependent queries', () => {
    expect(theoryKeys.history('user-one', 2, 20)).toEqual([
      'prepai',
      'theory',
      'user-one',
      'history',
      { page: 2, limit: 20 },
    ]);
    expect(theoryKeys.scoreTrend('user-one', 7)).toEqual([
      'prepai',
      'theory',
      'user-one',
      'score-trend',
      7,
    ]);
    expect(theoryKeys.sessionQuestions('user-one', 'session-one', 10)).toEqual([
      'prepai',
      'theory',
      'user-one',
      'session',
      'session-one',
      'questions',
      10,
    ]);
    expect(theoryKeys.evaluation('user-one', 'session-one', 'answer-one')).toEqual([
      'prepai',
      'theory',
      'user-one',
      'session',
      'session-one',
      'answer',
      'answer-one',
    ]);
  });
});
