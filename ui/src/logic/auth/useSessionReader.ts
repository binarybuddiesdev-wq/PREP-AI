import { useAuthSession } from '@/service/auth';
import type { SessionReaderResult } from './session.types';

export const useSessionReader = (): SessionReaderResult => {
  const { isLoaded, isSignedIn, user } = useAuthSession();

  return { isLoaded, isSignedIn, user };
};
