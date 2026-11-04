import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ITheoryAnswer,
  IStartTheorySessionBody,
  ISubmitTheoryAnswerBody,
  ITheorySession,
} from '@/core';
import { useTheoryAnswerCommand } from './useTheoryAnswerCommand';
import { useTheoryCompleteSessionCommand } from './useTheoryCompleteSessionCommand';
import { useTheoryEvaluationReader } from './useTheoryEvaluationReader';
import { useTheorySessionCommand } from './useTheorySessionCommand';
import { useTheorySessionQuestionsReader } from './useTheoryPracticeReader';
import { isPdfQuestionGenerationPending } from './pdfQuestionGeneration';

export type TheoryPracticePhase =
  'setup' | 'loading' | 'error' | 'question' | 'submitted' | 'empty' | 'complete';

const createIdempotencyKey = () => globalThis.crypto.randomUUID();

export const useTheoryPracticeSession = () => {
  const startCommand = useTheorySessionCommand();
  const answerCommand = useTheoryAnswerCommand();
  const completionCommand = useTheoryCompleteSessionCommand();
  const [session, setSession] = useState<ITheorySession | null>(null);
  const [completedSession, setCompletedSession] = useState<ITheorySession | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<ITheoryAnswer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<ITheoryAnswer | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<{
    sessionId: string;
    body: Readonly<ISubmitTheoryAnswerBody>;
    idempotencyKey: string;
  } | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [view, setView] = useState<'question' | 'submitted' | 'complete'>('question');
  const [answerDraft, setAnswerDraft] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [endRequested, setEndRequested] = useState(false);
  const [completionAttempted, setCompletionAttempted] = useState(false);
  const startLock = useRef(false);
  const submitLock = useRef(false);
  const completionLock = useRef(false);
  const pendingSubmissionRef = useRef<typeof pendingSubmission>(null);
  const sessionId = session?.id ?? '';
  const isPdfStudy = session?.mode === 'pdf';
  const questionsQuery = useTheorySessionQuestionsReader(
    sessionId,
    session?.totalQuestions,
    isPdfStudy
  );
  const pdfQuestionsPending = isPdfStudy && isPdfQuestionGenerationPending(questionsQuery.error);
  const evaluationQuery = useTheoryEvaluationReader(sessionId, currentAnswer?.id ?? '');
  const questions = questionsQuery.data ?? [];
  const evaluation = evaluationQuery.data ?? currentAnswer;
  const evaluationPending = evaluation?.status === 'queued' || evaluation?.status === 'running';
  const activeQuestion =
    view === 'complete' || questionsQuery.isError ? null : (questions[questionIndex] ?? null);

  const phase: TheoryPracticePhase = !session
    ? 'setup'
    : questionsQuery.isPending || pdfQuestionsPending
      ? 'loading'
      : questionsQuery.isError
        ? 'error'
        : questions.length === 0
          ? view === 'complete'
            ? 'complete'
            : 'empty'
          : view;

  useEffect(() => {
    if (phase !== 'question' || !activeQuestion) return;
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const interval = globalThis.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => globalThis.clearInterval(interval);
  }, [activeQuestion?.id, phase]);

  useEffect(() => {
    if (!evaluation) return;
    setSavedAnswers((previous) => {
      const index = previous.findIndex((saved) => saved.id === evaluation.id);
      if (index < 0) return [...previous, evaluation];
      if (previous[index] === evaluation) return previous;
      return previous.map((saved, answerIndex) => (answerIndex === index ? evaluation : saved));
    });
  }, [evaluation]);

  const completeSession = useCallback(async (): Promise<ITheorySession | null> => {
    if (!sessionId || completionLock.current || completionCommand.isPending || evaluationPending) {
      return null;
    }
    completionLock.current = true;
    setCompletionAttempted(true);
    setCompletionError(null);
    try {
      const completed = await completionCommand.mutateAsync(sessionId);
      setCompletedSession(completed);
      setView('complete');
      return completed;
    } catch (error) {
      setCompletionError(
        error instanceof Error ? error.message : 'Could not complete the session.'
      );
      return null;
    } finally {
      completionLock.current = false;
    }
  }, [completionCommand, evaluationPending, sessionId]);

  useEffect(() => {
    if (
      !endRequested ||
      completionAttempted ||
      evaluationPending ||
      evaluationQuery.isError ||
      phase === 'complete'
    ) {
      return;
    }
    void completeSession();
  }, [
    completeSession,
    completionAttempted,
    endRequested,
    evaluationPending,
    evaluationQuery.isError,
    phase,
  ]);

  const start = useCallback(
    async (body: IStartTheorySessionBody): Promise<ITheorySession | null> => {
      if (session || startLock.current || startCommand.isPending) return null;
      startLock.current = true;
      setStartError(null);
      try {
        const startedSession = await startCommand.mutateAsync({
          body,
          idempotencyKey: createIdempotencyKey(),
        });
        setSession(startedSession);
        setCompletedSession(null);
        setCompletionAttempted(false);
        setEndRequested(false);
        setSavedAnswers([]);
        setCurrentAnswer(null);
        setPendingSubmission(null);
        pendingSubmissionRef.current = null;
        setQuestionIndex(0);
        setAnswerDraft('');
        setView('question');
        return startedSession;
      } catch (error) {
        setStartError(error instanceof Error ? error.message : 'Could not start this session.');
        return null;
      } finally {
        startLock.current = false;
      }
    },
    [session, startCommand]
  );

  const advance = useCallback(() => {
    setSubmitError(null);
    setAnswerDraft('');
    setElapsedSeconds(0);
    if (questionIndex + 1 >= questions.length) {
      setEndRequested(true);
      setCompletionAttempted(false);
      void completeSession();
      return;
    }
    setQuestionIndex((index) => index + 1);
    setView('question');
  }, [completeSession, questionIndex, questions.length]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (
      phase !== 'question' ||
      !sessionId ||
      !activeQuestion ||
      !answerDraft.trim() ||
      submitLock.current ||
      answerCommand.isPending
    ) {
      return false;
    }

    submitLock.current = true;
    setSubmitError(null);
    let request = pendingSubmissionRef.current;
    if (!request) {
      const body = Object.freeze<ISubmitTheoryAnswerBody>({
        questionId: activeQuestion.id,
        questionText: activeQuestion.question,
        userAnswer: answerDraft.trim(),
        timeTaken: elapsedSeconds,
      });
      request = Object.freeze({
        sessionId,
        body,
        idempotencyKey: createIdempotencyKey(),
      });
      pendingSubmissionRef.current = request;
      setPendingSubmission(request);
    }
    try {
      const savedAnswer = await answerCommand.mutateAsync(request);
      setCurrentAnswer(savedAnswer);
      setSavedAnswers((previous) => [
        ...previous.filter((item) => item.id !== savedAnswer.id),
        savedAnswer,
      ]);
      pendingSubmissionRef.current = null;
      setPendingSubmission(null);
      setView('submitted');
      return true;
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save your answer.');
      return false;
    } finally {
      submitLock.current = false;
    }
  }, [activeQuestion, answerCommand, answerDraft, elapsedSeconds, phase, sessionId]);

  const skip = useCallback(() => {
    if (phase !== 'question') return;
    pendingSubmissionRef.current = null;
    setPendingSubmission(null);
    setSubmitError(null);
    advance();
  }, [advance, phase]);

  const end = useCallback(async () => {
    if (!session || phase === 'setup' || phase === 'complete') return;
    if (pendingSubmissionRef.current) {
      setSubmitError('Retry this answer or skip it before ending the session.');
      return;
    }
    setEndRequested(true);
    if (!evaluationPending && !evaluationQuery.isError) {
      setCompletionAttempted(false);
      await completeSession();
    }
  }, [completeSession, evaluationPending, evaluationQuery.isError, phase, session]);

  const continueAfterSubmit = useCallback(() => {
    if (phase === 'submitted' && !evaluationPending && !evaluationQuery.isError) {
      setCurrentAnswer(null);
      advance();
    }
  }, [advance, evaluationPending, evaluationQuery.isError, phase]);

  const reset = useCallback(() => {
    setSession(null);
    setCompletedSession(null);
    setSavedAnswers([]);
    setCurrentAnswer(null);
    setPendingSubmission(null);
    pendingSubmissionRef.current = null;
    setQuestionIndex(0);
    setView('question');
    setAnswerDraft('');
    setElapsedSeconds(0);
    setStartError(null);
    setSubmitError(null);
    setCompletionError(null);
    setEndRequested(false);
    setCompletionAttempted(false);
    answerCommand.reset();
    completionCommand.reset();
  }, [answerCommand, completionCommand]);

  const setDraft = useCallback((value: string) => {
    if (pendingSubmissionRef.current) return;
    setAnswerDraft(value);
    setSubmitError(null);
  }, []);

  return {
    session,
    sessionId,
    phase,
    questions,
    questionsQuery,
    activeQuestion: phase === 'question' || phase === 'submitted' ? activeQuestion : null,
    progress: {
      current: phase === 'question' || phase === 'submitted' ? questionIndex + 1 : 0,
      total: questions.length,
    },
    answerDraft,
    setAnswerDraft: setDraft,
    elapsedSeconds,
    isStarting: startCommand.isPending,
    isSubmitting: answerCommand.isPending,
    isAnswerFrozen: pendingSubmission !== null,
    evaluation,
    evaluationQuery,
    canContinue:
      Boolean(evaluation) && !evaluationPending && !evaluationQuery.isError && !endRequested,
    isEnding: endRequested && (evaluationPending || evaluationQuery.isError),
    isCompleting: completionCommand.isPending,
    isEndRequested: endRequested,
    completionError: completionError ?? completionCommand.error?.message ?? null,
    completedSession: completedSession ?? completionCommand.data ?? null,
    savedAnswers,
    scoredAnswerCount: savedAnswers.filter((answer) => answer.aiScore !== null).length,
    failedAnswerCount: savedAnswers.filter((answer) => answer.status === 'failed').length,
    endRequested,
    startError: startError ?? startCommand.error?.message ?? null,
    submitError: submitError ?? answerCommand.error?.message ?? null,
    start,
    submit,
    retryCompletion: () => {
      setCompletionAttempted(false);
      void completeSession();
    },
    skip,
    end,
    completeSession,
    continueAfterSubmit,
    reset,
  };
};
