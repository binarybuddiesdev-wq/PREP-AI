# PrepAI end-to-end feature checklist

This is the browser QA source of truth for checking user-visible PrepAI flows from start to finish. It maps the shipped UI to its expected behavior and lists the prerequisites for flows that could not be exercised in the last signed-in browser pass.

This checklist is not evidence that a feature works. Record a result for every scenario as **Pass**, **Fail**, **Blocked**, or **Not run**, with the date, environment, account, and evidence. A blocked or unrun scenario must never be reported as passed. Automated unit and API tests do not replace the signed-in browser checks below. The latest manual browser evidence is in [browser-run-2026-11-08.md](browser-run-2026-11-08.md); the earlier repeat-after-fix pass is in [browser-run-2026-11-07.md](browser-run-2026-11-07.md). The whole checklist remains incomplete.

## Current verification baseline

The 2026-11-08 pass opened Dashboard, Practice, Coding, History, Settings, Settings → Documents, and Library, and confirmed the 404 route. All nine requested PDFs reached Ready; the React viewer opened and changed pages; a PDF Study session produced 10 cited questions. A hidden-tab polling issue was fixed and covered by a UI integration regression test. The live question card could not be rechecked after Vite hot reload reset the session, and the account's daily practice quota is now exhausted. Prior verified upload/delete and Study Chat flows are recorded in the 2026-11-07 run report. See both run reports; many scenarios remain blocked or untested.

| Area                                               | What was checked in the current manual run                                                                                                              | Status                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Authenticated routes                               | Sidebar navigation among Dashboard, Practice, Coding, History, Settings and Library; each URL and visible screen changed                                | Partial pass; back/forward and every direct reload not covered                                      |
| Dashboard                                          | Profile/activity/stats, empty states, quick-action content                                                                                              | Partial; failure isolation and every action not covered                                             |
| Practice                                           | Setup modes/topics, query-selected React topic, daily limit message, no-ready-PDF state                                                                 | Blocked for active session and completion by account daily quota                                    |
| Coding                                             | Catalogue/detail, actual Run and Submit outcomes, review response, language selector, coding history; corrected balanced-parentheses examples rechecked | Partial; no passing solution in this pass and all edge cases not covered                            |
| History                                            | Practice and coding tabs; one practice detail expansion; practice CSV action                                                                            | Partial; export contents, pagination and deep links remain unverified                               |
| Settings                                           | All tabs rendered; plan usage and disabled danger actions                                                                                               | Partial; save/persistence, billing transaction and destructive workflows not tested                 |
| Library/PDF                                        | Official RFC 8259 upload, indexing to Ready, viewer deep link/page/zoom navigation, fetch count, delete cancel/confirm                                  | Partial pass after fixes; other document types, privacy, PDF practice and citations remain untested |
| Study Chat                                         | Normal question, provider fallback after empty primary response, reload/list persistence, cleanup                                                       | Partial pass after fix; multi-turn, limits, safety and PDF grounding remain untested                |
| Search/theme/notifications                         | Search result navigation, dark/light toggle, empty inbox                                                                                                | Partial                                                                                             |
| Authentication/onboarding/responsive/accessibility | Sign-in skipped by user request; other flows not tested                                                                                                 | Not run                                                                                             |
| Browser findings                                   | PDF upload, chat fallback, contradictory question content, PDF reindex/embedding and viewer refetch defects recorded                                    | Fixed and rechecked in observed flows; complete checklist still has blocked and not-run scenarios   |

## Test environment and data

Use a non-production environment and a disposable signed-in account. Preserve the user's normal account and data. Before running a scenario, record the UI build/commit, API URL, browser/viewport, account role/plan, and whether background workers and Piston are available.

Prepare these fixtures where the flow needs them:

- A fresh Clerk test user for sign-up/onboarding and an existing user for returning-user behavior. Use a second account for ownership/isolation checks.
- An account with available practice, coding, AI review, and AI-token quotas. For quota-bound checks, use an approved test configuration or wait for reset; do not silently reset or bypass the production quota.
- A small, valid, selectable-text PDF under 10 MB and 400 pages, with known content on multiple pages. Add separate invalid fixtures: a non-PDF, corrupt PDF, encrypted PDF, scanned/image-only PDF, file over 10 MB, and PDF over 400 pages.
- A coding problem with known expected examples, plus working solutions for each advertised language (JavaScript, TypeScript, Python) and deliberately failing/invalid solutions.
- Test-mode credentials for Clerk, NVIDIA/Groq, Cloudinary, Razorpay, email, and Piston only where that scenario needs them. Missing credentials mean **Blocked**, not Pass.

