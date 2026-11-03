# In-App Notifications Design

## Intent

Give signed-in users a durable notification inbox for study reminders and future backend events. A user can page through recent items, see an unread count, mark one or all items read, and delete an item.

## Goals

- Persist notifications per user, with title, body, category, optional destination, read state, and timestamps.
- Provide authenticated, tenant-scoped list/count/read/delete endpoints.
- Create one in-app reminder for each daily reminder local date, even when the email provider is unavailable.
- Make reminder creation idempotent under retries and concurrent scheduler ticks.
- Preserve user isolation in queries and integration coverage.

## Non-goals

- Realtime delivery, frontend UI, push notifications, notification preferences beyond the existing reminder setting, and general notification fan-out from every product feature.
- Editing or bulk deleting notifications beyond mark-all-read.

## Constraints

- NestJS module boundaries and Clerk `CurrentUser` guard patterns are required.
- MongoDB is the existing store for user-owned profile and settings data; no new PostgreSQL RLS rollout is needed for this inbox.
- Daily email delivery and in-app reminder persistence must be independently available. Email configuration must not gate the inbox item.
- Per-user ownership must be enforced in every read and mutation filter.

## Approaches

1. **MongoDB notification collection (selected):** Matches existing user-owned settings and source metadata, avoids introducing PostgreSQL/RLS migration work, and enables simple owner-scoped queries. Add a unique `(userId, idempotencyKey)` index.
2. PostgreSQL with RLS: aligns with study/session event data, but requires a new table policy, worker access policy, migration ordering, and RLS harness changes for a feature whose current producer is the Mongo-backed reminder scheduler.
3. Store notifications in the existing UserSettings JSON: minimal schema work, but unread pagination, concurrent writes, idempotency, and retention become unreliable.

The selected approach keeps the inbox durable and independently queryable while staying in the existing Mongo ownership boundary.

## API behavior

- `GET /api/v1/notifications?cursor=&limit=` returns newest first, capped at 50, with a `nextCursor` and current unread count.
- `GET /api/v1/notifications/unread-count` returns `{ count }`.
- `PATCH /api/v1/notifications/:id/read` marks the current user's item read; return 404 for missing or another user's item.
- `PATCH /api/v1/notifications/read-all` marks all current user's unread items read and returns the updated count.
- `DELETE /api/v1/notifications/:id` deletes only the current user's item; return 404 when absent or owned by another user.
- All inbox endpoints require Clerk auth; existing signed unsubscribe endpoints remain public and unchanged.

## Reminder integration

When a daily reminder becomes due, enqueue an idempotent inbox notification keyed by user and local date in addition to the existing email job. Notification persistence is not conditional on email configuration. Email remains controlled by the existing sender settings. Use a deterministic unique key so retrying scheduling cannot create duplicate inbox items.

## Decisions left to implementation

- Set a bounded page size default of 20 and maximum of 50.
- Keep records for 90 days through an application cleanup job; this works with the Prisma Mongo connector, which does not model TTL index options.
- Use `reminder` as the initial category, with a fixed title/body and no client-supplied HTML.
- Validate IDs as Mongo ObjectId strings and cursor inputs before querying.

## Acceptance

Unit tests cover validation, pagination, unread counts, owner-only mutations, missing items, idempotency, and reminder/email independence. The database isolation suite proves two users cannot list, count, mutate, or delete each other's notifications. Full server gate passes and API docs/status tracker are updated.
