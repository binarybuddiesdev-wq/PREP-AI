import { formatCodingValue } from '@/utils';
import type { ICodingTestCaseResultProps } from './CodingTestCaseResult.types';

export const CodingTestCaseResult = (props: ICodingTestCaseResultProps) => {
  const { caseNumber, testCase } = props;
  const outputClassName = testCase.passed
    ? 'text-[var(--success-strong)]'
    : 'text-[var(--danger-strong)]';

  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
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
      <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 sm:col-span-2">
          <dt className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dim)]">
            Input
          </dt>
          <dd>
            <pre
              aria-label="Test case input"
              className="max-h-36 overflow-auto rounded bg-[var(--surface)] px-2.5 py-2 font-mono text-[13px] leading-5 text-[var(--text)]"
            >
              <code className="whitespace-pre">{formatCodingValue(testCase.input)}</code>
            </pre>
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
          <dt className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dim)]">
            Expected
          </dt>
          <dd>
            <pre
              aria-label="Expected output"
              className="max-h-36 overflow-auto rounded bg-[var(--surface)] px-2.5 py-2 font-mono text-[13px] leading-5 text-[var(--text)]"
            >
              <code className="whitespace-pre">{formatCodingValue(testCase.expected)}</code>
            </pre>
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
          <dt className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dim)]">
            Your output
          </dt>
          <dd>
            <pre
              aria-label="Your output"
              className={`max-h-36 overflow-auto rounded bg-[var(--surface)] px-2.5 py-2 font-mono text-[13px] leading-5 ${outputClassName}`}
            >
              <code className="whitespace-pre">{formatCodingValue(testCase.got)}</code>
            </pre>
          </dd>
        </div>
      </dl>
    </li>
  );
};