Remove test-created conversations, PDFs, and sessions when safe. Keep evidence free of secrets and private PDF contents.

## A. Public entry, authentication, and route guards

- [ ] **A1 Landing page:** open `/`; verify hero, navigation, feature sections, responsive layout, and footer links. Follow sign-in/sign-up calls to action and verify their destinations.
- [ ] **A2 Sign up:** create a disposable Clerk account; cover valid email/password or supported Clerk sign-up method, invalid input, existing account, verification/confirmation, provider cancellation, and recovery from a failed Clerk request.
- [ ] **A3 Sign in:** sign in, reload, open a new tab, and verify the Clerk session persists. Cover invalid credentials, cancellation, expired session, and sign-out.
- [ ] **A4 Redirects:** unauthenticated access to every protected route redirects to sign-in; after sign-in, a safe internal return path is restored. External or malformed return URLs must not become open redirects.
- [ ] **A5 Returning user:** existing completed user lands on Dashboard; a new/incomplete user is directed through onboarding. Authenticated users visiting public auth pages are handled consistently.
- [ ] **A6 Profile synchronization:** first authenticated request creates/synchronizes the backend profile; retry on transient API failure; verify useful error UI and no broken blank screen.
- [ ] **A7 Not-found route:** unknown URL reaches the intended not-found/redirect behavior without rendering stale page content.

## B. First-run onboarding

- [ ] **B1 Step 1 — Role and experience:** select valid values, continue, and verify they persist after refresh/navigation. Required-field validation prevents invalid progression.
- [ ] **B2 Step 2 — Target companies:** add/select and remove companies, continue, and verify saved values after returning to the step.
- [ ] **B3 Step 3 — Topics and difficulty:** select and deselect preferred topics and difficulty; verify selected state and saved preferences.
- [ ] **B4 Back/forward:** move between steps; previous selections remain intact and step indicators are accurate.
- [ ] **B5 Skip/finish:** skip setup and finish setup; both complete the backend setup state and navigate to Dashboard exactly once.
- [ ] **B6 Save errors:** simulate failed save/setup completion; show actionable error, preserve the draft, allow retry, and prevent duplicate submissions.
- [ ] **B7 Reload/resume:** reload midway through onboarding and verify the saved step/draft resumes according to the backend contract.

## C. Shared authenticated shell

- [ ] **C1 Sidebar routes:** click every nav item and verify both URL and visible page change; back/forward and direct route reload also render the correct page.
- [ ] **C2 Sidebar controls:** collapse/expand desktop navigation; open/close mobile drawer; Escape closes it; focus returns to the trigger; navigation closes the drawer.
- [ ] **C3 Responsive layout:** inspect supported desktop, tablet, and mobile widths; no clipped controls, unintended horizontal scroll, inaccessible drawers, or overlapping dialogs.
- [ ] **C4 Theme:** toggle light/dark, navigate and reload, and verify the chosen theme remains consistent and readable.
- [ ] **C5 User menu:** open account controls, verify identity, sign out, and verify protected routes are no longer accessible.
- [ ] **C6 Global loading/errors:** delay or fail API calls; loading states remain understandable, errors identify the failed feature, retry works, and unrelated panels stay usable.
- [ ] **C7 Accessibility basics:** keyboard-only navigation, visible focus, semantic labels/roles, dialog focus behavior, no keyboard traps, and usable zoom/text scaling.

## D. Global search and notifications

- [ ] **D1 Search open/close:** open search by its visible control and keyboard shortcut if present; close with Escape and restore focus.
- [ ] **D2 Search results:** search the implemented destinations (app pages and practice topics); validate loading, empty, error/retry, keyboard selection, and navigation to the correct target. Coding-problem and session records are not currently search result types.
- [ ] **D3 Search input:** clear query, type quickly, and verify stale results do not replace newer results.
- [ ] **D4 Notification inbox:** open/close popover; unread badge/count matches list; cover loading, empty state, retry, and pagination/load-more.
- [ ] **D5 Notification actions:** mark one read, mark all read, delete, and open a notification. Confirm read state/count and destination; cover action failures and retry.

## E. Dashboard

