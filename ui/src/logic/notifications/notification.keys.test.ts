import { describe, expect, it } from 'vitest';

import { notificationKeys } from './notification.keys';

describe('notification query keys', () => {
  it('scopes inbox and unread count to the authenticated user', () => {
    expect(notificationKeys.inbox('user-one')).not.toEqual(notificationKeys.inbox('user-two'));
    expect(notificationKeys.unreadCount('user-one')).not.toEqual(
      notificationKeys.unreadCount('user-two')
    );
    expect(notificationKeys.inbox('user-one')).toEqual([
      'prepai',
      'notifications',
      'user-one',
      'inbox',
    ]);
  });
});
