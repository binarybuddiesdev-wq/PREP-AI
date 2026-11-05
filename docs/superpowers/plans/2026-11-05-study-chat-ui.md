# Study Chat UI Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to execute this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add the persistent, API-backed PrepAI Assistant widget to the authenticated React shell.

**Architecture:** Keep the reference's global floating launcher, compact popup, and fullscreen view. Core types and service functions define the API; user-scoped TanStack Query readers/commands handle cursor pagination, transcript data, idempotency, and cache updates; presentational components stay in `components/studyChat`; `pages/StudyChatWidget` composes data and transient UI state and is mounted once by `AuthenticatedLayoutPage`.

**Tech Stack:** React 19, TypeScript, Vite, React Router, Clerk-aware `ky` API client, TanStack Query, Base UI Dialog, Tailwind CSS, Vitest, Testing Library.

**Spec:** [Study Chat UI Design](../specs/2026-11-05-study-chat-ui-design.md)

## Global Constraints

- Preserve the existing seven-layer architecture in ADR-0009; components receive props and emit events, and pages compose logic hooks.
- Use only `service/api` for requests, gate readers on Clerk readiness and signed-in user ID, scope query keys by user, and keep server data out of Redux/browser storage.
- Create one visible-ASCII idempotency key per distinct create/send action and reuse it with the exact message for retries.
- Inputs are trimmed to 1-4,000 characters; conversations stop at 30 user turns; conversation list uses cursor pagination with a default 20 and maximum 50.
- The API is non-streaming; show a pending state and only render assistant replies returned by the API.
- Do not render returned text as HTML or install new dependencies.
- Preserve light/dark themes, keyboard access, screen-reader names/statuses, reduced-motion behavior, and mobile sizing.

## Review Focus

- Repeated sends after network failure: verify the same message and idempotency key are retried and a new message gets a new key.
- Concurrent transcript edits and 409 responses: verify the active transcript is refreshed and the retry remains available.
- HTTP 429/503 responses: verify the message is retained, provider internals/reset timing are not invented, and retry reuses its key.
- Cursor pagination and deletion: verify loading another page, deleting a non-active item, and deleting the active conversation preserve expected selection.
- A transcript at 30 turns: verify it remains readable and the composer is disabled with a clear new-conversation action.

---

### Task 1: Study Chat contracts and API transport

**Files:**

- Create: `ui/src/core/studyChat/studyChat.types.ts`, `ui/src/core/studyChat/index.ts`
- Modify: `ui/src/core/index.ts`
- Create: `ui/src/service/api/studyChat.api.ts`, `ui/src/service/api/studyChat.api.test.ts`
- Modify: `ui/src/service/api/index.ts`

**Interfaces:**

- `IStudyChatMessage`: `role: 'user' | 'assistant'`, `content`, `createdAt`.
- `IStudyChatConversation`: `id`, `title`, `messages`, `turnCount`, `createdAt`, `updatedAt`.
- `IStudyChatConversationSummary`: conversation metadata without `messages`.
- `IStudyChatConversationListPage`: `items: IStudyChatConversationSummary[]`, `nextCursor: string | null`.
- API functions: `getStudyChatConversations(api, params)`, `getStudyChatConversation(api, id)`, `createStudyChatConversation(api, body, idempotencyKey)`, `sendStudyChatMessage(api, id, body, idempotencyKey)`, `deleteStudyChatConversation(api, id)`.

- [x] Write failing service tests for URL/query encoding, response envelopes, idempotency headers on both POSTs, and DELETE route.
- [x] Run the service tests and confirm they fail because the Study Chat contracts/functions are missing.
- [x] Add core contracts and service functions using the shared `ApiClient`; omit undefined cursors from query parameters.
- [x] Run the service tests and confirm all route, body, header, and response assertions pass.

### Task 2: User-scoped readers, commands, and idempotency behavior

**Files:**

- Create: `ui/src/logic/studyChat/studyChat.keys.ts`, `studyChat.keys.test.ts`
- Create: `ui/src/logic/studyChat/useStudyChatReaders.ts`, `useStudyChatReaders.test.tsx`
- Create: `ui/src/logic/studyChat/useStudyChatCommands.ts`, `useStudyChatCommands.test.tsx`
- Create: `ui/src/logic/studyChat/studyChatError.ts`, `studyChatError.test.ts`
- Modify: `ui/src/logic/studyChat/index.ts`, `ui/src/logic/index.ts`

**Interfaces:**