- [ ] **E1 Summary:** verify greeting/profile, practice and coding counts, scores/trends, weak areas, and recent activity agree with their API data.
- [ ] **E2 Quick actions:** New Session and dashboard topic/problem cards navigate to the intended practice or coding flow.
- [ ] **E3 Empty/new user:** show useful onboarding/empty progress states with no fake statistics.
- [ ] **E4 Partial failure:** independently fail profile, settings, topics, coding catalogue, sessions, weak areas, and score trend; verify only the affected panel displays an error and its retry recovers.
- [ ] **E5 Refresh consistency:** reload and revisit; no previous route remains visible under a changed URL and no duplicate data/actions appear.

## F. Theory practice

Practice has Topic, Weak Areas, and PDF modes, difficulty selection, question count subject to plan limits, and session/daily usage limits.

- [ ] **F1 Topic setup:** choose topic, difficulty, and session length; verify plan cap and daily-usage messaging; start a topic session with an account that has quota.
- [ ] **F2 Weak-area setup:** with prior scored answers, verify weak topics populate and start uses the expected topics. Cover no weak areas and loading/error/retry states.
- [ ] **F3 PDF setup:** choose one and multiple ready PDFs (up to the current five-source limit), deselect them, and start a PDF session. Verify no-ready-source and invalid-selection states link to Documents/Library appropriately.
- [ ] **F4 Question lifecycle:** load question, enter answer, edit answer, submit once, verify answer freezes, and verify evaluation/status eventually appears with useful content and correct progress.
- [ ] **F5 Evaluation failure:** failed/queued/running evaluation states are understandable; retry refreshes the same answer and does not create duplicate answers or consume duplicate quota.
- [ ] **F6 Skip/end/continue:** skip a question, continue after feedback, end early, and verify answer/question counts and session completion state.
- [ ] **F7 Completion:** finish all questions; verify summary/score, completed history record, and dashboard metrics update. Practice again and Go to Dashboard work.
- [ ] **F8 Same-topic restart:** restart from feedback, ensure it creates a new session once and handles duplicate clicks/timeouts safely.
- [ ] **F9 Session recovery:** reload during question, evaluation, and completion; resume or show a recoverable state without losing committed answers.
- [ ] **F10 Quotas:** below-limit start succeeds; at-limit UI is disabled with correct explanation; backend rejects direct/duplicate attempts consistently. Never bypass real quotas to claim coverage.
- [ ] **F11 Topic bank:** verify realistic, unique questions are served across repeated sessions; confirm the same account is not repeatedly assigned already-exposed questions until the rotation policy allows it.

## G. Coding practice

- [ ] **G1 Catalogue:** load, filter by topic and difficulty together, clear filters, open a problem, and verify empty/loading/error/retry states.
- [ ] **G2 Direct detail links:** open by ID and slug, reload, use Back to problems, and test unknown/removed problem handling.
- [ ] **G3 Editor:** switch JavaScript/TypeScript/Python; edits remain language-specific; reset restores the correct starter; resize/collapse/fullscreen controls behave at supported viewports.
- [ ] **G4 Inputs and examples:** inspect rendered examples and structured input arguments; edit all supported input shapes (arrays, nested arrays, strings, numbers, booleans, empty values) and verify formatting.
- [ ] **G5 Run:** execute known-passing and known-failing code. Confirm actual outputs per test, completion polling, language/runtime errors, timeout/resource failure, and no indefinite "Run queued" state.
- [ ] **G6 Submit:** submit a passing and failing solution; distinguish run from submit, show verdict and progress, and verify completion/history/stats update exactly once.
- [ ] **G7 Retry/idempotency:** simulate network loss after accepting an execution; retry the same operation safely without duplicate execution/submission.
- [ ] **G8 AI review:** request review for an accepted submission, poll until result, display structured feedback, and cover quota reached, provider failure, unsafe prompt/code, retry, and duplicate click.
- [ ] **G9 Coding history:** open coding tab, expand detail, review submission/execution result, paginate, export current page, and verify empty/error/retry states.
- [ ] **G10 Question quality:** for seeded and generated questions, verify unique scenario, clear constraints, correct examples, working reference outputs, and supported-language starter signatures. Invalid generated reference code must never be exposed as a trusted solution or persisted as validated content.

## H. History and exports

