# Theory Practice and Session History Design

## Intent

Build the React practice and history screens represented in `prepai-ui.html` using the existing authenticated API and PrepAI's seven-layer frontend architecture. A learner should be able to practice a selected topic or server-selected weak areas, receive the real asynchronous evaluation of each submitted answer, and revisit saved sessions.

## Goals

- Add an authenticated practice route for topic and weak-area modes, using topics and weak areas returned by the API.
- Implement session start, question loading, answer submission, idempotent retries, elapsed-time capture, skipping, evaluation polling, feedback, early completion, and a completion summary.
- Add paginated session history and session details with saved questions, answers, evaluation status, scores, and feedback.
- Add CSV export from actual history records and link dashboard recent sessions to their detail pages.
- Keep each loading, empty, expected API error, unexpected API error, and retry state visible and recoverable.

## Non-goals

- PDF Study, upload, or document selection; those belong to Phase 4.
- Countdown configuration or hints after skipping. The API stores elapsed `timeTaken` only and has no timer or hint policy to honor.
- Coding practice, sample questions, synthetic evaluation scores, browser-persisted sessions, or client-side quota counters.
- New backend endpoints or response contract changes.

## Constraints and contract

- All calls use endpoint functions in `service/api/` through `useApiClient()`; server state belongs in TanStack Query and shared UI state remains in Redux only when it is genuinely cross-page.
- Query keys include the signed-in Clerk user ID and all resource parameters.
- `POST /theory/session/start` and `POST /theory/session/:id/answer` require an `Idempotency-Key`. A retry of the same request must reuse its key; a new user action gets a new key.
- Topic mode submits a topic ID and difficulty. Weak mode asks the server to select weak topics when its question endpoint is read. The UI displays the existing weak-area endpoint response as context, not as a promise of the exact topics/questions selected.
- The user's backend role determines the default requested question count: 10 for a free account and 30 for premium/admin, matching current defaults. The server remains authoritative for configured limits and daily quotas.
- The question endpoint can return fewer questions than requested. The flow must handle an empty result and a short result without inventing questions.
- A skipped question is advanced locally and is not submitted as an empty answer; the API requires non-empty answers. Only submitted answers count toward the session's `questionsAnswered`. The API does not persist the original fetched question set or skips.
- Evaluation is polled only while its saved status is `queued` or `running`. A terminal `failed` result has no score and is shown as unscored with the server failure message.
- A session cannot complete while an evaluation is queued/running. Keep an end request pending until active evaluations reach terminal states, then complete; a retry of completion returns the persisted summary if the session already completed.
- Freeze each submitted request body together with its idempotency key. A retry must reuse both the same key and exact payload, including elapsed seconds.
- The elapsed timer is client-only and resets per question; elapsed seconds are sent with the answer. No unsupported countdown, hints, or remaining-daily-session count is displayed.
- If a learner leaves or refreshes active practice, the history detail view can recover saved answers and continue polling evaluations, but cannot restore unsaved skips or the exact question cursor. In-progress details offer a way to complete saved work once evaluations are terminal; they do not claim to resume the lost question sequence.
- CSV export is labeled as the current page and contains only session summaries returned for that page. Its columns are session ID, start/completion time, mode, topic ID, difficulty, answered/total question counts, average score, and status. It does not imply that session detail answers are included.

## Approaches considered

1. **One combined practice/history page.** Fewer route files, but it couples the live session state machine to pagination and detail navigation, making recovery and tests harder to isolate.
2. **Separate end-to-end slices (selected).** Build the practice route and lifecycle first, then add history list/detail routes and dashboard links. Each slice can be reviewed and verified independently while sharing typed API and query layers.
3. **Practice configuration only, then defer the session lifecycle.** Smaller first patch, but it leaves the visible Practice navigation without its core user task and does not deliver a usable feature.

## Screen and behavior decisions

- Add `/practice`, `/history`, and `/history/:sessionId` under the existing authenticated app shell. Practice and History navigation become active routes; page titles and active navigation follow the current shell patterns.
- The practice configuration offers Topic Practice and Weak Areas. Keep PDF Study visibly unavailable until Phase 4 rather than presenting a fake working mode.
- Topic selection, difficulty selection, the role-based question count, and the start summary follow the HTML prototype. Weak-area context is loaded from the API and has its own retry and empty states.
- The live session view presents one returned question, a labeled answer field, elapsed time, question progress, skip, submit, and end controls. A submitted answer remains locked while its evaluation is pending. Completed feedback includes the returned score and text; failed evaluation is clearly unscored and can be continued.
- End-session completion waits for active evaluations to reach terminal states, then calls the complete endpoint. If every fetched question was skipped, completing with zero answers is valid. The completion view uses saved answer statuses to distinguish no scored answers from a score of zero.
- History supports server pagination, inline expandable answers, and a shareable detail route. Expanding a session loads its saved detail; both views distinguish queued/running/completed/failed evaluations. Session summaries show the API average without inferring that zero means “unscored”; detail and completion views determine whether an answer received a score. Export covers the current history page and labels that scope.

## Architecture boundaries

- `core/theory`: response and request types.
- `service/api/theory.api.ts`: typed endpoint functions using the existing `ky` client.
- `logic/theory`: user-scoped query keys, readers, mutation commands, and practice/session state transitions.
- `components/practice` and `components/history`: presentation-only components with props in/events out.
- `pages`: route composition and mapping API state to screen states.
- `app` and `core/routes`: authenticated route declarations and route constants.
- `utils`: pure CSV escaping and reusable duration formatting, with focused tests.
- No component or page calls `fetch`, `ky`, or endpoint functions directly.

## Verification

- Unit/component tests cover topic/weak configuration, empty and error states, idempotent submission/retry, polling stop conditions, failed evaluations, skip and end behavior, page boundaries, detail rendering, and CSV escaping.
- Run UI lint, root lint and formatting, TypeScript project build, production build, and the complete UI test suite.
- Exercise the authenticated practice and history flows in a browser at mobile and desktop sizes. Verify retry paths and no overflow, and inspect browser console errors.
- Record any unrelated pre-existing repository gate failures without changing unrelated workspace files.
