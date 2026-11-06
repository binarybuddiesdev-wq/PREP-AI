import type { ICodingTestCaseResultProps } from './CodingTestCaseResult.types';
import { CodingInputArguments } from './CodingInputArguments';
import { CodingValue } from './CodingValue';

export const CodingTestCaseResult = (props: ICodingTestCaseResultProps) => {
  const { caseNumber, testCase } = props;
  const outputClassName = testCase.passed
    ? 'text-[var(--success-strong)]'
    : 'text-[var(--danger-strong)]';

  return (
    <li className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 sm:px-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-h)]">
          <span className="flex size-6 items-center justify-center rounded-md bg-[var(--surface2)] font-mono text-xs text-[var(--dim)]">
            {caseNumber}
          </span>
          Test case {caseNumber}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${testCase.passed ? 'bg-[var(--green-bg)] text-[var(--success-strong)]' : 'bg-[var(--red-bg)] text-[var(--danger-strong)]'}`}
        >
          {testCase.passed ? 'Passed' : 'Failed'}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[var(--dim)]">Input</p>
          <div className="min-w-0">
            <CodingInputArguments value={testCase.input} ariaLabel="Test case inputs" />
          </div>
        </div>
        <div
          role="group"
          aria-label="Output comparison"
          className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[var(--dim)]">Expected</p>
            <div>
              <CodingValue value={testCase.expected} ariaLabel="Expected output" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[var(--dim)]">Your output</p>
            <div>
              <CodingValue
                value={testCase.got}
                ariaLabel="Your output"
                className={outputClassName}
              />
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};
