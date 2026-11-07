import { describe, expect, it } from 'vitest';

import { dismissToast, enqueueToast } from '@/data/feedback';
import { setTheme, toggleTheme } from '@/data/theme';
import { rootReducer } from './rootReducer';

describe('rootReducer', () => {
  it('initializes the app state with theme and feedback defaults', () => {
    expect(rootReducer(undefined, { type: '@@test/init' })).toEqual({
      theme: 'dark',
      feedback: { toasts: [] },
      _placeholder: null,
    });
  });

  it.each([
    ['dark', 'light'],
    ['light', 'dark'],
  ] as const)('toggles theme from %s to %s', (current, expected) => {
    const state = rootReducer(undefined, setTheme(current));

    expect(rootReducer(state, toggleTheme()).theme).toBe(expected);
  });

  it('adds a uniquely identified toast without mutating the previous state', () => {
    const previous = rootReducer(undefined, { type: '@@test/init' });
    const next = rootReducer(previous, enqueueToast({ message: 'Saved', kind: 'success' }));

    expect(previous.feedback.toasts).toEqual([]);
    expect(next.feedback.toasts).toHaveLength(1);
    expect(next.feedback.toasts[0]).toMatchObject({ message: 'Saved', kind: 'success' });
    expect(next.feedback.toasts[0].id).toBeTruthy();
  });

  it('keeps only the most recent four queued notifications', () => {
    let state = rootReducer(undefined, { type: '@@test/init' });
    for (const message of ['one', 'two', 'three', 'four', 'five', 'six']) {
      state = rootReducer(state, enqueueToast({ message, kind: 'info' }));
    }

    expect(state.feedback.toasts.map((toast) => toast.message)).toEqual([
      'three',
      'four',
      'five',
      'six',
    ]);
  });

  it('dismisses only the requested toast id', () => {
    let state = rootReducer(undefined, { type: '@@test/init' });
    state = rootReducer(state, enqueueToast({ message: 'Keep', kind: 'info' }));
    state = rootReducer(state, enqueueToast({ message: 'Remove', kind: 'error' }));
    const removeId = state.feedback.toasts[1].id;

    state = rootReducer(state, dismissToast(removeId));

    expect(state.feedback.toasts.map((toast) => toast.message)).toEqual(['Keep']);
  });
});
