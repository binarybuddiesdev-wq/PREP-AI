import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';

import { rootReducer } from '@/data/store/rootReducer';
import { enqueueToast } from '@/data';
import { AppToastViewport } from '@/app/AppToastViewport';
import { getApiErrorMessage } from '@/utils/apiErrorMessage';
import { createQueryClient } from '@/logic/queryClient';

interface IRenderWithProvidersOptions {
  includeToastViewport?: boolean;
}

export const renderWithProviders = (
  element: ReactElement,
  initialEntries: string[] = ['/'],
  options: IRenderWithProvidersOptions = {}
) => {
  const store = configureStore({ reducer: rootReducer });
  const queryClient = createQueryClient((error) =>
    store.dispatch(
      enqueueToast({
        kind: 'error',
        message: getApiErrorMessage(error, 'complete this request'),
      })
    )
  );
  queryClient.setDefaultOptions({ queries: { retry: false } });

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
