import { formatCodingValue } from '@/utils';
import type { ICodingValueProps } from './CodingValue.types';

export const CodingValue = (props: ICodingValueProps) => {
  const { value, ariaLabel, className = '' } = props;

  return (
    <pre
      aria-label={ariaLabel}
      className={`mt-1.5 max-h-28 min-w-0 overflow-auto rounded-md bg-[var(--surface2)] px-3 py-2.5 ${className}`}
    >
      <code className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[var(--text)]">
        {formatCodingValue(value)}
      </code>
    </pre>
  );
};
