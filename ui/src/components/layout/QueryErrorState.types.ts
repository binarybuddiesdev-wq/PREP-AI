export interface IQueryErrorStateProps {
  title: string;
  description: string;
  onRetry: () => void;
  isRetrying?: boolean;
}
