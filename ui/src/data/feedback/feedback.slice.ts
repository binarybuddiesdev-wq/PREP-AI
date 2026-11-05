import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

import type { IEnqueueToast, IToastMessage } from '@/core';

interface IFeedbackState {
  toasts: IToastMessage[];
}

const MAX_TOASTS = 4;

const feedbackSlice = createSlice({
  name: 'feedback',
  initialState: { toasts: [] } as IFeedbackState,
  reducers: {
    enqueueToast: {
      reducer: (state, action: PayloadAction<IToastMessage>) => {
        state.toasts.push(action.payload);
        if (state.toasts.length > MAX_TOASTS) state.toasts.shift();
      },
      prepare: (toast: IEnqueueToast) => ({ payload: { ...toast, id: nanoid() } }),
    },
    dismissToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { dismissToast, enqueueToast } = feedbackSlice.actions;
export const feedbackReducer = feedbackSlice.reducer;
