import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleX,
  LoaderCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

import type { CodingExecutionOperation, CodingLanguage, ICodingExecution } from '@/core';
import { CodingReviewDialog } from './CodingReviewDialog';
import { CodingProblemContent } from './CodingProblemContent';
import { CodingTestCaseResult } from './CodingTestCaseResult';
import { CodingInputArguments } from './CodingInputArguments';
import { CodingValue } from './CodingValue';
import { CodingEditor } from './CodingEditor';
import type { ICodingProblemWorkspaceProps } from './CodingProblemWorkspace.types';
import { getCodingArgumentNames } from '@/utils';

const LANGUAGES: readonly { value: CodingLanguage; label: string; extension: string }[] = [
  { value: 'javascript', label: 'JavaScript', extension: 'js' },
  { value: 'typescript', label: 'TypeScript', extension: 'ts' },
  { value: 'python', label: 'Python', extension: 'py' },
];
const FULLSCREEN_FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"], [contenteditable="true"]';
const QUEUED_EXECUTION_WARNING_MS = 45_000;

const executionActionLabel = (operation: CodingExecutionOperation) =>
  operation === 'run' ? 'Run' : 'Submit';

const executionVerdict = (execution: ICodingExecution) => {
  if (!execution.result) return 'Execution completed without a result';
  if (execution.result.status === 'accepted') return 'Accepted';
  if (execution.result.status === 'wrong_answer') return 'Wrong answer';
  return 'Execution error';
};

