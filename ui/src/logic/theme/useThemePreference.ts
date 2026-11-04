import { useLayoutEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { Theme } from '@/core';
import { setTheme, toggleTheme as toggleThemeAction } from '@/data';
import type { AppDispatch, RootState } from '@/data';

const THEME_STORAGE_KEY = 'prepai-theme';

const isTheme = (value: string | null): value is Theme => value === 'dark' || value === 'light';

export const useThemePreference = () => {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useSelector((state: RootState) => state.theme);
  const hasLoadedPreference = useRef(false);

  useLayoutEffect(() => {
    if (!hasLoadedPreference.current) {
      hasLoadedPreference.current = true;
      try {
        const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (isTheme(storedTheme)) {
          dispatch(setTheme(storedTheme));
          return;
        }
      } catch (error) {
        console.warn('PrepAI could not read the saved theme preference.', error);
      }
    }

    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('PrepAI could not save the theme preference.', error);
    }
  }, [dispatch, theme]);

  return {
    theme,
    toggleTheme: () => dispatch(toggleThemeAction()),
  };
};
