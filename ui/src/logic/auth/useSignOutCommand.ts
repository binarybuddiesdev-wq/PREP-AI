import { useAuthSession } from '@/service/auth';

export const useSignOutCommand = (): (() => Promise<void>) => {
  const { signOut } = useAuthSession();

  return signOut;
};
