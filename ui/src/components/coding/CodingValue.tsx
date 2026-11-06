import { formatCodingValue } from '@/utils';
import type { ICodingValueProps } from './CodingValue.types';

export const CodingValue = (props: ICodingValueProps) => {
  const { value, ariaLabel, className = '' } = props;

  return (
    <pre
      aria-label={ariaLabel}
      className={`mt-1.5 max-h-28 min-w-0 overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 ${className}`}
    >
      <code className="whitespace-pre-wrap break-words font-mono text-xs leading-5">
        {formatCodingValue(value)}
      </code>
    </pre>
  );
};
