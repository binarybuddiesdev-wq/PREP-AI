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
database-enforced. [ADR-0012](../adr/0012-postgresql-row-level-security.md)
records the decision to adopt RLS before public multi-tenant deployment and
the staged design for transaction-local identity, pooled connections, worker
access, runtime roles, and real-database tests. The ADR does not enable RLS;
all rollout gates must pass first.

## Verification inventory

| Surface                                 | Required checks                                                                                    | Specs                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated routes and admin metadata | Controller guard metadata; ADMIN metadata on cross-user lookup and catalog writes                  | `server/src/modules/user/user.controller.spec.ts`, `topic/topic.controller.spec.ts`, `question/question.controller.spec.ts`, `theory/theory.controller.spec.ts`, `coding/coding.controller.spec.ts`; `server/src/common/guards/clerk-auth.guard.spec.ts`, `roles.guard.spec.ts`             |
| Profile and settings                    | Resolve by Clerk subject; updates, setup completion, settings, and deletion affect only that user  | `server/src/modules/user/user.service.spec.ts`; real MongoDB coverage in `server/test/e2e/user-data-isolation.e2e-spec.ts`                                                                                                                                                                  |
| Theory sessions and answers             | Owner on creation and `{id, userId}` access; child access through session; foreign records are 404 | `server/src/modules/theory/theory.service.spec.ts`; real PostgreSQL coverage in `server/test/e2e/theory-data-isolation.e2e-spec.ts`                                                                                                                                                         |
| Theory history and analytics            | Caller filter on session list, counts, weak areas, and score trends                                | `server/src/modules/theory/theory.service.spec.ts`; real PostgreSQL coverage in `server/test/e2e/theory-data-isolation.e2e-spec.ts`                                                                                                                                                         |
| Coding sessions and executions          | Caller filter on session actions and execution retrieval; foreign records are 404                  | `server/src/modules/coding/coding.service.spec.ts`; real PostgreSQL coverage in `server/test/e2e/coding-data-isolation.e2e-spec.ts`                                                                                                                                                         |
| Coding history                          | Caller filter on page query and count                                                              | `server/src/modules/coding/coding.service.spec.ts`; real PostgreSQL coverage in `server/test/e2e/coding-data-isolation.e2e-spec.ts`                                                                                                                                                         |
| Clerk webhook                           | Reject invalid signatures before user changes                                                      | `server/src/modules/webhook/webhook.controller.spec.ts`                                                                                                                                                                                                                                     |
| Workers                                 | Operate on persisted execution/answer IDs and preserve owner scope when updating sessions          | `server/src/modules/coding/coding-execution.service.spec.ts`, `coding-execution.worker.spec.ts`, `server/src/modules/theory/theory-evaluation.service.spec.ts`, `theory-evaluation.worker.spec.ts`; real coding transaction coverage in `server/test/e2e/coding-data-isolation.e2e-spec.ts` |
| Public surfaces                         | No private user records exposed or mutated                                                         | `server/src/modules/health/health.controller.spec.ts`, `server/src/modules/tech-expert/tech-expert.service.spec.ts`                                                                                                                                                                         |

Service specs assert Prisma arguments using mocks, and ownership tests exercise
the 404 behavior. The opt-in suite has separate MongoDB user, PostgreSQL
theory, and PostgreSQL coding specs under `server/test/e2e/`. It covers user
profile/settings mutations, theory session/answer/history/analytics paths,
coding session/execution/history paths, and coding worker submission mutations
using the persisted owner. Run it through root `pnpm test:database:isolation`;
its dedicated Podman project uses fresh databases and does not touch the
development stack. This proves the exercised application paths, not
database-wide isolation or PostgreSQL RLS.

## Consequences and open work

- New endpoints and workers must follow this policy and add an ownership test.
- Internal theory evaluation and queue-dispatch worker paths, webhook signature
  handling, and public surfaces remain covered by their existing unit tests;
  they do not share the user-request ownership boundary tested here.
- PostgreSQL RLS is not enabled. Follow [ADR-0012](../adr/0012-postgresql-row-level-security.md)
  before enabling database-enforced tenant isolation.
