import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';

import { rootReducer } from '@/data/store/rootReducer';

export const renderWithProviders = (element: ReactElement, initialEntries: string[] = ['/']) => {
  const store = configureStore({ reducer: rootReducer });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={initialEntries}>{element}</MemoryRouter>
    </Provider>
  );
};
