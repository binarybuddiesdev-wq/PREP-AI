import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { ToastKind } from '@/core';
import { dismissToast, enqueueToast } from '@/data';
import type { AppDispatch, RootState } from '@/data';

export const useToastCommand = () => {
  const dispatch = useDispatch<AppDispatch>();
  const show = useCallback(
    (kind: ToastKind, message: string) => dispatch(enqueueToast({ kind, message })),
    [dispatch]
  );

  return {
    success: (message: string) => show('success', message),
    error: (message: string) => show('error', message),
    info: (message: string) => show('info', message),
  };
};

export const useToastViewportController = () => {
  const dispatch = useDispatch<AppDispatch>();
  const toasts = useSelector((state: RootState) => state.feedback.toasts);
  const theme = useSelector((state: RootState) => state.theme);
  const dismiss = useCallback((id: string) => dispatch(dismissToast(id)), [dispatch]);

  return { toasts, theme, dismiss };
};
