# Notifications API

Base URL: `http://localhost:3000/api/v1`

## In-app notification inbox

These routes require a valid Clerk bearer token. Items belong to the signed-in
user; a known notification ID never grants access to another user's item.

| Method   | Route                                 | Behavior                                                                         |
| -------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| `GET`    | `/notifications?cursor=<id>&limit=20` | Newest-first page and unread count. `limit` defaults to 20 and is capped at 50.  |
| `GET`    | `/notifications/unread-count`         | Returns `{ "data": { "count": 2 } }`.                                            |
| `PATCH`  | `/notifications/:id/read`             | Marks one owned item read.                                                       |
| `PATCH`  | `/notifications/read-all`             | Marks all owned unread items read.                                               |
| `DELETE` | `/notifications/:id`                  | Deletes one owned item; repeating a delete succeeds without revealing ownership. |

The list response is `{ "message": "Notifications retrieved successfully", "data": { "items": [], "nextCursor": null, "unreadCount": 0 } }`.
Pass `nextCursor` as `cursor` for the next page. IDs and cursors must be valid
Mongo ObjectIds. Invalid cursors return 400; missing or foreign notification
IDs return the same 404 response when reading. Deleting a missing or foreign
notification succeeds, making retries safe without revealing ownership.
In-app reminders are stored independently of email-provider configuration.
Daily cleanup removes items older than 90 days.

Before deploying the inbox or enabling the reminder scheduler, apply the Mongo
schema to the target database so the per-user idempotency index exists:

```bash
pnpm --filter server prisma:push:mongodb
```

Run this with `DATABASE_URL` set to the intended MongoDB database. Schedule
creation relies on the compound unique index to prevent duplicates when ticks
overlap.

Daily reminders create one in-app item per user and local calendar date. Its
stable unique key prevents duplicate items when scheduler ticks overlap. Items
use category `reminder`, title `A little practice goes a long way`, and link
`/dashboard`.

## Daily reminder preferences

Update the authenticated user's settings through `PATCH /users/settings`.
Daily reminders are disabled by default. Opt in using:

```json
{
  "notifications": {
    "email": true,
    "dailyReminder": true,
    "dailyReminderTime": "19:00",
    "timezone": "Asia/Kolkata"
  }
}
```

`dailyReminderTime` uses 24-hour `HH:mm`; `timezone` must be an IANA timezone.
The server returns 400 for invalid values. Disable reminders by setting
`dailyReminder` to `false` (or `email` to `false`). The response includes the
normalized fields `dailyReminderEnabled`, `dailyReminderTime`, and `timezone`.

## Unsubscribe

The email includes a signed `List-Unsubscribe` URL. A browser `GET` displays a
confirmation page and does not change preferences, so link scanners cannot
unsubscribe the user automatically. A `POST` to the same URL disables only
daily study reminders. This endpoint does not require Clerk authentication;
the signed token authorizes the opt-out and reveals no recipient address.

```http
POST /notifications/unsubscribe?token=<signed-token>
```

## Delivery requirements

Scheduling and sending activate only when all of these are configured:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` from a verified Resend sender/domain
- `EMAIL_UNSUBSCRIBE_SECRET` with at least 32 random characters
- `API_BASE_URL` set to the externally reachable API origin

Without these values the API starts normally and the email worker stays
disabled. Jobs use `email-queue`, five exponential-backoff attempts, and a
per-user/local-date idempotency key. The worker reloads user and reminder
preferences immediately before sending. Provider failures are retried; raw
provider details are not returned to users.
