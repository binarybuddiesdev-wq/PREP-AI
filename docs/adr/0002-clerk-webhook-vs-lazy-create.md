# ADR-0002: Clerk webhook (not lazy create) for user provisioning

## Status
Accepted, 2026-08-29

## Context

When a user signs up via Clerk, we need a corresponding `User` document in
MongoDB before they hit any protected API endpoint. Two patterns exist:

1. **Lazy create** — on first authenticated request, look up the user by
   `clerkUserId`; if not found, create from the JWT claims.
2. **Webhook-driven** — Clerk POSTs `user.created` to a webhook endpoint we
   host; we verify the Svix signature, then upsert.

## Decision

We will use **webhook-driven** provisioning via `POST /webhooks/clerk`,
handling `user.created`, `user.updated`, and `user.deleted`.

The webhook handler:
- Verifies the Svix signature (svix-id, svix-timestamp, svix-signature)
- Rejects requests with timestamps outside ±5 minutes (replay protection)
- Idempotently upserts the User document
- Returns 200 within 5s (Clerk's retry window)

## Consequences

**Easier:**
- First protected request is fast — User document already exists
- No "user not found → create" branch in every protected controller
- Deletion is consistent — `user.deleted` webhook removes the User and
  cascades to `UserSettings` in the same handler
- Clerk handles retries on non-2xx

**Harder:**
- New endpoint to secure (signature verification, replay protection, rate
  limit on the public route)
- Brief window between signup and webhook delivery where a user can sign in
  but their User doc doesn't exist yet (we accept this; frontend shows
  "setting up your account" for ~1s)
- Webhook secret rotation needs deploy coordination
- Need an idempotency strategy: if Clerk retries, we must not double-insert
  (we use `upsert` keyed on `clerkUserId`)

## Alternatives considered

- **Lazy create.** Rejected: every protected endpoint needs a fallback path;
  first request is slow; tests are harder to write (always need to mock the
  "not found" case).
- **Clerk SDK on backend, sync from JWT on every request.** Rejected:
  expensive (Clerk API call per request), and Clerk's user-update events
  would still need a webhook to reach our DB.

## References

- [Clerk docs: Webhooks](https://clerk.com/docs/integrations/webhooks)
- `routes/webhooks-api-spec.md`
- `Decisions/DECISIONS-2.md` §"Clerk Webhook Strategy"
- `docs/architecture/diagrams/seq-01-auth-webhook.mmd`
