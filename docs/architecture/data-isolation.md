# Backend Data Isolation Policy

## Context

PrepAI serves authenticated users from a NestJS API backed by MongoDB and
PostgreSQL. Services share the same application but must not expose one user's
private records to another user. This policy records the existing enforcement
model and the checks that guard it.

## Decision

### Identity and private records

- The verified Clerk token subject (`payload.sub`), exposed as
  `@CurrentUser('id')`, is the only identity for request-scoped operations.
  Do not accept an owner identity from a body, query, or resource path.
- Every private-record query must use that identity. Reads, updates, and
  deletes by record ID must include both record ID and owner in the same
  database predicate.
- Access to a child record must first establish its parent's ownership. The
  child query must also include the parent ID. Missing and foreign records
  return 404 so callers cannot discover another user's record existence.
- Mongo user profile lookup uses the Clerk subject. User settings use the
  internal Mongo `User.id` obtained from that lookup.
- Theory and coding PostgreSQL sessions store the Clerk subject as `userId`.
  Session history, counts, analytics, and quota keys must remain scoped to
  that same caller.

### Shared data, webhooks, and workers

- Topics, questions, and coding problems are shared catalog data. Authenticated
  users can read them; create, update, and delete operations require ADMIN.
  Cross-user admin lookup is ADMIN-only.
- Clerk webhooks may change user records only after Svix signature
  verification.
- BullMQ workers are trusted internal consumers, not HTTP authorization
  substitutes. Job IDs come from persisted records. Mutations that have an
  owner field must use the persisted owner together with the record ID.
- Health endpoints and the public tech-expert flow do not access another
  user's persisted private records.

### Enforcement boundary

Current enforcement is in NestJS guards, role metadata, and service-level
database predicates. PostgreSQL row-level security (RLS) is **not enabled**;
these filters are application-enforced and must not be described as
database-enforced. RLS needs a separate design for transaction-local identity,
pooled connections, worker access, and database integration tests.

## Verification inventory

| Surface                                 | Required checks                                                                                    | Specs                                                                                                                                                                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated routes and admin metadata | Controller guard metadata; ADMIN metadata on cross-user lookup and catalog writes                  | `server/src/modules/user/user.controller.spec.ts`, `topic/topic.controller.spec.ts`, `question/question.controller.spec.ts`, `theory/theory.controller.spec.ts`, `coding/coding.controller.spec.ts`; `server/src/common/guards/clerk-auth.guard.spec.ts`, `roles.guard.spec.ts` |
| Profile and settings                    | Resolve by Clerk subject and use the resolved internal user ID                                     | `server/src/modules/user/user.service.spec.ts`                                                                                                                                                                                                                                  |
| Theory sessions and answers             | Owner on creation and `{id, userId}` access; child access through session; foreign records are 404 | `server/src/modules/theory/theory.service.spec.ts`                                                                                                                                                                                                                              |
| Theory history and analytics            | Caller filter on session list, counts, weak areas, and score trends                                | `server/src/modules/theory/theory.service.spec.ts`                                                                                                                                                                                                                              |
| Coding sessions and executions          | Caller filter on session actions and execution retrieval; foreign records are 404                  | `server/src/modules/coding/coding.service.spec.ts`                                                                                                                                                                                                                              |
| Coding history                          | Caller filter on page query and count                                                              | `server/src/modules/coding/coding.service.spec.ts`                                                                                                                                                                                                                              |
| Clerk webhook                           | Reject invalid signatures before user changes                                                      | `server/src/modules/webhook/webhook.controller.spec.ts`                                                                                                                                                                                                                         |
| Workers                                 | Operate on persisted execution/answer IDs and preserve owner scope when updating sessions          | `server/src/modules/coding/coding-execution.service.spec.ts`, `coding-execution.worker.spec.ts`, `server/src/modules/theory/theory-evaluation.service.spec.ts`, `theory-evaluation.worker.spec.ts`                                                                              |
| Public surfaces                         | No private user records exposed or mutated                                                         | `server/src/modules/health/health.controller.spec.ts`, `server/src/modules/tech-expert/tech-expert.service.spec.ts`                                                                                                                                                             |

Service specs assert Prisma arguments using mocks, and ownership tests exercise
the 404 behavior. They do not prove database semantics against two real users.
Add two-user integration coverage before making stronger isolation claims or
introducing RLS.

## Consequences and open work

- New endpoints and workers must follow this policy and add an ownership test.
- This change verifies and documents existing query filters; it does not add
  PostgreSQL RLS or claim that mocked specs replace database integration tests.
- Add real-database two-user coverage and separately design RLS before a
  deployment requires database-enforced tenant isolation.
