import { formatCodingValue } from '@/utils';
import type { ICodingValueProps } from './CodingValue.types';

export const CodingValue = (props: ICodingValueProps) => {
  const { value, ariaLabel, className = '' } = props;

  return (
    <pre
      aria-label={ariaLabel}
      className="m-0 min-w-0 overflow-hidden font-mono text-xs text-[var(--dim)]"
    >
      <code
        className={`block truncate whitespace-nowrap font-mono ${className || 'text-[var(--dim)]'}`}
      >
        {formatCodingValue(value)}
      </code>
    </pre>
  );
};