- [ ] **H1 Practice tab:** verify rows, statuses, dates, score/duration; expand/collapse details; retry detail; paginate; open session detail route.
- [ ] **H2 Coding tab:** repeat history checks for coding sessions and their submissions.
- [ ] **H3 Empty/error/loading:** cover no history, API failure/retry, and page changes while an item is expanded.
- [ ] **H4 CSV exports:** export each history type; validate header, values, escaping of commas/quotes/newlines, current page scope, and a sensible empty export.
- [ ] **H5 Detail reload:** direct-load or reload a practice detail URL and verify authorization, data, and missing-session behavior.

## I. PDFs, Library, and PDF-based questions

These flows were **not exercised** in the previous browser pass. Test the entire lifecycle, not only the empty Library page.

- [ ] **I1 Upload methods:** upload a valid selectable-text PDF by file picker and drag/drop. Verify progress, accepted response, one document per upload, idempotent retry, and list refresh.
- [ ] **I2 Validation:** test non-PDF, corrupt, encrypted, scanned/image-only, >10 MB, >100-page, empty, and duplicate files. Show accurate errors and do not leave phantom records or assets.
- [ ] **I3 Ingestion lifecycle:** observe queued → processing → ready; verify page count, source status, extracted text/chunks, embedding/index readiness, and persistence after reload.
- [ ] **I4 Ingestion failures:** force storage/provider/parser/worker failure; verify failed status and useful cause, retry/reindex behavior, and no stale partial content.
- [ ] **I5 Reindex:** reindex a ready PDF and a failed PDF; verify requested revision/status, old ready revision behavior during failure, and updated content after success.
- [ ] **I6 Delete:** cancel delete confirmation; confirm deletion; verify it leaves Library, can no longer be selected or retrieved, and private Cloudinary/content data is revoked after async cleanup.
- [ ] **I7 Library viewer:** open a ready PDF, view its pages, navigate pages, refresh/deep-link `pdfId` and `page`, return to list, switch PDFs, and handle missing/failed content plus retry.
- [ ] **I8 Ownership:** as a second user, attempt to list, view, download, reindex, or delete the first user's PDF. Requests must be denied without disclosing document metadata/content.
- [ ] **I9 PDF practice selection:** select one/multiple ready PDFs in Practice, deselect, start, and verify generated questions come from the selected sources and show valid page citations.
- [ ] **I10 PDF question preparation:** wait for async generation; verify queued/running/ready/failure UI, retry, end-session escape path, grounded question/answer quality, and citation opens the correct source page.
- [ ] **I11 AI source preferences:** in Settings → AI & Sources, enable/disable ready PDFs; verify unavailable sources cannot be enabled and preferences affect the intended AI retrieval flows.

## J. Study Chat (the in-app chatbot)

The visible chatbot is the Study Chat widget in the authenticated shell. The backend-only Tech Expert API is listed separately below; do not assume it has a user-facing page.

- [ ] **J1 Launcher/panel:** open and close the widget from every authenticated route; verify focus, mobile sizing, fullscreen, and theme.
- [ ] **J2 First conversation:** start a new conversation, send a normal question, wait for assistant response, and verify title/turn count/transcript.
- [ ] **J3 Persistence:** navigate away/reload, reopen the chat, load conversation list, select prior conversation, and load older conversations through pagination.
- [ ] **J4 Multi-turn:** send follow-up messages; verify ordering, context continuity, user/assistant rendering, and input length boundary (4,000 characters).
- [ ] **J5 Send reliability:** prevent blank/overlong send; cover pending state, double click, network failure, retry of failed idempotent send, and error dismissal.
- [ ] **J6 Limits and safety:** reach turn/token quota, submit prompt-injection or unsafe content, and verify explicit safe response/error without losing prior messages.
- [ ] **J7 Delete:** cancel delete, confirm delete, verify removed conversation disappears and cannot be reopened.
- [ ] **J8 PDF grounding:** with enabled PDF sources, ask a question answerable from known document text; verify retrieved answer is grounded and citations (if presented) point to the right page. Repeat with sources disabled and with no matching source.

## K. Settings and account preferences

