import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router';
import { store } from '@/data';
import { createQueryClient } from '@/logic';
import { AuthProvider } from '@/service/auth';

interface IAppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: IAppProvidersProps) => {
  const [queryClient] = useState(createQueryClient);

  return (
    <AuthProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>{children}</BrowserRouter>
        </QueryClientProvider>
      </Provider>
    </AuthProvider>
  );
};
