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
    <li className="mb-1 flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-[0.65rem] py-2 text-[0.75rem] last:mb-0">
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-[0.15rem] text-[0.65rem] text-[var(--dim)]">Test {caseNumber} — Input</p>
          <CodingInputArguments
            value={testCase.input}
            ariaLabel="Test case inputs"
            argumentNames={argumentNames}
          />
        </div>
        <div
          role="group"
          aria-label="Output comparison"
          className="grid min-w-0 flex-[2] grid-cols-2 gap-4"
        >
          <div className="min-w-0">
            <p className="mb-[0.15rem] text-[0.65rem] text-[var(--dim)]">Expected</p>
            <CodingValue value={testCase.expected} ariaLabel="Expected output" />
          </div>
          <div className="min-w-0">
            <p className="mb-[0.15rem] text-[0.65rem] text-[var(--dim)]">Got</p>
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
