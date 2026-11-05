# Notification inbox UI implementation plan

Spec: `docs/superpowers/specs/2026-11-05-notification-inbox-ui-design.md`
API: `routes/notifications-api-spec.md`
Execution: inline implementation, authorized by the project objective to keep shipping frontend features without approval pauses.

## Global constraints

- Use the current authenticated notification endpoints; do not change the server contract.
- Keep API calls in `service/api`, server state in TanStack Query, and visual components presentational.
- Include `clerkUserId` in notification query keys and only enable reads after Clerk is ready and signed in.
- Invalidate both inbox pages and unread count after successful read, read-all, or delete mutations.
- Test the public header interaction at desktop and mobile widths; preserve unrelated untracked files.

## Review focus

- List pagination appends rows and uses the backend `nextCursor` value.
- Read, read-all, and delete refresh list pages and unread count for only the current user.
- Errors and empty/loading states remain visible without discarding loaded pages.
- Notification destinations accept only same-origin local paths.
- Header bell and popover remain keyboard usable and fit a 320px viewport.

### Task 1: Notification types and API boundary

**Files:** `ui/src/core/notifications/**`, `ui/src/service/api/notifications.api.ts`, API barrel and tests.

- [x] Add types for notification items, cursor pages, unread counts, and mutation envelopes from the existing route contract.
- [x] Write endpoint tests for list cursor/limit, unread count, mark-one, mark-all, and delete.
- [x] Implement typed service functions using the existing `ApiClient` only.
- [x] Run focused API and type checks; verify the first page sends `limit=20` without an empty cursor.

### Task 2: Query readers and mutation commands

**Files:** `ui/src/logic/notifications/**`, logic barrel, matching tests.

- [x] Add notification query-key factories scoped by Clerk user ID.
- [x] Add an infinite list reader gated by signed-in state and popover visibility, plus an unread-count reader.
- [x] Add read, read-all, and delete commands; invalidate the user's inbox and unread-count keys on success.
- [x] Write tests for cursor forwarding, auth gating, cache invalidation, and mutation failures before implementing each behavior.
- [x] Run notification logic tests and `tsc -b`.

### Task 3: Accessible notification popover

**Files:** `ui/src/components/notifications/**`, component tests and barrel.

- [x] Add a presentational bell/popover with accessible unread badge, notification rows, read/delete actions, load-more, and empty/loading/error states.
- [x] Support Escape, trigger focus, outside dismissal, and responsive menu sizing with the existing Base UI primitives.
- [x] Render read state, category fallback, timestamps, and only safe same-origin paths as destinations.
- [x] Write DOM tests for open/close, unread count, empty/error/loading, actions, load-more, keyboard behavior, and unsafe links.

### Task 4: Authenticated app-shell integration

**Files:** `ui/src/pages/NotificationCenter.tsx`, `AuthenticatedLayoutPage.tsx`, `AppShell.tsx`, AppShell props/tests.

- [x] Compose the readers and commands in a page-layer `NotificationCenter` widget.
- [x] Add an optional app-shell header-actions slot and place the notification center beside theme/account controls.
- [x] Verify signed-out routes do not mount notification queries and existing header/sidebar behavior remains unchanged.
- [x] Add integration tests proving successful actions refresh the badge and preserve loaded list rows during next-page fetch.

### Task 5: Tracker and release record

**Files:** `docs/project-tracker.md`, `docs/WORKLOG.md`, this plan.

- [x] Mark the notification dropdown/inbox and synchronized unread-count criteria complete only after verification.
- [x] Fix the stale notifications API link in the tracker to point to `routes/notifications-api-spec.md`.
- [x] Record exact UI test counts and verification limitations.

### Task 6: Verification, review, and delivery

- [x] Run the complete UI mechanical gate and required visual/browser checks.
- [x] Run the frontend architect and correctness review; resolve findings with regression tests first.
- [ ] Stage only feature files, inspect the staged diff, commit with a Conventional Commit, and push to `origin main`.

## Self-review

- Contract requirements are covered in Tasks 1–4; no backend changes are planned.
- Error classes include list failure, unread-count failure, and mutation failure; each has explicit visible UI and retry or a safe next action. A failed initial list request no longer renders the successful empty state.
- Following an unread notification waits for the mark-read mutation before navigation; failed mutations keep the user in the inbox and show the error.
- Closed-domain categories remain strings because the server stores arbitrary category values; the UI uses a safe generic icon for unknown values.
- Pagination uses `useInfiniteQuery`; cursor is a page parameter rather than part of the base list key.
- Each visual action and API boundary has DOM or service coverage. Browser verification covers popover placement and mobile width.
