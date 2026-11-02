# Backend Reliability and Session Privacy Design

## Intent

Harden the backend flows identified in the review: Clerk user provisioning under concurrent webhook/profile requests, private theory-session access, and AI evaluation failures. Keep saved scores trustworthy and align the backend documentation with the routes and responses that exist today.

## Decisions

- On a Prisma unique-key race for the same Clerk user, re-read by `clerkUserId` and return the winning row. Re-throw unrelated or unrecoverable database errors.
- Scope every theory-session lookup by both session ID and authenticated user ID. Return 404 for missing and non-owned sessions so callers cannot enumerate session IDs.
- Do not return a reference answer with the question set. Reference answers remain available only to server-side evaluation.
- If both model providers fail or structured output uses its fallback, release the reserved answer slot and return 503. Do not persist a fabricated score. The client can retry the submission; no database migration or response-shape change is needed.
- Prove ownership scoping with service specs that assert Prisma query arguments and not-found behavior. Do not create an integration test tier that needs a shared development database; the existing backend test guidance requires an isolated integration-test design for that.
- Update the route specification, backend README, and backend architecture guidance to reflect the new behavior and current implementation.

## Alternatives and trade-offs

- A fallback score preserves request success but pollutes score history; rejected.
- Nullable score fields plus a pending/retry workflow would preserve the answer, but require a database migration and a new evaluation lifecycle; deferred until the queue design is implemented.
- Returning 403 for another user's record reveals that the session exists; use a scoped lookup and 404.

## Scope

This change does not implement separate coding, payments, PDF/RAG, or notification modules. Those have larger product workflows and remain in the architecture backlog.

## UI impact

No current UI source consumes theory-session questions or answers. The backend keeps the success response shape unchanged; it removes the leaked `referenceAnswer` field and adds a documented 503 error for unavailable evaluation.
