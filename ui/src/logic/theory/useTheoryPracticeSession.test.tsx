import { act, renderHook, waitFor } from '@testing-library/react';
import { HTTPError } from 'ky';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  IStartTheorySessionBody,
  ITheoryAnswer,
  ITheoryQuestion,
  ITheorySession,
} from '@/core';
import { useTheoryPracticeSession } from './useTheoryPracticeSession';

const state = vi.hoisted(() => ({
  startMutation: vi.fn(),
  answerMutation: vi.fn(),
  resetAnswer: vi.fn(),
  evaluationReader: vi.fn(),
  completeMutation: vi.fn(),
  questionReader: vi.fn(),
  evaluationIsError: false,
  evaluationRefetch: vi.fn(),
  completedSessionData: null as ITheorySession | null,
  resetCompletion: vi.fn(),
  questions: [] as ITheoryQuestion[],
  questionsError: null as Error | null,
  questionsIsPending: false,
  evaluation: null as ITheoryAnswer | null,
}));

vi.mock('./useTheorySessionCommand', () => ({
  useTheorySessionCommand: () => ({
    mutateAsync: state.startMutation,
    isPending: false,
    error: null,
  }),
}));
vi.mock('./useTheoryAnswerCommand', () => ({
  useTheoryAnswerCommand: () => ({
    mutateAsync: state.answerMutation,
    isPending: false,
    error: null,
    reset: state.resetAnswer,
  }),
}));
vi.mock('./useTheoryEvaluationReader', () => ({
  useTheoryEvaluationReader: (sessionId: string, answerId: string) => {
    state.evaluationReader(sessionId, answerId);
    return {
      data: answerId ? state.evaluation : null,
      isPending: false,
      isFetching: false,
      isError: state.evaluationIsError,
      error: state.evaluationIsError ? new Error('Evaluation read failed') : null,
      refetch: state.evaluationRefetch,
    };
  },
}));
vi.mock('./useTheoryCompleteSessionCommand', () => ({
  useTheoryCompleteSessionCommand: () => ({
    mutateAsync: state.completeMutation,
    isPending: false,
    error: null,
    data: state.completedSessionData,
    reset: state.resetCompletion,
  }),
}));
vi.mock('./useTheoryPracticeReader', () => ({
  useTheorySessionQuestionsReader: (sessionId: string, limit: number, isPdfStudy: boolean) => {
    state.questionReader(sessionId, limit, isPdfStudy);
    return sessionId
      ? {
          data: state.questions,
          isPending: state.questionsIsPending,
          isError: Boolean(state.questionsError),
          error: state.questionsError,
          refetch: vi.fn(),
        }
      : { data: undefined, isPending: false, isError: false, error: null, refetch: vi.fn() };
  },
}));

const session: ITheorySession = {
  id: 'session-one',
  topicId: 'topic-one',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 0,
  avgScore: 0,
  status: 'in_progress',
  startedAt: '2026-11-04T07:00:00.000Z',
  completedAt: null,
  createdAt: '2026-11-04T07:00:00.000Z',
};
const questions: ITheoryQuestion[] = [
  { id: 'question-one', question: 'First question?', topicId: 'topic-one', difficulty: 'Mid' },
  { id: 'question-two', question: 'Second question?', topicId: 'topic-one', difficulty: 'Mid' },
];
const answer: ITheoryAnswer = {
  id: 'answer-one',
  sessionId: 'session-one',
  questionId: 'question-one',
  questionText: questions[0].question,
  userAnswer: 'A state hook',
  aiScore: null,
  aiFeedback: null,
  evaluationProvider: null,
  evaluationModel: null,
  evaluationPromptVersion: null,
  status: 'queued',
  failureMessage: null,
  startedAt: null,
  completedAt: null,
  timeTaken: 0,
  createdAt: '2026-11-04T07:00:00.000Z',
  updatedAt: '2026-11-04T07:00:00.000Z',
};
const startBody: IStartTheorySessionBody = {
  topicId: 'topic-one',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
};

