import { formatCodingValue } from '@/utils';

interface ICodingValueProps {
  value: unknown;
  ariaLabel: string;
  className?: string;
}

export const CodingValue = ({ value, ariaLabel, className = '' }: ICodingValueProps) => (
  <pre
    aria-label={ariaLabel}
    className={`mt-2 max-h-36 min-w-0 overflow-auto rounded-md bg-[var(--surface)] px-2.5 py-2 ${className}`}
  >
    <code className="whitespace-pre-wrap break-words font-mono text-xs leading-5">
      {formatCodingValue(value)}
    </code>
  </pre>
);
