import type { ReactNode } from 'react';

export interface IAuthPageShellProps {
  brandTo: string;
  children: ReactNode;
  mode?: 'sign-in' | 'sign-up';
}
