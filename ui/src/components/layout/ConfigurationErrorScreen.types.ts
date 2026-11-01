export type TErrorCategory = 'Application error' | 'Setup required' | 'Unexpected error';

export interface IConfigurationErrorScreenProps {
  title: string;
  description: string;
  category?: TErrorCategory;
  details?: string;
  actionLabel?: string;
  onAction?: () => void;
}