describe('useTheoryPracticeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.questions = questions;
    state.questionsError = null;
    state.questionsIsPending = false;
    state.startMutation.mockResolvedValue(session);
    state.answerMutation.mockResolvedValue(answer);
    state.resetAnswer.mockReset();
    state.evaluation = null;
    state.evaluationIsError = false;
    state.evaluationRefetch.mockReset();
    state.completedSessionData = null;
    state.resetCompletion.mockReset();
    state.resetCompletion.mockImplementation(() => {
      state.completedSessionData = null;
    });
    state.completeMutation.mockImplementation(async () => {
      const completedSession = { ...session, status: 'completed' as const };
      state.completedSessionData = completedSession;
      return completedSession;
    });
  });

  afterEach(() => vi.useRealTimers());

  it('retains the started session and enables questions using the requested count', async () => {
    const { result } = renderHook(() => useTheoryPracticeSession());

    await act(async () => {
      await result.current.start(startBody);
    });

    expect(result.current.sessionId).toBe('session-one');
    expect(result.current.activeQuestion).toEqual(questions[0]);
    expect(result.current.progress).toEqual({ current: 1, total: 2 });
    expect(state.questionReader).toHaveBeenCalledWith('session-one', 10, false);
    expect(result.current.phase).toBe('question');
  });

  it('shows a safe and actionable message when the API cannot start a practice session', async () => {
    const error = new HTTPError(
      new Response(null, { status: 500 }),
      new Request('http://api.test/api/v1/theory/session/start'),
      {} as never
    );
    error.message = 'Internal server error';
    state.startMutation.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useTheoryPracticeSession());

    await act(async () => {
      await result.current.start(startBody);
    });

    expect(result.current.startError).toBe(
      "Couldn't start this practice session because the API returned HTTP 500. Check the backend/database and retry."
    );
  });

  it('keeps PDF question generation conflicts in the preparing state', async () => {
    const pendingError = new HTTPError(
      new Response(null, { status: 409 }),
      new Request('http://localhost/api/v1/theory/session/session-one/questions'),
      {} as never
    );
    pendingError.message = 'PDF study questions are still being generated';
    state.questionsError = pendingError;
    state.startMutation.mockResolvedValue({ ...session, mode: 'pdf' });
    const { result } = renderHook(() => useTheoryPracticeSession());

    await act(async () => {
      await result.current.start({
        ...startBody,
        topicId: undefined,
        pdfIds: ['pdf-one'],
        mode: 'pdf',
      });
    });

    expect(state.questionReader).toHaveBeenCalledWith('session-one', 10, true);
    expect(result.current.phase).toBe('loading');
    expect(result.current.questionsQuery.error).toBe(pendingError);
  });

  it('counts elapsed seconds and resets the timer and answer when advancing', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });
    act(() => result.current.setAnswerDraft('draft answer'));
    act(() => vi.advanceTimersByTime(2500));

    expect(result.current.elapsedSeconds).toBe(2);
    await act(async () => {
      result.current.skip();
    });

    expect(result.current.activeQuestion).toEqual(questions[1]);
    expect(result.current.answerDraft).toBe('');
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it('advances skipped questions locally without submitting empty answers', async () => {
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });

    await act(async () => {
      result.current.skip();
    });

    expect(result.current.activeQuestion).toEqual(questions[1]);
    expect(state.answerMutation).not.toHaveBeenCalled();
  });

  it('submits the active question, answer, and elapsed seconds once', async () => {
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });
    act(() => result.current.setAnswerDraft('  A state hook  '));

    await act(async () => {
      await result.current.submit();
    });

    expect(state.answerMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-one',
        body: {
          questionId: 'question-one',
          questionText: 'First question?',
          userAnswer: 'A state hook',
          timeTaken: expect.any(Number),
        },
        idempotencyKey: expect.any(String),
      })
    );
    expect(result.current.phase).toBe('submitted');
    expect(result.current.evaluation).toEqual(answer);
  });

  it('completes a scored session before starting another with the same settings', async () => {
    const nextSession = { ...session, id: 'session-two' };
    state.startMutation.mockResolvedValueOnce(session).mockResolvedValueOnce(nextSession);
    state.evaluation = { ...answer, status: 'completed', aiScore: 8, aiFeedback: 'Good.' };
    const { result } = renderHook(() => useTheoryPracticeSession());

    await act(async () => {
      await result.current.start(startBody);
    });
    act(() => result.current.setAnswerDraft('A state hook'));
    await act(async () => {
      await result.current.submit();
    });

    let restartedSession: ITheorySession | null = null;
    await act(async () => {
      restartedSession = await result.current.restart(startBody);
    });

    expect(state.completeMutation).toHaveBeenCalledWith('session-one');
    expect(state.startMutation).toHaveBeenNthCalledWith(2, {
      body: startBody,
      idempotencyKey: expect.any(String),
    });
    expect(restartedSession).toEqual(nextSession);
    expect(result.current.sessionId).toBe('session-two');
    expect(result.current.phase).toBe('question');
    expect(result.current.savedAnswers).toEqual([]);
  });

  it('keeps the feedback session active when completing it for a restart fails', async () => {
    state.evaluation = { ...answer, status: 'completed', aiScore: 8, aiFeedback: 'Good.' };
    state.completeMutation.mockRejectedValue(new Error('Could not complete session.'));
    const { result } = renderHook(() => useTheoryPracticeSession());

    await act(async () => {
      await result.current.start(startBody);
    });
    act(() => result.current.setAnswerDraft('A state hook'));
    await act(async () => {
      await result.current.submit();
    });

    await act(async () => {
      await result.current.restart(startBody);
    });

    expect(state.startMutation).toHaveBeenCalledOnce();
    expect(result.current.sessionId).toBe('session-one');
    expect(result.current.completionError).toBe('Could not complete session.');
    expect(result.current.phase).toBe('submitted');
  });

  it('retries the full restart after the current session completion recovers', async () => {
    const nextSession = { ...session, id: 'session-two' };
    state.startMutation.mockResolvedValueOnce(session).mockResolvedValueOnce(nextSession);
    state.completeMutation.mockRejectedValueOnce(new Error('Temporary completion failure.'));
    state.evaluation = { ...answer, status: 'completed', aiScore: 8, aiFeedback: 'Good.' };
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });
    act(() => result.current.setAnswerDraft('A state hook'));
    await act(async () => {
      await result.current.submit();
    });

    await act(async () => {
      await result.current.restart(startBody);
    });
    expect(result.current.canRetryRestart).toBe(true);
    expect(state.startMutation).toHaveBeenCalledOnce();

    act(() => result.current.retryRestart());
    await waitFor(() => expect(result.current.sessionId).toBe('session-two'));

    expect(state.completeMutation).toHaveBeenCalledTimes(2);
    expect(state.startMutation).toHaveBeenCalledTimes(2);
    expect(result.current.canRetryRestart).toBe(false);
  });

  it('does not restart while answer evaluation is still pending', async () => {
    state.evaluation = answer;
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });
    act(() => result.current.setAnswerDraft('A state hook'));
    await act(async () => {
      await result.current.submit();
    });

    let restartedSession: ITheorySession | null = null;
    await act(async () => {
      restartedSession = await result.current.restart(startBody);
    });

    expect(restartedSession).toBeNull();
    expect(state.completeMutation).not.toHaveBeenCalled();
    expect(state.startMutation).toHaveBeenCalledOnce();
    expect(result.current.phase).toBe('submitted');
  });

  it('returns to setup with the actual start error if the replacement session cannot start', async () => {
    state.startMutation
      .mockResolvedValueOnce(session)
      .mockRejectedValueOnce(new Error('Daily session limit reached.'));
    state.evaluation = { ...answer, status: 'completed', aiScore: 8, aiFeedback: 'Good.' };
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });
    act(() => result.current.setAnswerDraft('A state hook'));
    await act(async () => {
      await result.current.submit();
    });

    await act(async () => {
      await result.current.restart(startBody);
    });

    expect(state.completeMutation).toHaveBeenCalledOnce();
    expect(result.current.sessionId).toBe('');
    expect(result.current.phase).toBe('setup');
    expect(result.current.startError).toBe('Daily session limit reached.');
  });

  it('reuses the frozen answer body and key after a timeout', async () => {
    state.answerMutation
      .mockRejectedValueOnce(new Error('Request timed out'))
      .mockResolvedValue(answer);
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });
    act(() => result.current.setAnswerDraft('A state hook'));

    await act(async () => {
      await result.current.submit();
    });
    const firstRequest = state.answerMutation.mock.calls[0][0];
    expect(Object.isFrozen(firstRequest)).toBe(true);
    expect(Object.isFrozen(firstRequest.body)).toBe(true);

    await act(async () => {
      await result.current.submit();
    });

    expect(state.answerMutation).toHaveBeenCalledTimes(2);
    expect(state.answerMutation.mock.calls[1][0]).toBe(firstRequest);
    expect(state.answerMutation.mock.calls[1][0]).toEqual(firstRequest);
  });

  it('does not complete while evaluation is pending and completes when it becomes terminal', async () => {
    state.evaluation = answer;
    const { result, rerender } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });
    act(() => result.current.setAnswerDraft('A state hook'));
    await act(async () => {
      await result.current.submit();
    });

    await act(async () => {
      await result.current.end();
    });
    expect(result.current.endRequested).toBe(true);
    expect(state.completeMutation).not.toHaveBeenCalled();

    state.evaluation = { ...answer, status: 'completed', aiScore: 0, aiFeedback: 'Needs depth.' };
    await act(async () => rerender());

    expect(state.completeMutation).toHaveBeenCalledWith('session-one');
    expect(result.current.phase).toBe('complete');
  });

  it('completes an end-requested session after retrying an evaluation read failure', async () => {
    state.evaluation = answer;
    state.evaluationIsError = true;
    const { result, rerender } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });
    act(() => result.current.setAnswerDraft('A state hook'));
    await act(async () => {
      await result.current.submit();
    });
    await act(async () => {
      await result.current.end();
    });

    expect(result.current.endRequested).toBe(true);
    expect(state.completeMutation).not.toHaveBeenCalled();

    state.evaluationIsError = false;
    state.evaluation = { ...answer, status: 'completed', aiScore: 7, aiFeedback: 'Good.' };
    state.evaluationRefetch.mockResolvedValue({ data: state.evaluation });
    await act(async () => {
      await result.current.evaluationQuery.refetch();
      rerender();
    });

    expect(state.evaluationRefetch).toHaveBeenCalledOnce();
    await waitFor(() => expect(state.completeMutation).toHaveBeenCalledWith('session-one'));
    expect(result.current.phase).toBe('complete');
  });

  it('completes a session with no submitted answers and keeps zero score distinct from unscored', async () => {
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });

    await act(async () => {
      await result.current.end();
    });

    expect(state.completeMutation).toHaveBeenCalledWith('session-one');
    expect(result.current.completedSession?.avgScore).toBe(0);
    expect(result.current.scoredAnswerCount).toBe(0);
  });

  it('handles no returned questions without creating invalid progress', async () => {
    state.questions = [];
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });

    expect(result.current.phase).toBe('empty');
    expect(result.current.activeQuestion).toBeNull();
    expect(result.current.progress).toEqual({ current: 0, total: 0 });
  });

  it('uses the returned count for short sessions and completes when the last question is skipped', async () => {
    state.questions = [questions[0]];
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });

    expect(result.current.progress).toEqual({ current: 1, total: 1 });
    await act(async () => {
      result.current.skip();
    });

    await waitFor(() => expect(state.completeMutation).toHaveBeenCalledWith('session-one'));
    expect(result.current.phase).toBe('complete');
    expect(result.current.activeQuestion).toBeNull();
    expect(result.current.progress).toEqual({ current: 0, total: 1 });
  });

  it('ends the current session without advancing to a question that does not exist', async () => {
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });

    await act(async () => {
      await result.current.end();
    });

    expect(result.current.phase).toBe('complete');
    expect(result.current.activeQuestion).toBeNull();
    expect(result.current.progress).toEqual({ current: 0, total: 2 });
  });

  it('clears completion mutation data so practice can be started again', async () => {
    const { result } = renderHook(() => useTheoryPracticeSession());
    await act(async () => {
      await result.current.start(startBody);
    });
    await act(async () => {
      await result.current.end();
    });
    expect(result.current.completedSession).toBeTruthy();

    act(() => result.current.reset());

    expect(state.resetCompletion).toHaveBeenCalledOnce();
    expect(result.current.completedSession).toBeNull();
    await act(async () => {
      await result.current.start(startBody);
    });
    expect(state.startMutation).toHaveBeenCalledTimes(2);
  });

  it('prevents duplicate start requests while the first start is pending', async () => {
    let resolveStart!: (value: ITheorySession) => void;
    state.startMutation.mockReturnValue(
      new Promise<ITheorySession>((resolve) => {
        resolveStart = resolve;
      })
    );
    const { result } = renderHook(() => useTheoryPracticeSession());
    let firstStart!: Promise<ITheorySession | null>;
    act(() => {
      firstStart = result.current.start(startBody);
      void result.current.start(startBody);
    });

    expect(state.startMutation).toHaveBeenCalledOnce();
    await act(async () => {
      resolveStart(session);
      await firstStart;
    });
  });
});
