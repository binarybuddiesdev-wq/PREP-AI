import { combineReducers } from '@reduxjs/toolkit';
import { themeReducer } from '@/data/theme';
import { feedbackReducer } from '@/data/feedback';

export const rootReducer = combineReducers({
  theme: themeReducer,
  feedback: feedbackReducer,
  _placeholder: (state: null = null) => state,
});
