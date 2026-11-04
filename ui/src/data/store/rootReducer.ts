import { combineReducers } from '@reduxjs/toolkit';
import { themeReducer } from '@/data/theme';

export const rootReducer = combineReducers({
  theme: themeReducer,
  _placeholder: (state: null = null) => state,
});
