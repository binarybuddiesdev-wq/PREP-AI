---
name: server-developer
description: Use before writing or modifying any code under server/ in PrepAI — the backend baseline for process, impact analysis, failure handling, security authoring, naming, comments, testing principles and code quality. Framework rules are in nestjs-developer; the UI has its own ui-developer.
---

# Server Development Guidelines

The baseline for **every** change under `server/`. Framework mechanics (imports, Fastify, logging, DTOs) are in `nestjs-developer`; this skill is the process and judgement layer on top of it. The frontend has its own copy, `ui-developer`.

| Work                                                                   | Skill                          |
| ---------------------------------------------------------------------- | ------------------------------ |
| Any `server/src/` work: modules, controllers, services, guards, config | `nestjs-developer`             |
| An endpoint, DTO, status code, message or response shape               | `api-design`                   |
| A Prisma query, user-scoped data, the Mongo/Postgres split             | `prisma-database`              |
| A schema, index, backfill or seed change                               | `db-schema-change`             |
| `server/src/mastra/` or an LLM call                                    | `mastra-ai`                    |
| A `*.spec.ts`                                                          | `testing`                      |
| Finishing the task                                                     | `server-verify-implementation` |
| Reviewing a branch or diff                                             | `server-architect-review`      |

## Process

1. Understand the requirement before writing code. Read `routes/<name>-api-spec.md` for the module; if it does not exist, stop and write it with the user.
2. Make a plan, then execute it.
3. Implement following this skill and the stack skills that apply.
4. Update the documentation the change affects: the route spec, Swagger summaries, an ADR, the skill that describes the behaviour.
5. Write or update specs at the level that proves the behaviour (`testing`).
6. Run the quick check on what you touched; the gate (`server-verify-implementation`) runs once, on the assembled change.
7. Review the diff so nothing unnecessary is in it.

### Impact analysis for existing code

Before changing existing code, write down what it affects: the callers and callees, the other module that reads the same collection or table, and **the UI** (`ui/src/lib/api.ts` and the pages that consume the endpoint). A changed route, field, status or message breaks the UI unless the change is additive (`api-design` § contract). Then cover both the new behaviour and the existing behaviour you touched with specs.

### Bounded investigation

Read what the change needs: the files you modify, their direct dependencies, their call sites and the relevant spec. Do not re-explore the whole repository when a route spec or plan already names the files.

## Non-negotiable musts

- **Identity comes from the token, never the request.** User-scoped data is filtered by `request.user.id` (`@CurrentUser('id')`), not by a body, query or path value.
- **Every relative and `@/` import ends in `.js`.**
- **Configuration through `ConfigService`** in anything you add (`nestjs-developer` rule 8 lists the accepted `process.env` exceptions).
- **No secrets in code, logs or responses.**
- **Dependencies change only through `server-upgrade-packages`.**
- **Git:** no commit, push, stash, branch or reset unless the user explicitly asks, and then through `git-commit`. Never `--no-verify`.

## Reuse before build

Search for the concept and its synonyms first (`grep -rn "escapeLike\|roleLimits" server/src`), then check `server/src/common/` (guards, decorators, filters, pipes, interceptors, utils). Build new only when nothing fits, and put reusable logic in `common/`, not inside one module.

## Design principles

- **Separation of concerns.** Controllers translate HTTP into one service call and return `{ message, data }`. Services own business rules and database access. Pure, I/O-free rules live in functions callable without Nest. Never mix them.
- **One reason to change** per function, class and service. If two unrelated causes would edit it, split it.
- **Depend on abstractions across a boundary:** inject providers; no hidden module-level singletons you cannot replace in a spec.
- **SOLID**, with judgement. An interface with one implementer and no substitution need is itself a finding.

## Failure handling

Classify a failure before you handle it. Each failure has exactly one class:

