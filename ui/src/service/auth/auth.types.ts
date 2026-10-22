import type { ReactNode } from 'react';

export interface IAuthUser {
  id: string;
  firstName: string | null;
  email: string | null;
  createdAt: Date | null;
}

export interface IAuthSession {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: IAuthUser | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

export interface IAuthProviderProps {
  children: ReactNode;
}
