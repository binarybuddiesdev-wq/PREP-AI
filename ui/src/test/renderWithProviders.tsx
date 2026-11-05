import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { rootReducer } from '@/data/store/rootReducer';
import { AppToastViewport } from '@/app/AppToastViewport';

interface IRenderWithProvidersOptions {
  includeToastViewport?: boolean;
}

export const renderWithProviders = (
  element: ReactElement,
  initialEntries: string[] = ['/'],
  options: IRenderWithProvidersOptions = {}
) => {
  const store = configureStore({ reducer: rootReducer });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {element}
          {options.includeToastViewport && <AppToastViewport />}
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};