| Class             | Meaning                                                                                                        | What to do                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Expected**      | The caller caused it: validation, not found, conflict, quota reached                                           | A typed 4xx from the status map; logged at `warn` by the filter                                                 |
| **Unexpected**    | A genuine fault: a bug, a dependency down, a bad state                                                         | Let it reach the filter as a 5xx; logged at `error` there                                                       |
| **Fatal**         | Startup cannot continue: bad env, failed boot check                                                            | Fail fast at boot with a clear message (`env.validation.ts`)                                                    |
| **Best-effort**   | The step does not change the outcome if it fails and leaves only something harmless (a cache write, a cleanup) | Catch, log at `warn` with what it concerns, carry on; the reason is visible at the site                         |
| **Safe default**  | A read falls back to a value safe for the caller (an LLM `fallbackValue`, an unparseable optional field)       | Fall back, log at `warn`. For security data the default is the **closed** one (no access)                       |
| **Must not mask** | Shutdown or failure-handling work that could leave something that matters                                      | Log at `error` with what may be left behind, continue the other steps, and do not replace the failure in flight |

Rules:

- **Boundary calls** are the calls that leave the process and where failures start: Prisma (both databases), the Clerk SDK, the LLM providers through Mastra, Redis, Piston and Svix.
- **A failure is translated once and logged once**, at its **translation point**: the global `GlobalExceptionFilter` (`common/filters/http-exception.filter.ts`), which logs 5xx at `error` and 4xx at `warn`. Code between a boundary call and the filter lets the error pass, or maps it to a Nest exception **without logging it**.
- **Keep the cause.** Wrap with `new XException(MESSAGE, { cause: err })`. A plain `throw err` already preserves it.
- **Log-and-rethrow is two surfaces**, because the filter logs again. Do not do it.
- **Never swallow.** A `catch` that logs and carries on is acceptable only for the best-effort, safe-default and must-not-mask classes, and says why. An empty or `console`-only `catch` is a defect.
- **Infrastructure unavailable is not "not found".** A missing Postgres client is a `ServiceUnavailableException` (503). The status map and the backlog are in `nestjs-developer` `references/errors.md`.

## Design patterns

**The symptom scan is mandatory on any non-trivial change; pattern judgement fires only on a hit.** Row 5 is a standing check before adding any interface.

| #   | Symptom                                                                                           | Pattern                                               | PrepAI example                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | A chain branching on a `kind`/`type`-like field, repeated at several call sites, expected to grow | Strategy / dispatch via a map                         | `providers.ts` (`pickProvider()` + `getModel()`) does this for NVIDIA/Groq; do not add a second `switch` for the same choice |
| 2   | Object or DTO construction duplicated across 2+ call sites                                        | Factory                                               | A factory for exactly one product is over-application, also a finding                                                        |
| 3   | An external or provider-specific API used directly by feature code                                | Adapter                                               | `providers.ts` behind one `getModel()`; mirror it for a third provider                                                       |
| 4   | The same permission or access rule needed by several resources                                    | A pure helper in `common/`, or a guard plus decorator | `ClerkAuthGuard` + `RolesGuard` + `@Roles()`                                                                                 |
| 5   | An interface with exactly one implementer and no substitution need                                | _(none; this is the finding)_                         | A service interface "for testability" when the class is already mocked with `useValue`                                       |
| 6   | Unrelated modules needing to react to a change without a direct reference                         | Event or registry                                     | There is no event bus yet; that is the decision point for one, not a reason to poll                                          |

## Security authoring notes

Authoring-time awareness, not a review checklist (that is `server-architect-review`) and not a SAST tool. They map to open items in `docs/architecture/TODO.md`: #5 Piston isolation, #6 data isolation, #7 idempotency, #13 threat model.

- **Piston runs arbitrary user code.** Any path that runs, evaluates or shells out to user input goes through the sandboxed Piston flow (`--network=none`, resource limits; `docs/PISTON_WSL_SETUP_GUIDE.md`), never a new `exec`, `eval` or `child_process`. If a feature seems to need execution outside Piston, stop and ask.
- **LLM prompt injection.** User text that reaches a prompt is attacker-controlled: delimit it, bound it, treat the output as untrusted until the schema validates it (`mastra-ai` rule 8).
- **Webhook signatures are non-negotiable.** `modules/user/webhook.controller.ts` verifies Clerk's Svix signature; any new webhook verifies its provider's the same way.
- **IDOR.** Every user-scoped query filters by the authenticated user's id in the `where` (`prisma-database` rule 2), and another user's record is a 404 (`api-design` § contract).
- **Secrets stay server-side.** `NVIDIA_API_KEY`, `CLERK_SECRET_KEY` and future payment keys never reach a response or a log at `info`.
- **Irreversible endpoints** (charge, delete, quota-consuming) should tolerate a replay. The `Idempotency-Key` design is `docs/architecture/TODO.md` #7 and is not implemented; state the gap in your report.
- **Bound everything a client can grow** (strings, arrays, `limit`) with a named constant; the global `ValidationPipe` rejects undeclared fields.

