import type { Theme } from '@/core';

export interface ILandingNavProps {
  homeTo: string;
  signInTo: string;
  signUpTo: string;
  theme: Theme;
  onToggleTheme: () => void;
}
