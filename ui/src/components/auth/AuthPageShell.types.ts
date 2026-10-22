import type { ReactNode } from 'react';

export interface IAuthPageShellProps {
  brandTo: string;
  footerPrompt: string;
  footerLinkTo: string;
  footerLinkLabel: string;
  children: ReactNode;
}