## Naming

- **Functions** are verb phrases (`createTopic`, `getTopicBySlug`); **variables** are noun phrases; **booleans** take `is`, `has`, `should` or `can`.
- No generic names (`d`, `tmp`, `val`, `data`, `info`, `result`, `process()`), no empty suffixes, no abbreviations (`repository`, not `repo`).
- **A generic noun carries the thing it belongs to:** `value` fails, `topicValue` passes. Exempt: `err`, `prev`, `init`, `i`, `j`, `x`, `y`, `_`.
- **Casing:** `camelCase` variables and functions; `PascalCase` classes and types; `UPPER_SNAKE_CASE` constants. Files are kebab-case with a role suffix (`topic.service.ts`, `create-topic.dto.ts`, `topic.controller.spec.ts`).

Four failure modes a denylist cannot catch:

1. **Shortened or acronym-compressed identifiers** where the full word costs nothing (`cfg`, `usrSvc`).
2. **Generic placeholders:** a bare `Kind`, `Info`, `Data` or `Mode` where nearby code has a more specific word.
3. **A name disagreeing with the codebase's own vocabulary.** PrepAI says `category` for topic grouping and `role` for permission level; a new `kind` or `tier` for either is a second vocabulary. Read the neighbouring module first.
4. **The dictionary test.** Would a newcomer have to look the word up? Prefer the plain word unless the domain uses the technical one.

## Documentation and comments

- Code is self-explanatory: a clearer name, a smaller function or an early return before a comment.
- **Default to no comment.** Add one only when the **why** is non-obvious (a hidden constraint, a subtle invariant, a workaround, a startup-order dependency). Never explain **what**.
- Short, simple English; one line. If removing it would not confuse a reader, do not write it.
- No doc comment on every export; reserve `@param`/`@returns`/`@throws` for a non-obvious public API. No redundant or commented-out code. No reference to the task or ticket in a comment.
- Behaviour and contract explanations belong outside the source: the route spec, the Swagger summary, the commit message.

## Testing principles

- Every new function, service method, guard and route gets specs in **Arrange → Act → Assert** shape, named by the expectation (`"should throw ConflictException when the topic already exists"`).
- Cover the happy path, the edges (empty, null, boundaries) and every `throw`.
- Specs are isolated: mocks are recreated in `beforeEach`.
- Non-trivial rules live in functions callable without Nest, with dependencies injected.
- **Say what a mocked spec cannot prove** (constraints, indexes, per-user scoping at the database): `testing` § What unit tests cannot prove.

## Code quality

- Short, single-purpose functions with early returns.
- **More than three parameters** → one named input type, destructured at the top. Exempt: NestJS DI constructors (resolved positionally). A controller or service method usually satisfies this because its DTO is the input.
- **A closed set of domain string values is a union type or a Prisma enum**, not a bare `string` (`category: 'practice' | 'coding'`, any `@IsIn([...])` field).
- No magic numbers or strings: named constants; messages in `api.constants.ts`.
- Handle errors explicitly; prefer `const`; do not mutate arguments.

## Formatting and file layout

- Prettier and ESLint are the authority (`pnpm lint`, `pnpm format:check` from the repo root). Use `prettier --write <files>` while iterating; the gate only checks.
- No unused imports or dead code. File order: imports, types, module constants, implementation. No `import` after the first statement; `export` on the declaration, trailing `export { … }` for barrels only.
- Use `import type { … }` for types. Group imports: external, `@/…`, relative, separated by blank lines.
- A file holds what its name promises. If its exports do not match its name, it is two files.
