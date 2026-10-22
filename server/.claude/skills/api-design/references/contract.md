# API contract rules

Reference for the `api-design` skill. Treat every endpoint as a **published interface with a consumer**: `ui/` calls it through `ui/src/service/api/`, and the spec in `routes/<name>-api-spec.md` is what the consumer was written against. A contract change that compiles on the server can still break the UI at runtime.

These are the defaults for **new and changed** endpoints. Existing endpoints that differ are listed under "Known backlog" at the end; they are not precedent.

## Compatibility

**Additive, no coordination needed:**

- a new endpoint;
- a new optional request field or query parameter with a backward-compatible default;
- a new response field.

**Breaking, needs the matching `ui/` change in the same delivery:**

- renaming, removing or retyping a request or response field;
- making an optional input required;
- changing a route, method, status code or the success/error message the UI branches on;
- changing a default (sort order, page size, scope).

Because `ui/` lives in this repository, a breaking change is **one change set**: server and `ui/` together, never a server change that leaves the UI broken until a follow-up. If a breaking change is unavoidable, say so explicitly and list the `ui/` files that must change.

**Every contract change ends with a "UI impact" note** in your report:

- the endpoints added or changed;
- the functions to add or change in `ui/src/service/api/`, and the pages or hooks that consume them;
- whether the change is additive or breaking.

The UI branches on **status code**, not message text. Messages may be reworded only together with `routes/<name>-api-spec.md` and the tests that assert them.

## Request payloads

1. **Every body, query and path parameter set is a DTO class.** Never `@Param('id') id: string` without validation, and never `@Body() body: any`.
2. **Unknown fields are rejected.** The global `ValidationPipe` runs with `whitelist: true, forbidNonWhitelisted: true` (`config/middleware.config.ts`), so an undeclared field is a 400. That is the mass-assignment defence: every accepted field must be declared and decorated.
3. **Never accept the caller's identity in the payload.** The caller's id comes from `@CurrentUser('id')`, never from `dto.userId` or a path value. The _target_ of an admin action (the user or resource being managed) is an ordinary validated input on a route guarded for that action.
4. **Bound every client-controlled size.** Strings (`@MaxLength`), arrays (`@ArrayMaxSize`), numbers (`@Min`/`@Max`), including pagination (`limit`, `page`). Use a named constant for each limit and state it in the route spec. A field with no bound is a denial-of-service and an LLM-cost vector (user text reaches prompts).
5. **Every optional field has a stated null policy.** `@IsOptional()` lets both `undefined` **and `null`** through. Decide per field and write it in the spec: "omit or value; `null` is a 400" (add `@ValidateIf((_, value) => value !== undefined)` or `@IsNotEmpty()`), or "`null` clears it". Test the `null` case. An unplanned `null` reaching service code is a 500, which is a contract bug.
6. **Concurrent edits.** Where several tabs or people can edit the same record, accept an optional `expectedUpdatedAt` and make the write conditional on it; return 409 on a mismatch. Last-write-wins is acceptable only for data that has exactly one writer.

## Responses

1. **Envelope.** Controllers return `{ message, data }`; the client receives `{ success: true, message, data }`. Errors are `{ success: false, message, statusCode, path, timestamp }`, and **nothing else appears in an error body**. Do not rely on extra error fields.
2. **`data` contains only what the caller may see.** Do not return a Prisma row unfiltered when it carries fields the caller must not have. Use `select` or map to a response shape, and state each returned field in the spec. Internal identifiers, credentials, other users' data and server-only evaluation material do not belong in a response.
3. **Dates are ISO-8601 strings** (Prisma `DateTime` serialises that way; do not reformat).
4. **Say what the caller may do** when a resource has per-record permissions: return the effective access (for example `isOwner`) so the UI can choose what to render instead of guessing and failing.
5. **List endpoints bound their output** with `limit`/`page`, a documented default and a documented maximum.
6. **Delete endpoints** follow the existing pattern: `200` with `{ message }`. Do not mix in `204` for a new module without updating the spec and the UI.

## Status codes: 404 versus 403

| Situation                                               | Status                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| Validation failure, malformed input, impossible request | 400                                                               |
| Not authenticated                                       | 401 (from `ClerkAuthGuard`)                                       |
| Authenticated but the **role** may not call this route  | 403 (from `RolesGuard`)                                           |
| Record does not exist, **or belongs to another user**   | **404**                                                           |
| Uniqueness clash, stale revision, limit reached         | 409                                                               |
| Daily quota exhausted                                   | the existing quota exception (see `theory`); state it in the spec |

**A record you cannot see is a 404, not a 403.** A 403 for "this is someone else's session" confirms the id exists and invites enumeration. Scope the lookup by owner and let it fail as not-found:

```ts
const session = await pg.theorySession.findFirst({ where: { id: sessionId, userId } });
if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);
```

Not this (fetch by id, then compare):

```ts
const session = await pg.theorySession.findUnique({ where: { id: sessionId } });
if (session.userId !== userId) throw new ForbiddenException(THEORY_NOT_SESSION_OWNER);
```

## Idempotency

An endpoint with an irreversible side effect (creates a session that consumes a daily quota, charges, deletes) should tolerate a replay. The design is `docs/architecture/TODO.md` item #7 (`Idempotency-Key` header and a Postgres table); it is **not implemented yet**. Until it lands: make the operation safe by construction (a unique index plus a conflict check) and note in your report that replay protection is a known gap.

## Documentation to update in the same change

1. `routes/<name>-api-spec.md` — routes, request and response shapes, the null policy, the bounds and the exact error table.
2. Swagger: `@ApiOperation({ summary })` on every handler, `@ApiBearerAuth()` and `@ApiTags` on the controller, response schemas under `common/schemas/<name>/`.
3. `server/src/common/constants/api.constants.ts` for every new message, tag, route and operation.

## Common mistakes

| Mistake                                                    | Fix                                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Returning a Prisma row with internal or server-only fields | `select` or map; list the fields in the spec                                |
| 403 for another user's record                              | 404, with the owner in the `where`                                          |
| Required field added to an existing body                   | Make it optional with a default, or ship the UI change in the same delivery |
| Message text changed in code only                          | Change the spec and the test assertions too                                 |
| `@IsOptional()` and no `null` test                         | Decide the null policy and test it over HTTP                                |
| Unbounded string, array or `limit`                         | Add a named limit and a validator                                           |
| No "UI impact" note                                        | Always list the `ui/` files to change                                       |

## Known backlog (do not copy, do not flag)

- `theory.service.ts` (`getSessionQuestions`, `submitAnswer`) fetches by id and answers `403 THEORY_NOT_SESSION_OWNER` for another user's session. New code uses the scoped lookup above.
- `GET /theory/session/:sessionId/questions` returns each question's `referenceAnswer`, as `routes/theory-api-spec.md` documents. If that is not meant to reach the learner before they answer, change it through the contract rules above, not silently.
