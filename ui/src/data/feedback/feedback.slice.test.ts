import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import { dismissToast, enqueueToast, feedbackReducer } from './feedback.slice';

describe('shared feedback state', () => {
  it('adds a dismissible toast and removes it by id', () => {
    const store = configureStore({ reducer: feedbackReducer });

    store.dispatch(enqueueToast({ kind: 'success', message: 'Settings saved.' }));
    const [toast] = store.getState().toasts;
    expect(toast).toMatchObject({ kind: 'success', message: 'Settings saved.' });
    expect(toast.id).toBeTruthy();

    store.dispatch(dismissToast(toast.id));
    expect(store.getState().toasts).toEqual([]);
  });

  it('keeps only the four newest notifications in the queue', () => {
    const store = configureStore({ reducer: feedbackReducer });
    for (let index = 1; index <= 5; index += 1) {
      store.dispatch(enqueueToast({ kind: 'info', message: `Message ${index}` }));
    }

    expect(store.getState().toasts.map(({ message }) => message)).toEqual([
      'Message 2',
      'Message 3',
      'Message 4',
      'Message 5',
    ]);
  });
});
