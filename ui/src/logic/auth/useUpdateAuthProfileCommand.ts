import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { IAuthProfileUpdate } from '@/service/auth';
import { useSessionReader } from './useSessionReader';

export const useUpdateAuthProfileCommand = (): UseMutationResult<
  void,
  Error,
  IAuthProfileUpdate
> => {
  const { updateProfile } = useSessionReader();
  return useMutation({ mutationFn: updateProfile });
};
