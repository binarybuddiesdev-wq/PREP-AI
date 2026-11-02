export interface IQueryErrorStateProps {
  title: string;
  description: string;
  details?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}
