import { describe, expect, it } from 'vitest';

import { dashboardKeys } from './dashboard.keys';

describe('dashboardKeys', () => {
  it('isolates cached dashboard data by account', () => {
    const keysFor = (userId: string) => [
      dashboardKeys.theoryHistory(userId),
      dashboardKeys.codingHistory(userId),
      dashboardKeys.scoreTrend(userId),
      dashboardKeys.weakAreas(userId),
      dashboardKeys.practiceTopics(userId),
    ];

    expect(keysFor('user-one')).not.toEqual(keysFor('user-two'));
  });
});
