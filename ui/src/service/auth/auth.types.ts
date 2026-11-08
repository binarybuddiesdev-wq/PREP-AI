import type { ReactNode } from 'react';

export interface IAuthUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  createdAt: Date | null;
}

export interface IAuthProfileUpdate {
  firstName: string;
  lastName: string;
}

export interface IAuthSession {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: IAuthUser | null;
  updateProfile: (profile: IAuthProfileUpdate) => Promise<void>;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

export interface IAuthProviderProps {
  children: ReactNode;
}
