import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastViewport } from './ToastViewport';

describe('ToastViewport', () => {
  afterEach(() => vi.useRealTimers());

  it('announces and dismisses a success message', () => {
    const onDismiss = vi.fn();
    render(
      <ToastViewport
        toasts={[{ id: 'toast-1', kind: 'success', message: 'Settings saved.' }]}
        theme="dark"
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Settings saved.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('announces error messages with alert priority', () => {
    render(
      <ToastViewport
        toasts={[{ id: 'toast-2', kind: 'error', message: 'Could not save settings.' }]}
        theme="dark"
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save settings.');
  });

  it('announces warnings with the shared warning toast treatment', () => {
    render(
      <ToastViewport
        toasts={[{ id: 'toast-warning', kind: 'warning', message: 'Check your connection.' }]}
        theme="dark"
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Check your connection.');
  });

  it('dismisses a toast automatically after its display window', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <ToastViewport
        toasts={[{ id: 'toast-3', kind: 'info', message: 'Your changes are syncing.' }]}
        theme="dark"
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Your changes are syncing.');
    act(() => vi.advanceTimersByTime(6000));
    expect(onDismiss).toHaveBeenCalledWith('toast-3');
  });
});
