# Backend data isolation policy

## Intent

Define and verify how PrepAI separates one user’s data from another’s across
the NestJS API and its MongoDB/PostgreSQL stores.

## Policy

- The verified Clerk token subject (`payload.sub`), exposed as
  `@CurrentUser('id')`, is the sole user identity for request-scoped operations.
  Never accept a user identity from a request body, query, or resource path.
- Every query over a private record must scope by that identity. For a resource
  addressed by ID, include both its ID and owner in the same `where` clause.
  Updates and deletes must include the owner too.
- Child resources are accessible only through an owned parent, and their query
  must also include the parent ID. Return 404 for missing or foreign records so
  the API does not reveal whether another user owns them.
- User profile/settings data is located by Clerk subject, then settings are
  read or written by that Mongo user’s internal ID. Theory and coding
  PostgreSQL rows store the Clerk subject as `userId`.
- History, counts, trends, weak-area calculations, and quota keys must use the
  same verified caller identity.
- Shared catalog data (topics, questions, coding problems) is not privately
  owned. Authenticated users may read it; only admins may create, update, or
  delete it. Admin user lookup is also explicitly admin-only.
- Clerk webhooks are an external identity-management path and must verify the
  Svix signature before creating, updating, or deleting a user.
- BullMQ workers are trusted internal callers, not user-authenticated HTTP
  routes. Their resource IDs come from persisted queued records. Any session or
  answer mutation that also carries an owner must scope by both resource ID and
  the persisted owner ID.

## Current enforcement choice

For the current single-service deployment, authorization is enforced in the
NestJS guards and service query filters. PostgreSQL row-level security is not
enabled. Do not imply that Prisma’s application filters are database-enforced;
adding RLS requires a separate design for transaction-local identity, pooled
connections, worker access, and integration tests.

## Audited surface

| Surface                                     | Ownership / access rule                                                                                                                                                                                         | Existing verification                                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| User profile, settings, setup               | Current Clerk subject; settings use the resolved Mongo `User.id`. Admin lookup is role-protected.                                                                                                               | `user.controller.spec.ts`, `user.service.spec.ts`, `roles.guard.spec.ts`, `clerk-auth.guard.spec.ts`                                           |
| Theory session create and operations        | Session `userId` is the caller’s Clerk subject. Session reads/writes filter by `{ id, userId }`; answers are read through the owned session and `{ answerId, sessionId }`. Foreign sessions/answers return 404. | `theory.controller.spec.ts`, `theory.service.spec.ts`                                                                                          |
| Theory history and analytics                | Session list, count, weak-area, and score-trend queries filter by caller `userId`.                                                                                                                              | `theory.service.spec.ts` (query arguments are asserted for each aggregate)                                                                     |
| Coding session create and operations        | Session and execution records use caller `userId`; session actions require `{ id, userId }`, and execution reads require `{ id, sessionId, userId }`. Foreign sessions/executions return 404.                   | `coding.controller.spec.ts`, `coding.service.spec.ts`                                                                                          |
| Coding history                              | Both page query and count filter by caller `userId`.                                                                                                                                                            | `coding.service.spec.ts`                                                                                                                       |
| Shared topics/questions and coding problems | Read access is shared among authenticated users; topic/question mutations require ADMIN.                                                                                                                        | Controller specs and route role metadata; generic role enforcement in `roles.guard.spec.ts`                                                    |
| Clerk webhook                               | Signature-verified Clerk events only.                                                                                                                                                                           | `webhook.controller.spec.ts`                                                                                                                   |
| Health and tech expert                      | No user-owned records are exposed or mutated. Health is public; tech expert handles a prompt without exposing another user’s persisted data.                                                                    | `health.controller.spec.ts`, `tech-expert.service.spec.ts`                                                                                     |
| Background workers                          | Jobs operate on persisted execution/answer IDs; session finalization scopes by the persisted owner. These are internal queue consumers, not substitutes for HTTP authorization.                                 | `coding-execution.service.spec.ts`, `coding-execution.worker.spec.ts`, `theory-evaluation.service.spec.ts`, `theory-evaluation.worker.spec.ts` |

## Test limits and follow-up

Unit specs assert the Prisma arguments and verify that foreign resources are
hidden as 404. Because Prisma is mocked, they do not prove database behavior
against a real two-user dataset. Add an integration tier with two real users
before relying on database-level isolation claims or enabling PostgreSQL RLS.

This policy does not replace authentication, role checks, input validation, or
the separate Piston sandboxing requirements.
