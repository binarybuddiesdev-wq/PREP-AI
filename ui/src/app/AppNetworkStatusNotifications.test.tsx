import { act, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { dismissToast, store } from '@/data';
import { AppToastViewport } from './AppToastViewport';
import { AppNetworkStatusNotifications } from './AppNetworkStatusNotifications';

describe('AppNetworkStatusNotifications', () => {
  afterEach(() => {
    store.getState().feedback.toasts.forEach(({ id }) => store.dispatch(dismissToast(id)));
  });

  it('shows a shared warning while offline and an info toast after reconnecting', () => {
    render(
      <Provider store={store}>
        <AppNetworkStatusNotifications />
        <AppToastViewport />
      </Provider>
    );

    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent(
      'You are offline. Changes may not be saved until your connection returns.'
    );

    act(() => window.dispatchEvent(new Event('online')));
    expect(screen.getByText('Connection restored.')).toBeVisible();
  });
});
