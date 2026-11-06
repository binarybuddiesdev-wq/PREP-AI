import { Check, X } from 'lucide-react';
import type { ICodingTestCaseResultProps } from './CodingTestCaseResult.types';
import { CodingInputArguments } from './CodingInputArguments';
import { CodingValue } from './CodingValue';

export const CodingTestCaseResult = (props: ICodingTestCaseResultProps) => {
  const { caseNumber, testCase, argumentNames } = props;
  const outputClassName = testCase.passed
    ? 'text-[var(--success-strong)]'
    : 'text-[var(--danger-strong)]';

  return (
    <li className="mb-1.5 flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-xs last:mb-0">
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
        <div className="min-w-0">
          <p className="mb-0.5 text-[10px] text-[var(--dim)]">Test {caseNumber} — Input</p>
          <CodingInputArguments
            value={testCase.input}
            ariaLabel="Test case inputs"
            argumentNames={argumentNames}
          />
        </div>
        <div
          role="group"
          aria-label="Output comparison"
          className="col-span-1 grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-2 sm:gap-4"
        >
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] text-[var(--dim)]">Expected</p>
            <CodingValue value={testCase.expected} ariaLabel="Expected output" />
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] text-[var(--dim)]">Got</p>
            <CodingValue value={testCase.got} ariaLabel="Your output" className={outputClassName} />
          </div>
        </div>
      </div>
      <span className={outputClassName} aria-label={testCase.passed ? 'Passed' : 'Failed'}>
        {testCase.passed ? (
          <Check aria-hidden="true" className="size-3.5" />
        ) : (
          <X aria-hidden="true" className="size-3.5" />
        )}
        <span className="sr-only">{testCase.passed ? 'Passed' : 'Failed'}</span>
      </span>
    </li>
  );
};
