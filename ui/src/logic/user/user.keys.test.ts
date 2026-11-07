import { describe, expect, it } from 'vitest';

import { userKeys } from './user.keys';

describe('userKeys', () => {
  it('isolates profile and settings caches by authenticated user', () => {
    expect(userKeys.me('clerk-user-a')).not.toEqual(userKeys.me('clerk-user-b'));
    expect(userKeys.settings('clerk-user-a')).not.toEqual(userKeys.settings('clerk-user-b'));
    expect(userKeys.me('clerk-user-a')).not.toEqual(userKeys.settings('clerk-user-a'));
  });
});