- `studyChatKeys.conversations(userId)` and `.conversation(userId, conversationId)`.
- `useStudyChatConversationsReader(shouldFetch)` returns the cursor-backed infinite query; `useStudyChatConversationReader(conversationId)` returns one transcript query.
- `useStudyChatCommands()` returns create, send, and delete mutations. Mutation variables include the exact idempotency key for POST operations.
- Successful create/send writes the returned conversation into the user's detail cache and invalidates their conversation list; send also invalidates the detail after 409; delete invalidates the list and removes the deleted detail cache.
- Error presentation maps status 400/404/409/429/503 into safe user-facing messages while retaining the original `Error.message` only when safe and available.

- [x] Write failing tests for user scoping, Clerk gating, cursor arguments, disabled readers, query key separation, command cache updates/invalidation, status mapping, and exact idempotency key forwarding.
- [x] Run the affected logic tests and confirm expected missing-export/behavior failures.
- [x] Implement key factories, readers, commands, status mapping, and cancellation-free retry semantics (retry is an explicit page action using the same mutation variables).
- [x] Run the logic tests and confirm cache, auth, cursor, error, and idempotency behavior passes.

### Task 3: Chat presentation components

**Files:**

- Create under `ui/src/components/studyChat/`: `StudyChatLauncher`, `StudyChatPanel`, `StudyChatTranscript`, `StudyChatMessage`, `StudyChatComposer`, `StudyChatConversationList`, `StudyChatDeleteDialog`, each with sibling `.types.ts` and a colocated test.
- Create: `ui/src/components/studyChat/index.ts`

**Interfaces and behavior:**

- The launcher receives `isOpen` and `onToggle`; the panel receives mode/theme/state and emits close, fullscreen, list, and new-conversation actions.
- Transcript and conversation list receive data, loading/error/empty/pending states, and callbacks; they perform no API work.
- Composer receives draft, disabled state, character limit, sending state, and submit/change callbacks; reject whitespace-only and over-limit messages in the UI.
- Delete dialog uses Base UI Dialog and receives the chosen conversation, pending state, and cancel/confirm callbacks.
- Message text renders as escaped text with preserved line breaks. No simulated assistant messages or streaming.

- [x] Write presentational tests for launcher visibility/labels, transcript message roles, empty/loading/error/retry states, sending announcements, 4,000-character validation, 30-turn composer lock, list pagination, and delete confirmation/cancel.
- [x] Run the component tests and confirm missing component exports/expected semantics fail.
- [x] Implement the components with compact, mobile-safe layouts that follow the HTML reference and app theme; keep each component one file and props in sibling types.
- [x] Run component tests and confirm visible copy, callbacks, validation, and accessibility roles pass.

### Task 4: Widget composition and authenticated shell integration

**Files:**

- Create: `ui/src/pages/StudyChatWidget.tsx`, `StudyChatWidget.test.tsx`
- Modify: `ui/src/pages/AuthenticatedLayoutPage.tsx`, `AuthenticatedLayoutPage.test.tsx`, `ui/src/pages/index.ts`

**Behavior:**

- Mount one widget beside `AppShell` in the protected layout, never on public routes.
- Keep open/fullscreen/list mode, selected conversation, draft, pending failed operation, and delete selection as local component state.
- Load the list when the chat opens/list view is selected; load a transcript only for the selected ID.
- A first send creates a conversation; later sends continue the selected ID. Keep message/key unchanged after failure and expose explicit retry/dismiss; never duplicate an optimistic server message.
- Show quota/provider/conflict/not-found errors and retry controls; preserve drafts and exact idempotency keys.
- Selecting/creating/deleting conversations updates active selection correctly; disable submit at the turn limit and offer a new conversation.
- Preserve compact popup/fullscreen layout, Escape/close behavior, focus return, and responsive sizing.

- [x] Write failing page tests for authenticated mounting, open/close/fullscreen/list transitions, create/select/send/retry/dismiss/delete, pending/error/quota/409/503/turn-limit states, and exact key reuse after retry.
- [x] Run page and shell tests and confirm the widget is absent before integration and behavior failures are reproduced.
- [x] Compose existing logic hooks with components and mount the widget in `AuthenticatedLayoutPage`; keep data fetching out of components.
- [x] Run page and shell tests and confirm the protected widget lifecycle and actions pass.

### Task 5: Verify, document, review, and ship

**Files:**

- Modify: `docs/project-tracker.md`, `docs/WORKLOG.md`
- Review: `ui/src/**`, `routes/study-chat-api-spec.md`

- [x] Run the UI mechanical gate, root lint/format, agent-doc check, scoped Prettier, diff checks, and the UI Playwright tier where its backend/browser prerequisites are available; record unavailable visual/auth checks accurately.
- [x] Run the Impeccable detector on changed UI targets and resolve actionable findings.
- [x] Update Phase 6 and worklog with completed scope and actual verification evidence.
- [x] Run read-only frontend architecture, QA, and correctness reviews; fix any concrete findings and rerun affected checks.
- [ ] Commit only Study Chat files with a lowercase Conventional Commit message and push `main`.
