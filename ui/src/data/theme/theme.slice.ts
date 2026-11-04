import { createSlice } from '@reduxjs/toolkit';
import type { Theme } from '@/core/theme';

const themeSlice = createSlice({
  name: 'theme',
  initialState: 'dark' as Theme,
  reducers: {
    setTheme: (_state, action: { payload: Theme }) => action.payload,
    toggleTheme: (state) => (state === 'dark' ? 'light' : 'dark'),
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export const themeReducer = themeSlice.reducer;
