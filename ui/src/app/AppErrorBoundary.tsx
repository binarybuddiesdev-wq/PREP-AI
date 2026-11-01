import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ConfigurationErrorScreen } from '@/components/layout';

interface IAppErrorBoundaryProps {
  children: ReactNode;
}

interface IAppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<IAppErrorBoundaryProps, IAppErrorBoundaryState> {
  public state: IAppErrorBoundaryState = { error: null };

  public componentDidMount(): void {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public componentWillUnmount(): void {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public static getDerivedStateFromError(error: Error): IAppErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught application render error', error, errorInfo.componentStack);
  }

  private readonly handleWindowError = (event: ErrorEvent): void => {
    this.setState({
      error:
        event.error instanceof Error
          ? event.error
          : new Error(event.message || 'Unknown browser error'),
    });
  };

  private readonly handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    this.setState({
      error:
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason ?? 'Unknown asynchronous error')),
    });
  };

  public render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <ConfigurationErrorScreen
          title="Something went wrong"
          description="PrepAI encountered an unexpected error and couldn’t display this screen. Reload the app to try again."
          category="Unexpected error"
          details={error.message}
          actionLabel="Reload PrepAI"
          onAction={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
