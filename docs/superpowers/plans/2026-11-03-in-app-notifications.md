# In-App Notifications Implementation Plan

> **For agentic workers:** Follow TDD for each behavior. Keep the feature inside the existing Notifications module and preserve the public signed email unsubscribe routes.

**Goal:** Add a durable, owner-scoped inbox and create one inbox reminder per opted-in local day.

**Architecture:** Store inbox items in MongoDB with a unique `(userId, idempotencyKey)` index and a daily 90-day retention cleanup. Expose authenticated NestJS routes from NotificationsController. Daily reminder scheduling writes the inbox record independently of email configuration, then separately queues email when configured.

**Tech stack:** NestJS, Prisma MongoDB client, Clerk guards, Vitest, existing database isolation harness.

## Task 1: Mongo model and API schemas

**Files:** `server/prisma/schema.prisma`, notification DTO/schema files, schema specs.

- Add `InAppNotification` with Mongo ObjectId, `userId`, unique idempotency key, category, title, body, optional link, `readAt`, `createdAt`; indexes for owner/time, owner/read/time, and unique owner/key.
- Add validated query schema for `cursor` (ObjectId) and `limit` (default 20, 1..50); validate path IDs as 24-character hex strings.
- Add tests for defaults, bounds, malformed cursors and IDs. Run those specs and Prisma generation; tests must first fail because schemas/model are absent.

## Task 2: Inbox service behavior

**Files:** `notifications.service.ts`, `notifications.service.spec.ts`.

- Add methods `listInAppNotifications(userId, cursor?, limit?)`, `getUnreadCount(userId)`, `markInAppNotificationRead(userId, id)`, `markAllInAppNotificationsRead(userId)`, `deleteInAppNotification(userId, id)`, and `createReminderNotification(userId, localDate)`.
- Scope every operation with `userId`; map absent/foreign records to `NotFoundException`.
- List newest first with `limit + 1` pagination and unread count in the response; return `{ items, nextCursor, unreadCount }`.
- Use deterministic `daily-reminder:<userId>:<localDate>` idempotency key; handle duplicate-key races by loading and returning the existing item.
- Write each behavior test first and verify the expected red failure before implementation.

## Task 3: Authenticated inbox routes

**Files:** `notifications.controller.ts`, `notifications.controller.spec.ts`, route DTOs.

- Preserve public `GET/POST /notifications/unsubscribe` unchanged.
- Protect inbox routes with `ClerkAuthGuard` and obtain identity from `@CurrentUser('id')`.
- Add GET list, GET unread count, PATCH single read, PATCH read-all, and DELETE routes using validated schemas and standard API response shapes.
- Test actor propagation, status/response mapping, malformed inputs, and owner-not-found behavior.

## Task 4: Schedule in-app reminders

**Files:** `notifications.service.ts`, `notifications.service.spec.ts`.

- Persist one inbox reminder for each due opted-in user/local date even when Resend configuration is missing.
- Keep email job enqueueing conditional on the existing complete delivery configuration.
- Isolate per-user failures so one user's database/queue problem does not stop scheduling other users; log failures with user ID.
- Tests cover due/not-due users, email disabled configuration, uniqueness on repeated ticks, and failure isolation.

## Task 5: Isolation integration and docs

**Files:** `server/test/e2e/user-data-isolation.e2e-spec.ts`, `routes/notifications-api-spec.md`, `routes.md`, `docs/architecture/TODO.md`, `docs/backend-status.md`, `docs/WORKLOG.md`.

- Add two-user integration assertions for list/count/read/delete isolation and same-user idempotent reminder creation.
- Clean up notification test documents by owner after the isolation suite.
- Document auth, pagination, response shapes, expiry, and routes. Update trackers from partial to implemented for inbox scope while retaining live email-provider rollout notes.
- Document `pnpm --filter server prisma:push:mongodb` as a deployment prerequisite so the compound idempotency index is present before reminder scheduling begins.

## Task 6: Verification and delivery

- Run `pnpm gate -- --stack server --level full`, `pnpm test:database:isolation`, `pnpm build:viewer:check`, and `git diff --check`.
- Run a fresh code review and fix any important findings.
- Commit with a lowercase conventional subject and push to `origin main`.

## Review focus

- A notification from another user must never be returned or mutated even if the caller knows its Mongo ID.
- Two scheduler ticks or concurrent workers must not duplicate one user's daily reminder.
- Email being unconfigured must not suppress in-app reminders.
- Public unsubscribe confirmation and POST behavior must not become authenticated.
- Daily retention cleanup must remove old items without crossing user ownership filters, and pagination must use stable ordering and safe cursor validation.
