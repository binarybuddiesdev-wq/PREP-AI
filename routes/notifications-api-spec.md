# Notifications API

Base URL: `http://localhost:3000/api/v1`

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