export const CodingProblemWorkspace = (props: ICodingProblemWorkspaceProps) => {
  const {
    problem,
    language,
    code,
    outputTab,
    isProblemCollapsed,
    isFullscreen,
    execution,
    isActionPending,
    actionError,
    executionReadError,
    reviewActionPending,
    reviewActionError,
    onBack,
    onLanguageChange,
    onCodeChange,
    onResetCode,
    onOutputTabChange,
    onToggleProblem,
    onToggleFullscreen,
    onRun,
    onSubmit,
    onRetry,
    onRetryExecutionRead,
    onRequestReview,
  } = props;
  const selectedLanguage = LANGUAGES.find((item) => item.value === language) ?? LANGUAGES[0];
  const fileBaseName = problem.title
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .map((part, index) =>
      index === 0
        ? part.toLowerCase()
        : `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`
    )
    .join('');
  const filename = `${fileBaseName}.${selectedLanguage.extension}`;
  const argumentNames = getCodingArgumentNames(problem);
  const isExecutionActive = execution?.status === 'queued' || execution?.status === 'running';
  const isBusy = isActionPending || isExecutionActive;
  const [isReviewOpen, setReviewOpen] = useState(false);
  const [stalledExecutionId, setStalledExecutionId] = useState<string | null>(null);
  const [isOutputCleared, setOutputCleared] = useState(false);
  const fullscreenDialogRef = useRef<HTMLDivElement>(null);
  const fullscreenFocusReturnRef = useRef<HTMLElement | null>(null);
  const reviewAnswer =
    execution?.status === 'completed' && execution.operation === 'submit' ? execution.answer : null;
  const isQueuedExecutionStalled =
    execution?.status === 'queued' && stalledExecutionId === execution.id;

  useEffect(() => {
    setOutputCleared(false);
  }, [execution?.id]);

  useEffect(() => {
    if (execution?.status !== 'queued') {
      setStalledExecutionId(null);
      return;
    }

    const queuedAt = Date.parse(execution.createdAt);
    if (!Number.isFinite(queuedAt)) return;

    const timeoutId = window.setTimeout(
      () => setStalledExecutionId(execution.id),
      Math.max(0, queuedAt + QUEUED_EXECUTION_WARNING_MS - Date.now())
    );
    return () => window.clearTimeout(timeoutId);
  }, [execution?.createdAt, execution?.id, execution?.status]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      fullscreenFocusReturnRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    onToggleFullscreen();
  };

  const handleFullscreenDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(FULLSCREEN_FOCUSABLE_SELECTOR)
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) {
      event.preventDefault();
      event.currentTarget.focus();
    } else if (!event.currentTarget.contains(document.activeElement)) {
      event.preventDefault();
      firstElement.focus();
    } else if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  useEffect(() => {
    if (!isFullscreen) {
      const previousFocusTarget = fullscreenFocusReturnRef.current;
      if (previousFocusTarget) {
        const focusTarget = previousFocusTarget.isConnected
          ? previousFocusTarget
          : document.querySelector<HTMLElement>('[data-coding-fullscreen-trigger]');
        focusTarget?.focus();
        fullscreenFocusReturnRef.current = null;
      }
      return;
    }

    fullscreenDialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onToggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, onToggleFullscreen]);

  const workspace = (
    <section
      aria-label="Coding workspace"
      aria-hidden={isFullscreen}
      inert={isFullscreen}
      className="coding-workspace flex h-full min-h-0 w-full flex-col"
    >
      <div className="mb-4 flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--dim)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to Problems
        </button>
        {isProblemCollapsed ? (
          <button
            type="button"
            onClick={onToggleProblem}
            aria-label="Show problem description"
            className="rounded-md px-2 py-1 text-xs text-[var(--dim)] hover:bg-[var(--surface2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            Show problem
          </button>
        ) : null}
      </div>

      <div
        data-testid="coding-workspace-grid"
        className={`coding-workspace-grid grid min-h-[calc(100vh-180px)] flex-1 gap-4 ${isProblemCollapsed ? 'grid-cols-1' : 'grid-cols-1 grid-rows-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:grid-cols-2 lg:grid-rows-1'}`}
      >
        {!isProblemCollapsed ? (
          <section className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
            <div className="flex h-[53px] shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
              <h2 className="text-xs font-semibold text-[var(--text-h)]">Problem</h2>
              <button
                type="button"
                onClick={onToggleProblem}
                aria-label="Hide problem description"
                title="Hide problem description"
                className="flex size-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[11px] text-[var(--dim)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                Hide
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <CodingProblemContent problem={problem} />
            </div>
          </section>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <section className="flex min-h-[521px] min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
            <header className="flex h-auto min-h-[39px] shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg2)] px-2 py-1 sm:h-[39px] sm:flex-nowrap sm:gap-0 sm:px-0 sm:py-0">
              <span className="flex h-8 min-w-0 flex-1 items-center gap-2 border-r border-[var(--border)] bg-[var(--card)] px-4 font-mono text-xs text-[var(--dim)] sm:h-full">
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                />
                <span className="truncate">{filename}</span>
              </span>
              <button
                type="button"
                onClick={onRun}
                disabled={isBusy}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent)] px-2.5 text-xs font-semibold text-black transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-50"
              >
                Run
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={isBusy}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border2)] px-2.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-50"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => setReviewOpen(true)}
                disabled={!reviewAnswer}
                title={!reviewAnswer ? 'Submit your code to unlock AI Review' : undefined}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-[var(--purple-strong)] transition hover:bg-[var(--purple-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles aria-hidden="true" className="size-3.5" />
                AI Review
              </button>
              <label className="relative inline-flex shrink-0 items-center">
                <span className="sr-only">Programming language</span>
                <select
                  aria-label="Programming language"
                  value={language}
                  onChange={(event) =>
                    onLanguageChange(event.currentTarget.value as CodingLanguage)
                  }
                  className="coding-language-select h-8 min-w-[132px] appearance-none rounded-md border border-[var(--border2)] bg-[var(--surface)] py-1 pl-2.5 pr-8 text-xs font-medium text-[var(--text)] transition hover:border-[var(--border2)] hover:bg-[var(--surface2)] focus-visible:border-[var(--accent-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bg)]"
                >
                  {LANGUAGES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 size-3.5 text-[var(--dim)]"
                />
              </label>
              <button
                type="button"
                onClick={onResetCode}
                aria-label="Reset code"
                title="Reset code"
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--border2)] text-[var(--dim)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                data-coding-fullscreen-trigger={!isFullscreen ? '' : undefined}
                aria-label={isFullscreen ? 'Exit fullscreen editor' : 'Enter fullscreen editor'}
                title={isFullscreen ? 'Exit fullscreen editor' : 'Enter fullscreen editor'}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--border2)] text-[var(--dim)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                {isFullscreen ? (
                  <Minimize2 aria-hidden="true" className="size-3.5" />
                ) : (
                  <Maximize2 aria-hidden="true" className="size-3.5" />
                )}
              </button>
            </header>
            <div className="min-h-0 flex-1">
              <CodingEditor language={language} value={code} onChange={onCodeChange} />
            </div>
          </section>

          {!isFullscreen ? (
            <section
              className="flex h-[200px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--card)]"
              aria-label="Run results"
            >
              <div
                role="tablist"
                aria-label="Run result views"
                className="flex h-[39px] shrink-0 items-center gap-0 border-b border-[var(--border)] bg-[var(--bg2)] px-2"
              >
                {(['output', 'testcases'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={outputTab === tab}
                    onClick={() => onOutputTabChange(tab)}
                    className={`relative h-full px-4 text-xs transition ${outputTab === tab ? 'bg-[var(--card)] text-[var(--accent-strong)] after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--accent)]' : 'text-[var(--dim)] hover:text-[var(--text)]'}`}
                  >
                    {tab === 'output' ? 'Output' : 'Test Cases'}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOutputCleared(true)}
                  className="ml-auto px-3 py-2 text-[0.72rem] text-[var(--dim)] transition hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  Clear
                </button>
              </div>
              <div
                role="tabpanel"
                className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-xs text-left text-[var(--dim)]"
              >
                {isOutputCleared ? (
                  <div className="flex w-full gap-3 font-mono text-xs text-[var(--dim)]">
                    <span aria-hidden="true" className="min-w-5 text-right">
                      1
                    </span>
                    <span>Click Run Code to see output</span>
                  </div>
                ) : actionError ? (
                  <div
                    role="alert"
                    className="flex h-full flex-col items-center justify-center gap-2 text-center"
                  >
                    <p className="max-w-lg text-[var(--danger-strong)]">{actionError.message}</p>
                    <button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--border2)] px-2.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                    >
                      <RotateCcw aria-hidden="true" className="size-3" />
                      Retry {executionActionLabel(actionError.operation)}
                    </button>
                  </div>
                ) : executionReadError ? (
                  <div
                    role="alert"
                    className="flex h-full flex-col items-center justify-center gap-2 text-center"
                  >
                    <p className="max-w-lg text-[var(--danger-strong)]">{executionReadError}</p>
                    <button
                      type="button"
                      onClick={onRetryExecutionRead}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--border2)] px-2.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                    >
                      <RotateCcw aria-hidden="true" className="size-3" />
                      Retry status check
                    </button>
                  </div>
                ) : isActionPending ? (
                  <p role="status" className="inline-flex items-center gap-2 text-[var(--dim)]">
                    <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                    Starting your request…
                  </p>
                ) : execution?.status === 'queued' || execution?.status === 'running' ? (
                  isQueuedExecutionStalled ? (
                    <div
                      role="alert"
                      className="flex h-full flex-col items-center justify-center gap-2 text-center"
                    >
                      <p className="max-w-lg text-[var(--accent-strong)]">
                        This {execution.operation === 'run' ? 'run' : 'submission'} is taking longer
                        than expected. Check that the coding worker is running, then check the
                        status again.
                      </p>
                      <button
                        type="button"
                        onClick={onRetryExecutionRead}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--border2)] px-2.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                      >
                        <RotateCcw aria-hidden="true" className="size-3" />
                        Check status
                      </button>
                    </div>
                  ) : (
                    <p role="status" className="inline-flex items-center gap-2 text-[var(--dim)]">
                      <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                      <span>
                        {execution.status === 'queued'
                          ? execution.operation === 'run'
                            ? 'Waiting for a code runner. Results refresh automatically.'
                            : 'Waiting for a code runner. Your submission updates automatically.'
                          : 'Your code is running…'}
                      </span>
                    </p>
                  )
                ) : execution?.status === 'failed' ? (
                  <div
                    role="alert"
                    className="flex h-full flex-col items-center justify-center gap-2"
                  >
                    <p className="inline-flex items-center gap-2 text-center text-[var(--danger-strong)]">
                      <CircleX aria-hidden="true" className="size-4 shrink-0" />
                      {execution.failureMessage || 'The code execution could not be completed.'}
                    </p>
                    <button
                      type="button"
                      onClick={execution.operation === 'run' ? onRun : onSubmit}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--border2)] px-2.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                    >
                      <RotateCcw aria-hidden="true" className="size-3" />
                      {executionActionLabel(execution.operation)} again
                    </button>
                  </div>
                ) : execution?.status === 'completed' ? (
                  execution.result ? (
                    <div className="w-full space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold ${execution.result.status === 'accepted' ? 'text-[var(--success-strong)]' : execution.result.status === 'wrong_answer' ? 'text-[var(--accent-strong)]' : 'text-[var(--danger-strong)]'}`}
                        >
                          {execution.result.status === 'accepted' ? (
                            <Check aria-hidden="true" className="size-3.5" />
                          ) : (
                            <X aria-hidden="true" className="size-3.5" />
                          )}
                          {executionVerdict(execution)}
                        </span>
                        <span className="text-[var(--dim)]">
                          {execution.result.testCasesPassed} of {execution.result.testCasesTotal}{' '}
                          test cases passed
                        </span>
                      </div>
                      {outputTab === 'testcases' ? (
                        <ol className="space-y-1.5">
                          {execution.result.testCases.map((testCase, index) => (
                            <CodingTestCaseResult
                              key={`${execution.id}-case-${index + 1}`}
                              caseNumber={index + 1}
                              testCase={testCase}
                              argumentNames={argumentNames}
                            />
                          ))}
                        </ol>
                      ) : null}
                    </div>
                  ) : (
                    'Execution completed without a result.'
                  )
                ) : outputTab === 'output' ? (
                  <div className="flex w-full gap-3 font-mono text-xs text-[var(--dim)]">
                    <span aria-hidden="true" className="min-w-5 text-right">
                      1
                    </span>
                    <span>Click Run Code to see output</span>
                  </div>
                ) : (
                  <ol className="w-full">
                    {problem.examples.slice(0, 3).map((example, index) => (
                      <li
                        key={`${problem.id}-preview-${index + 1}`}
                        className="mb-1.5 flex min-w-0 items-center justify-between gap-4 rounded-md border border-[var(--border)] bg-[var(--bg)] px-[0.65rem] py-2 text-[0.75rem] last:mb-0"
                      >
                        <div className="flex min-w-0 flex-1 gap-4 font-mono">
                          <div className="min-w-0 flex-1">
                            <p className="mb-[0.15rem] font-sans text-[0.65rem] text-[var(--dim)]">
                              Input
                            </p>
                            <CodingInputArguments
                              value={example.input}
                              ariaLabel="Input arguments"
                              argumentNames={argumentNames}
                              isTruncated
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="mb-[0.15rem] font-sans text-[0.65rem] text-[var(--dim)]">
                              Expected
                            </p>
                            <CodingValue value={example.output} ariaLabel="Expected output" />
                          </div>
                        </div>
                        <span aria-hidden="true" className="shrink-0 text-xs text-[var(--dim)]">
                          -
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );

  const reviewDialog = reviewAnswer ? (
    <CodingReviewDialog
      isOpen={isReviewOpen}
      problemTitle={problem.title}
      answer={reviewAnswer}
      isRequestPending={reviewActionPending}
      requestError={reviewActionError}
      onOpenChange={setReviewOpen}
      onRequestReview={onRequestReview}
    />
  ) : null;

  if (!isFullscreen)
    return (
      <>
        {workspace}
        {reviewDialog}
      </>
    );

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[var(--bg)] p-2 sm:p-4">
        <div
          ref={fullscreenDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen coding editor"
          className="h-full"
          tabIndex={-1}
          onKeyDown={handleFullscreenDialogKeyDown}
        >
          <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface2)] px-5">
            <span className="flex h-full items-center gap-2 border-r border-[var(--border)] bg-[var(--card)] pr-5 font-mono text-xs text-[var(--dim)]">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--accent)]" />
              {filename}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <label className="relative inline-flex items-center">
                <span className="sr-only">Programming language</span>
                <select
                  aria-label="Programming language"
                  value={language}
                  onChange={(event) =>
                    onLanguageChange(event.currentTarget.value as CodingLanguage)
                  }
                  className="coding-language-select h-8 min-w-[132px] appearance-none rounded-md border border-[var(--border2)] bg-[var(--surface)] py-1 pl-2.5 pr-8 text-xs font-medium text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  {LANGUAGES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 size-3.5 text-[var(--dim)]"
                />
              </label>
              <button
                type="button"
                onClick={onResetCode}
                aria-label="Reset code"
                title="Reset code"
                className="flex size-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label="Exit fullscreen editor"
                title="Minimize"
                className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              >
                <Minimize2 aria-hidden="true" className="size-4" />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1">
            <CodingEditor language={language} value={code} onChange={onCodeChange} />
          </div>
        </div>
      </div>
      {reviewDialog}
    </>
  );
};
