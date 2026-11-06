import { formatCodingValue } from '@/utils';
import type { ICodingInputArgumentsProps } from './CodingInputArguments.types';

export const CodingInputArguments = (props: ICodingInputArgumentsProps) => {
  const { value, ariaLabel } = props;
  const argumentsList = Array.isArray(value) ? value : [value];
  const formattedArguments = argumentsList
    .map((argument) => formatCodingValue(argument))
    .join(', ');

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="mt-1.5 min-w-0 rounded-md bg-[var(--surface2)] px-3 py-2.5"
    >
      {argumentsList.length > 0 ? (
        <code className="block max-h-28 min-w-0 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[var(--text)] [overflow-wrap:anywhere]">
          {formattedArguments}
        </code>
      ) : (
        <span className="block text-xs text-[var(--dim)]">No input arguments</span>
      )}
    </div>
  );
};
