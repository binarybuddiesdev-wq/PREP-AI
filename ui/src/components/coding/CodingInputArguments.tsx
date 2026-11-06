import { formatCodingValue } from '@/utils';
import type { ICodingInputArgumentsProps } from './CodingInputArguments.types';

export const CodingInputArguments = (props: ICodingInputArgumentsProps) => {
  const { value, ariaLabel } = props;
  const argumentsList = Array.isArray(value) ? value : [value];

  return (
    <ol
      aria-label={ariaLabel}
      className="mt-1.5 min-w-0 divide-y divide-[var(--border)] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]"
    >
      {argumentsList.length > 0 ? (
        argumentsList.map((argument, index) => (
          <li
            key={index}
            className="grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] gap-2 px-2.5 py-2"
          >
            <span className="pt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--dim)]">
              Argument {index + 1}
            </span>
            <code
              aria-label={`Argument ${index + 1}`}
              className="max-h-28 min-w-0 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[var(--text)]"
            >
              {formatCodingValue(argument)}
            </code>
          </li>
        ))
      ) : (
        <li className="px-2.5 py-2 text-xs text-[var(--dim)]">No input arguments</li>
      )}
    </ol>
  );
};
