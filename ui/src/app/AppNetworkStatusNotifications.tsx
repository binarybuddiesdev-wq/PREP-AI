import { useEffect } from 'react';

import { useToastCommand } from '@/logic';

export const AppNetworkStatusNotifications = () => {
  const toast = useToastCommand();

  useEffect(() => {
    const handleOffline = () =>
      toast.warning('You are offline. Changes may not be saved until your connection returns.');
    const handleOnline = () => toast.info('Connection restored.');

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [toast.info, toast.warning]);

  return null;
};
