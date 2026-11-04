import { describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

import { themeReducer, toggleTheme } from './theme.slice';

describe('theme preference', () => {
  it('starts in dark mode and toggles between dark and light', () => {
    const store = configureStore({ reducer: themeReducer });

    expect(store.getState()).toBe('dark');

    store.dispatch(toggleTheme());
    expect(store.getState()).toBe('light');

    store.dispatch(toggleTheme());
    expect(store.getState()).toBe('dark');
  });
});
