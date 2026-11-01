import { act, render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from './AppErrorBoundary';

interface IThrowErrorProps {
  shouldThrow: boolean;
}

class ThrowError extends Component<IThrowErrorProps> {
  public render(): ReactNode {
    if (this.props.shouldThrow) {
      throw new Error('Render failed for test');
    }
    return <p>Child content</p>;
  }
}

describe('AppErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a recovery screen when a child render fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow />
      </AppErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('Render failed for test')).toBeInTheDocument();
  });

  it('shows a recovery screen for an uncaught browser error', () => {
    render(
      <AppErrorBoundary>
        <p>App content</p>
      </AppErrorBoundary>
    );

    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'Browser callback failed' }));
    });

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('Browser callback failed')).toBeInTheDocument();
  });

  it('shows a recovery screen for an unhandled promise rejection', () => {
    render(
      <AppErrorBoundary>
        <p>App content</p>
      </AppErrorBoundary>
    );

    act(() => {
      const rejectionEvent = Object.assign(new Event('unhandledrejection'), {
        reason: new Error('Promise failed'),
      }) as PromiseRejectionEvent;
      window.dispatchEvent(rejectionEvent);
    });

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('Promise failed')).toBeInTheDocument();
  });
});
