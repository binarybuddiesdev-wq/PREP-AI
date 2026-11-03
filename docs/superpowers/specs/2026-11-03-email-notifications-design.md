# Opt-in Daily Study Reminder Emails

## Intent

Give users an optional daily email reminder to return to interview practice.
The existing `UserSettings.notifications` JSON and `email-queue` policy provide
starting points, but there is no scheduler or email worker.

## Goals

- Let an authenticated user opt in, choose a local reminder time, and select an
  IANA time zone.
- Queue at most one reminder per user-local calendar day.
- Send through the existing Resend dependency in a BullMQ worker with retries.
- Recheck opt-in state at delivery time so disabling reminders prevents a
  queued email from being sent.
- Use a deterministic Resend idempotency key and a fixed in-code template.

## Non-goals

- In-app notifications, marketing campaigns, welcome mail, payment notices,
  arbitrary client-authored email, or WebSockets.
- Sending unless the user has explicitly enabled the daily reminder.
- Building UI in this backend change.

## Approaches considered

1. **Generic email queue only.** Adds a worker but has no safe product event or
   user-facing trigger. Deferred because queued arbitrary email would be an
   unfinished capability.
2. **Opt-in daily study reminders.** Uses the existing settings API, Resend,
   BullMQ retries, and a minute scheduler. Selected because the architecture
   TODO already names daily reminders and the opt-in boundary is explicit.
3. **Full notification center plus email.** Adds in-app storage, read/unread
   APIs, delivery preferences, schedules, and UI integration. Deferred because
   it is a separate larger product surface.

## Decisions

- Add nullable typed reminder fields to `UserSettings`: enabled, local send
  time, and IANA timezone. The settings service normalizes missing legacy or
  new-record values to disabled, `19:00`, and `UTC`; preserve the existing JSON
  notifications field for compatibility with other settings.
- Extend the existing authenticated settings update contract to validate and
  return the reminder preferences. Invalid time zones or times return 400.
- A scheduler scans opted-in settings once per minute, compares local time,
  and enqueues a deterministic per-user/per-local-date job. BullMQ deduplicates
  concurrent scheduler instances.
- The worker reloads user and preference state immediately before delivery.
  Disabled or deleted users complete as skipped. Email content is fixed and
  contains no progress or sensitive account data.
- Use Resend's idempotency key `daily-reminder:<user-id>:<local-date>`. Do not
  enqueue when `RESEND_API_KEY` is absent; report the queue as unavailable and
  document the required key. Keep application startup viable without the key.
- Email includes a preferences URL built from configured `UI_BASE_URL`; user
  can disable reminders through authenticated settings. Signed public
  unsubscribe links and in-app notifications are follow-up work only if the
  settings link does not satisfy the product's unsubscribe requirements.

## Constraints and risks

- MongoDB remains authoritative for users and settings. Jobs carry only user
  identity and local date; the worker reloads recipient and preferences.
- Scheduler work is bounded per tick and errors must not stop later ticks.
- Preference updates are last-write-wins. A delivery already accepted by
  Resend cannot be recalled if the user disables reminders at the same instant.
- Resend behavior is mocked in tests; a live delivery requires a configured
  API key and a verified sender domain.

## Open implementation details

- Pick a stable fixed email subject and body.
- Use the installed Resend SDK and current BullMQ queue conventions.
- Document setup, opt-in behavior, retry policy, and the live provider
  prerequisites.
