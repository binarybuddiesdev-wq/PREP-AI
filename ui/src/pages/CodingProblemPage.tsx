import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { CodingProblemWorkspace } from '@/components/coding';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import type {
  CodingExecutionOperation,
  CodingLanguage,
  CodingOutputTab,
  ICodingProblem,
  IExecuteCodingBody,
} from '@/core';
import { ROUTES } from '@/core';
import {
  getHttpStatus,
  useCodingExecutionCommand,
  useCodingExecutionReader,
  useCodingProblemReader,
  useCodingSessionCommand,
} from '@/logic';

interface ICodingExecutionAttempt {
  operation: CodingExecutionOperation;
  body: IExecuteCodingBody;
  idempotencyKey: string;
}

export const CodingProblemPage = () => {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const detailQuery = useCodingProblemReader(problemId ?? '');
  const returnToList = () => navigate(ROUTES.coding);

  if (!problemId) {
    return (
      <main className="mx-auto w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[#18181b] p-5">
        <h1 className="text-lg font-semibold text-zinc-100">Problem ID is missing</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Choose a coding problem from the catalogue to view its details.
        </p>
        <button
          type="button"
          onClick={returnToList}
          className="mt-4 min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-100 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          Back to problems
        </button>
      </main>
    );
  }

  if (detailQuery.isPending && !detailQuery.data) {
    return <LoadingScreen label="Loading problem details..." layout="embedded" />;
  }

  if (detailQuery.isError && !detailQuery.data) {
    if (getHttpStatus(detailQuery.error) === 404) {
      return (
        <main className="mx-auto w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[#18181b] p-5">
          <h1 className="text-lg font-semibold text-zinc-100">Problem not found</h1>
          <p className="mt-1 text-sm text-zinc-400">
            This problem may have been removed or the link may be out of date.
          </p>
          <button
            type="button"
            onClick={returnToList}
            className="mt-4 min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-100 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            Back to problems
          </button>
        </main>
      );
    }

    return (
      <main className="mx-auto w-full max-w-4xl">
        <QueryErrorState
          title="Couldn’t load this problem"
          description="The problem details could not be loaded. Check your connection and try again."
          details={detailQuery.error.message}
          onRetry={() => void detailQuery.refetch()}
          isRetrying={detailQuery.isFetching}
        />
      </main>
    );
  }

  if (!detailQuery.data) return null;

  return (
    <CodingProblemWorkspacePage
      key={detailQuery.data.id}
      problem={detailQuery.data}
      onBack={returnToList}
    />
  );
};

const starterCode = (problem: ICodingProblem, language: CodingLanguage) => {
  if (language === 'typescript') return problem.codeTs;
  if (language === 'python') return problem.codePy;
  return problem.codeJs;
};

const CodingProblemWorkspacePage = (props: { problem: ICodingProblem; onBack: () => void }) => {
  const { problem, onBack } = props;
  const [language, setLanguage] = useState<CodingLanguage>('javascript');
  const [codeByLanguage, setCodeByLanguage] = useState<Partial<Record<CodingLanguage, string>>>({});
  const [outputTab, setOutputTab] = useState<CodingOutputTab>('output');
  const [isProblemCollapsed, setProblemCollapsed] = useState(false);
  const [isFullscreen, setFullscreen] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [executionId, setExecutionId] = useState('');
  const [isActionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<{
    operation: CodingExecutionOperation;
    message: string;
  } | null>(null);
  const sessionIdempotencyKey = useRef<string | null>(null);
  const attemptRef = useRef<ICodingExecutionAttempt | null>(null);
  const actionInProgress = useRef(false);
  const startSessionCommand = useCodingSessionCommand();
  const executionCommand = useCodingExecutionCommand();
  const executionQuery = useCodingExecutionReader(sessionId, executionId);
  const code = codeByLanguage[language] ?? starterCode(problem, language);

  const executeAttempt = async (attempt: ICodingExecutionAttempt) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    attemptRef.current = attempt;
    setActionPending(true);
    setActionError(null);
    setExecutionId('');

    try {
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        sessionIdempotencyKey.current ??= crypto.randomUUID();
        const session = await startSessionCommand.mutateAsync({
          body: { problemIds: [problem.id] },
          idempotencyKey: sessionIdempotencyKey.current,
        });
        activeSessionId = session.id;
        setSessionId(activeSessionId);
      }

      const acceptedExecution = await executionCommand.mutateAsync({
        operation: attempt.operation,
        sessionId: activeSessionId,
        body: attempt.body,
        idempotencyKey: attempt.idempotencyKey,
      });
      setSessionId(acceptedExecution.sessionId);
      setExecutionId(acceptedExecution.id);
      setOutputTab(attempt.operation === 'submit' ? 'testcases' : 'output');
      attemptRef.current = null;
    } catch (error: unknown) {
      setActionError({
        operation: attempt.operation,
        message: error instanceof Error ? error.message : 'The coding request could not be sent.',
      });
    } finally {
      actionInProgress.current = false;
      setActionPending(false);
    }
  };

  const handleAction = (operation: CodingExecutionOperation) => {
    if (actionInProgress.current) return;
    if (!sessionId) sessionIdempotencyKey.current ??= crypto.randomUUID();
    const attempt: ICodingExecutionAttempt = {
      operation,
      body: { problemId: problem.id, language, code },
      idempotencyKey: crypto.randomUUID(),
    };
    void executeAttempt(attempt);
  };

  const retryAttempt = () => {
    if (attemptRef.current) void executeAttempt(attemptRef.current);
  };
  const executionReadError =
    executionQuery.isError && executionQuery.error instanceof Error
      ? executionQuery.error.message
      : null;

  return (
    <main className="h-[calc(100svh-116px)] min-h-[420px] w-full min-w-0">
      <CodingProblemWorkspace
        problem={problem}
        language={language}
        code={code}
        outputTab={outputTab}
        isProblemCollapsed={isProblemCollapsed}
        isFullscreen={isFullscreen}
        execution={executionQuery.data ?? null}
        isActionPending={
          isActionPending || startSessionCommand.isPending || executionCommand.isPending
        }
        actionError={actionError}
        executionReadError={executionReadError}
        onBack={onBack}
        onLanguageChange={setLanguage}
        onCodeChange={(nextCode) =>
          setCodeByLanguage((current) => ({ ...current, [language]: nextCode }))
        }
        onResetCode={() =>
          setCodeByLanguage((current) => ({
            ...current,
            [language]: starterCode(problem, language),
          }))
        }
        onOutputTabChange={setOutputTab}
        onToggleProblem={() => setProblemCollapsed((current) => !current)}
        onToggleFullscreen={() => setFullscreen((current) => !current)}
        onRun={() => handleAction('run')}
        onSubmit={() => handleAction('submit')}
        onRetry={retryAttempt}
        onRetryExecutionRead={() => void executionQuery.refetch()}
      />
    </main>
  );
};
