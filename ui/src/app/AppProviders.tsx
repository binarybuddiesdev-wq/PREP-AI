import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router';
import { enqueueToast, store } from '@/data';
import { createQueryClient } from '@/logic';
import { AuthProvider } from '@/service/auth';
import { getApiErrorMessage } from '@/utils/apiErrorMessage';

interface IAppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: IAppProvidersProps) => {
  const [queryClient] = useState(() =>
    createQueryClient((error) =>
      store.dispatch(
        enqueueToast({
          kind: 'error',
          message: getApiErrorMessage(error, 'complete this request'),
        })
      )
    )
  );

  return (
    <AuthProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter useTransitions={false}>{children}</BrowserRouter>
        </QueryClientProvider>
      </Provider>
    </AuthProvider>
  );
};
