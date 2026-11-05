import { describe, expect, it } from 'vitest';

import { studyChatKeys } from './studyChat.keys';

describe('studyChatKeys', () => {
  it('scopes conversation lists and transcripts to the signed-in user', () => {
    expect(studyChatKeys.all).toEqual(['prepai', 'study-chat']);
    expect(studyChatKeys.conversations('user-one')).toEqual([
      'prepai',
      'study-chat',
      'user-one',
      'conversations',
    ]);
    expect(studyChatKeys.conversation('user-one', 'conversation-one')).toEqual([
      'prepai',
      'study-chat',
      'user-one',
      'conversation',
      'conversation-one',
    ]);
    expect(studyChatKeys.conversations('user-one')).not.toEqual(
      studyChatKeys.conversations('user-two')
    );
    expect(studyChatKeys.conversation('user-one', 'conversation-one')).not.toEqual(
      studyChatKeys.conversation('user-two', 'conversation-one')
    );
  });
});