- [ ] **K1 Profile:** edit target role, experience, target companies, save, reload, and verify backend values. Cover unchanged form, invalid values, concurrent save/double click, and save failure/retry.
- [ ] **K2 Notifications:** update daily reminder preferences and supported schedule/timezone options; save and verify persistence. Test unsubscribe route separately if it is exposed to the user.
- [ ] **K3 Practice Preferences:** change preferred topics/difficulty/session length/timer, save, then verify Practice setup uses those defaults and still respects plan limits.
- [ ] **K4 AI & Sources:** toggle ready PDF sources, save, reload, and verify retrieval settings persist. Test loading/error/no-source states.
- [ ] **K5 Documents:** test upload, status, open, reindex, delete, and retry here as well as Library; confirm both screens stay consistent.
- [ ] **K6 Plan:** load current plan, practice/coding usage, and current subscription; cover loading/error/retry and free-plan state.
- [ ] **K7 Checkout:** in Razorpay test mode, create monthly and yearly subscription; verify server-priced plan, redirect/checkout, cancellation, return path, and duplicate click/idempotency.
- [ ] **K8 Cancellation:** schedule end-of-period cancellation, verify status/period/Premium access, and ensure cancellation does not revoke access early. Verify cancel errors/retry.
- [ ] **K9 Danger Zone:** verify Reset All Progress, Delete Account, and Export All Data are visibly disabled with their unavailable explanation. Do not invent an action flow; record these actions as not implemented in the current UI.
- [ ] **K10 User menu/sign-out:** verify sign-out clears access and returning through browser history does not reveal cached private data.

## L. Backend-integrated outcomes visible to users

The browser should validate the user-visible result; use API/integration tests for internals that cannot be observed in the UI.

- [ ] **L1 Provider failure:** make NVIDIA unavailable and verify configured fallback behavior for supported AI workflows; then make all providers unavailable and verify clear errors and retry without duplicate work.
- [ ] **L2 Background jobs:** verify queued work reaches a terminal state or a retryable error: PDF indexing/questions, theory evaluation, coding execution/review, payment reconciliation, notifications.
- [ ] **L3 Quotas:** test practice sessions, AI tokens, coding reviews, and question-bank daily refill limits with controlled test accounts/configuration; verify correct UI messaging and server enforcement.
- [ ] **L4 Persistence/recovery:** restart only disposable test workers during queued work; verify jobs recover or show a retryable state and do not duplicate user-visible records.
- [ ] **L5 Service outage:** temporarily stop one dependency only in an isolated test environment; verify affected UI reports the real dependency problem and recovers when service returns.
- [ ] **L6 Privacy:** verify user-owned profile, conversations, sessions, PDFs, and billing data never appear in another account's UI or exports.

## M. Backend-only or no current user-facing UI

These are not to be counted as browser UI failures when no UI exists. They still require their own API/integration/operations coverage.

- Admin-only topic/question CRUD and fingerprint uniqueness management.
- Clerk and Razorpay webhook signature validation, deduplication, and replay.
- Admin charge/refund operations and payment ledger retention.
- Public Tech Expert API (`POST /api/v1/tech-expert` and `/stream`) unless a UI entry point is added.
- Internal MongoDB/PostgreSQL schema, RLS policies, migration/backup/restore, Redis counters, BullMQ lease/retry internals, and metrics endpoint.
- Deployment-only provider dashboards, secret rotation, production observability/alerts, and production PDF OCR (OCR is not supported by the current PDF flow).

Do not skip their automated API/integration/security checks just because they are outside browser QA.

## N. Close-out rules

1. Run each applicable checkbox with a real browser and the UI visible. A screenshot or short recording is required for failures and blocked states; capture a trace/network log when useful, with tokens and private content redacted.
2. For each result, record **Pass / Fail / Blocked / Not run**, the exact scenario ID, browser/viewport, account role/plan, date, and evidence link.
3. File every discovered defect with steps to reproduce, expected vs actual behavior, console/network evidence, and severity. Add a regression scenario to the appropriate UI E2E suite for every reproducible browser defect or newly discovered critical path.
4. After fixes, rerun the failing scenario, its related flow, route navigation/reload, and the complete applicable checklist. Do not state "everything is done" while any required row is Blocked, Fail, or Not run.
5. Keep backend-only checks in their appropriate API/unit/integration/security suites; browser E2E should assert their user-visible outcomes, not database implementation details.

## Code references

- UI route map: `ui/src/app/AppRoutes.tsx`, `ui/src/core/routes.ts`
- UI workflow/API hooks: `ui/src/logic/`, `ui/src/service/api/`
- Feature screens: `ui/src/pages/`, feature UI: `ui/src/components/`
- Backend route handlers: `server/src/modules/*/*.controller.ts`
- Current project work tracker: `docs/architecture/TODO.md`
- Backend implementation status: `docs/backend-status.md`
- Prior browser observations: `docs/testing/browser-e2e-report.md`
