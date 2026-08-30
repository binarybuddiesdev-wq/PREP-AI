# GEMINI.md

This file provides guidance to Gemini when working with code in this repository.

## Project Overview

PrepAI is an AI-powered interview preparation platform (adaptive questions, AI-scored answers, weakness tracking, coding challenges). It's a monorepo with three independently-managed pnpm packages:

- `server/` — NestJS (v11) + Fastify backend
- `ui/` — React 19 + Vite frontend
- root — Playwright E2E tests + Piston (code execution engine) management scripts

There's also `piston-cli/` (installs Piston language runtimes) and `types/piston.ts` (start/stop/setup/status script for the self-hosted Piston container), and a standalone `prepai-ui.html` — a fully self-contained static HTML prototype of the whole UI with no backend/build step; don't confuse it with the real `ui/` app.

## Commands

Install everything (each package has its own lockfile):

```bash
pnpm install
cd ui && pnpm install && cd ..
cd server && pnpm install && cd ..
```

### Server (`server/`)

```bash
pnpm start:dev              # watch mode; runs src/main.ts directly via swc-node, loads ../.env
pnpm build                  # tsc + tsc-alias -> dist/
pnpm test                   # vitest run (unit, src/**/*.spec.ts)
pnpm test:watch
pnpm test:coverage          # v8 coverage, 90% threshold on lines/statements/functions/branches
pnpm test:e2e               # vitest run --config vitest.config.e2e.ts (test/e2e/**/*.e2e-spec.ts)
pnpm format                 # prettier --write src/**/*.ts
```

Run a single unit test file: `pnpm vitest run src/modules/topic/topic.service.spec.ts`
Run tests matching a name: `pnpm vitest run -t "should create topic"`

Prisma (two separate schemas/databases — see Architecture):

```bash
pnpm prisma:generate            # generates both clients
pnpm prisma:push:mongodb        # prisma db push --schema=prisma/schema.prisma
pnpm prisma:push:postgresql     # prisma db push --schema=prisma/schema.postgresql.prisma
pnpm prisma:migrate:postgresql  # prisma migrate dev --schema=prisma/schema.postgresql.prisma
```

### UI (`ui/`)

```bash
pnpm dev                     # vite dev server, http://localhost:5173
pnpm build                   # tsc && vite build
pnpm test                    # vitest (watch mode)
pnpm test:ui                 # vitest UI
pnpm lint                    # eslint . --ext ts,tsx
```

Run a single test file: `pnpm vitest run src/pages/DashboardPage.test.tsx` (from `ui/`)

### Piston (self-hosted code execution engine, from repo root)

PrepAI uses Piston as its code execution and sandboxing engine. Due to Windows, WSL2, and rootless Podman environment constraints, a custom setup is required:

```bash
pnpm piston:start    # create (first run) or `podman start` the piston_api container
pnpm piston:setup    # install JS/TS/Python runtimes — run once (persist in piston_data volume)
pnpm piston:status
pnpm piston:stop     # `podman stop` — container is kept (Exited), restart with piston:start
pnpm piston:remove   # `podman rm -f` — delete the container entirely
```

- `pnpm piston:start` uses a custom entrypoint ([piston-entrypoint.sh](file:///c:/teja/coding/PREP-AI/piston-entrypoint.sh)) to handle cgroup v2 controller limits in rootless WSL2/Podman (such as the missing `cpuset` controller), maps a named volume `piston_data` at `/piston` to persist installed languages, and binds the container port explicitly to IPv4 loopback `127.0.0.1:2000` to avoid Windows port-forwarding issues (the port is changed in `types/piston.ts`).
- Requires Podman Desktop running. Verify with `podman ps` and `curl http://127.0.0.1:2000/api/v2/runtimes`.
- On Podman 6.x + WSL 2.7+ a fresh clone also needs: `.sh` files kept LF (`.gitattributes`), WSL2 `networkingMode=mirrored` in `%USERPROFILE%\.wslconfig` (+ `wsl --shutdown`), and the `--add-host` GitHub-CDN pins already in `types/piston.ts`. Runtimes persist in the `piston_data` volume, so `pnpm piston:setup` is one-time.
- For details, troubleshooting, or manual steps, refer to [PISTON_WSL_SETUP_GUIDE.md](file:///c:/teja/coding/PREP-AI/docs/PISTON_WSL_SETUP_GUIDE.md) (see §2b for the newer-environment fixes).

### E2E (Playwright, from repo root)

```bash
pnpm test              # all E2E tests (spins up both ui and server dev servers)
pnpm test:frontend      # ui project only
pnpm test:backend       # server project only
pnpm test:chromium      # *-chromium projects only
pnpm report             # open HTML report
```

## Architecture

### Two databases, two Prisma clients

`server/prisma/schema.prisma` (MongoDB, default-generated client) holds `User`, `UserSettings`, `Topic`, `Question`. `server/prisma/schema.postgresql.prisma` generates a _separate_ client into `src/generated/postgresql-client` (for Sessions/Answers-type relational data — see `server/README.md` planned modules). `PrismaService` (Mongo) is the default injectable everywhere; `PrismaPostgresqlService` wraps the Postgres client and **no-ops gracefully** if `POSTGRESQL_URL` is unset or the client hasn't been generated yet (checked at `onModuleInit`). When adding a feature, check which store it belongs in before assuming `PrismaService` is the only one.

### Module structure

Each feature lives under `server/src/modules/<name>/` as `<name>.controller.ts`, `<name>.service.ts`, `<name>.module.ts`, `dto/` (with a barrel `dto/index.ts`), and co-located `<name>.controller.spec.ts` / `<name>.service.spec.ts`. Look at `modules/topic/` as the reference implementation for new CRUD modules — it's the most complete/current example (see `routes/questions-api-spec.md` and `routes.md` at repo root for the intended shape of newer modules).

### Auth

`ClerkAuthGuard` + `RolesGuard` are applied together via `@UseGuards(ClerkAuthGuard, RolesGuard)` at the controller level. `ClerkAuthGuard` verifies the Bearer token via Clerk's SDK, looks up the corresponding Mongo `User` by `clerkUserId`, and attaches `{ id, email, role }` to `request.user` (falls back to Clerk payload email/role if no local user exists yet). Routes are opted out of auth with `@Public()` (checked via reflector metadata, `IS_PUBLIC_KEY`). `RolesGuard` reads `@Roles(...)` metadata and 403s if `request.user.role` isn't included — it's a no-op if no roles are declared on the handler.

Clerk webhooks (`modules/user/webhook.controller.ts`, `POST /webhooks/clerk`) keep the local Mongo `User` in sync on `user.created`/`user.updated`/`user.deleted`, verified via `svix` signature checking against `CLERK_WEBHOOK_SECRET`. This is the only place local users get created — there's no local registration endpoint.

### Response shape & validation

Every controller response is wrapped by the global `TransformInterceptor` into `{ success, message, data }`. Controllers should return a plain `{ message, data }` object (or just data) — never construct the envelope manually. `ZodValidationPipe` (schema-driven) and `class-validator` DTOs are both in use; new endpoints can use either depending on whether the shape needs runtime Zod schema reuse (e.g. for Swagger response schemas via `common/schemas/`) or simple decorator-based DTOs.

### Constants convention

`common/constants/api.constants.ts` centralizes `ApiTags`, `ApiRoutes`, and `ApiOperation` enums plus per-module success/error message constants (e.g. `CREATE_TOPIC_SUCCESS`). New modules should add their route/tag/operation entries and message constants here rather than inlining strings in controllers/services — this is what the existing `topic` and `question` modules do.

### Logging & config

Services inject a scoped logger via `@InjectPinoLogger(XService.name)` (nestjs-pino) rather than `console.log` or the built-in Nest `Logger`. Environment variables are validated at boot through a Zod schema in `server/src/config/env.validation.ts` (`validateEnv`, wired into `ConfigModule.forRoot`) — add new required env vars there, not just to `.env.example`. `DATABASE_URL` is required unless `NODE_ENV=test`; `POSTGRESQL_URL` is always optional (see above).

### Path aliases & module system

Both `server/` and `ui/` use `@/*` → `src/*`. The server is pure ESM/NodeNext (`.js` extensions required in relative imports even for `.ts` files, e.g. `from './topic.service.js'`) — keep this pattern when adding new files.

### Frontend

Routing is React Router with `SignedIn`/`SignedOut` (Clerk) gating `ProtectedRoute`/`PublicRoute` wrappers in `App.tsx`. Server state goes through TanStack Query; client/global UI state through Redux Toolkit (`store/index.ts`). All API calls go through `useApiClient()` (`lib/api.ts`), a `ky` instance that auto-attaches the Clerk session token as a Bearer header and is prefixed with `${VITE_API_BASE_URL}/api/v1` — don't call `fetch`/`ky` directly from components. UI components follow Shadcn UI conventions (`components.json`, `components/ui/`) with Tailwind v4.

### Infrastructure dependencies

AI/LLM calls go through Mastra agents (`server/src/mastra/`) calling NVIDIA NIM (`meta/llama-3.3-nemotron-super-49b-v1.5` per `server/README.md`, `.env.example` defaults to `llama-3.1-8b-instruct` — check `NVIDIA_MODEL` before assuming which). Redis (via `cache-manager-ioredis-yet`) is a global `CacheModule`. Cloudinary (PDFs), Resend (email), and Razorpay (payments) are referenced in docs/README but not yet implemented in `server/src/modules/` — check before assuming an integration exists.

## Agent Skills & Guidelines

This project has custom domain skills defined under [`.claude/skills/`](.claude/skills/). Every AI assistant MUST read and strictly adhere to the corresponding skill file before creating, modifying, or reviewing code in that domain:

- **[`api-design`](.claude/skills/api-design/SKILL.md):** Creating/editing HTTP endpoints, DTOs, the `{success, message, data}` response envelope, Swagger schemas, and status codes.
- **[`react-developer`](.claude/skills/react-developer/SKILL.md):** React 19 frontend components, pages, TanStack Query, Redux state, Clerk auth, and Tailwind styling.
- **[`nestjs-developer`](.claude/skills/nestjs-developer/SKILL.md):** NestJS backend architecture, module wiring, Fastify types, guards, Pino logging, dependency injection, and the dual-database (Mongo + Postgres) split.
- **[`prisma-database`](.claude/skills/prisma-database/SKILL.md):** Dual-database ORM rules (Mongo vs. Postgres), Prisma schemas, schema pushes, IDOR prevention, query patterns, and the `client_` no-op.
- **[`testing`](.claude/skills/testing/SKILL.md):** Vitest specs, `vi.fn()` mocking, guard overrides, coverage thresholds (90%), and E2E setup.
- **[`mastra-ai`](.claude/skills/mastra-ai/SKILL.md):** Mastra AI agents, LLM failover router (`providers.ts`), and Zod structured outputs.
- **[`developer`](.claude/skills/developer/SKILL.md):** Development standards — naming conventions, documentation, testing, formatting, architecture constraints for the PrepAI monorepo.
- **[`verify-implementation`](.claude/skills/verify-implementation/SKILL.md):** Tiered test verification gate — Tier 1 (format, lint, build, test) always, Tier 2 (e2e, coverage) before merge.
- **[`git-commit`](.claude/skills/git-commit/SKILL.md):** Conventional Commits format, the registered scopes in `commitlint.config.js`, and the husky `commit-msg` hook. Required before any `git commit`.
- **[`architect-review`](.claude/skills/architect-review/SKILL.md):** Read-only review of frontend (ui/) changes against the 7-layer architecture in [`docs/architecture/architecture.md`](docs/architecture/architecture.md) §Frontend Refactor. Flags layer violations, naming issues, and structural defects. Use before merging any ui/ branch.

---

## Role Dispatch

This section tells the orchestrating (main) agent when to invoke which of the four role-based subagents defined in [`.claude/agents/`](.claude/agents/) (`architect.md`, `backend-developer.md`, `frontend-developer.md`, `qa-engineer.md`) and which skills to invoke. Its goal is to pay the cost of subagent dispatch only where genuine judgment is needed, not on every trivial diff. There are two checkpoints, run in this order for any change:

### Checkpoint 1 — The Mechanical Gate

Also called the **Test Gate** in the agent definitions — same thing. Mechanical, no subagent dispatch, governed entirely by the [`verify-implementation`](.claude/skills/verify-implementation/SKILL.md) skill: its Tier 1 (format, build, test) runs on every change unconditionally; its Tier 2 (e2e, coverage) runs conditionally, when the change reaches those areas. Run directly by whichever engineer subagent (or the main agent) made the change. See the skill's "What changed → which tiers" table for the selection rule.

**Standing instruction** (folded into `architect.md`'s responsibility 1): a recurring or rule-shaped finding from the Judgment Review gets promoted into a mechanical rule — a new ESLint rule, a stricter pre-commit hook — rather than staying a remembered instruction.

### Checkpoint 2 — The Judgment Review

Dispatched only for non-trivial changes — see the decision rule below. The table's first four rows are dispatches for direct implementation/design work; the last two rows are the after-the-fact review-gate triggers for the same `architect` / `qa-engineer` subagents once implementation is done.

| Task touches                                                                                                        | Dispatch                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/modules/<name>/*`, `server/src/common/*`, `server/src/prisma/*`, `server/src/mastra/*`                  | `backend-developer`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ui/src/**` (any frontend file or page)                                                                             | `frontend-developer`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Writing/expanding test coverage as part of a feature                                                                | `qa-engineer`                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Cross-cutting architecture decisions, ADRs, new feature specs, or non-trivial `ui/` changes                         | `architect` (and the `architect-review` skill for ui/ layer-boundary violations)                                                                                                                                                                                                                                                                                                                                                              |
| **After a _non-trivial_ implementation** (see definition below) — the Mechanical Gate has already run by this point | `qa-engineer` and/or `architect`, whichever gate's risk is actually present. When both apply, dispatch them **concurrently in one message**. `qa-engineer`: coverage-gap check + per-change regression reasoning, grounded in the Mechanical Gate's already-produced output. `architect`: coding standards (beyond what lint catches) + the 10 Core Principles + architecture boundaries + functional correctness + oversized-component check |
| **Either review gate reports an issue**                                                                             | dispatch back to the engineer who owns that code — `backend-developer` / `frontend-developer` — to fix it; then re-review **only the flagged item and what the fix touched**, unless the fix changed behavior or structure (see below)                                                                                                                                                                                                        |

#### What a dispatch prompt must carry

A subagent starts with **no share of the orchestrating agent's context**. Anything already established — the file list, the line numbers, the tool output, the classification of what's wrong, the decision already taken and why — must be restated in the dispatch prompt, or the subagent spends most of its run re-deriving it. This is the single largest avoidable cost in the dispatch model, and it multiplies with every agent in a parallel fan-out: N agents rediscovering the same facts N times.

Every dispatch prompt states:

1. **The concrete work list** — exact paths and line numbers, not "the files with lint errors". If the orchestrating agent already ran the tool that produces the list, paste the relevant slice of that output.
2. **What has already been decided, and why** — the approach, the rejected alternatives, and any user decision that constrains the work. Without this a subagent re-litigates settled choices, or quietly picks a different one.
3. **The scope boundary** — what this agent owns and what a _concurrent_ agent owns. When fanning out, name the files each agent must not touch. Shared files (a barrel, a config, a shared helper) belong to exactly one agent; say which.
4. **Prerequisites and their owner** — if the task depends on something another agent in the same batch is creating, say so explicitly rather than letting each assume someone else did it.
5. **The verification to run, and the expected result** — the Mechanical Gate commands plus the number the agent should reach.

When fanning out, prefer splitting by **directory ownership** over splitting by task type — it makes the boundaries in (3) self-evident and keeps two agents off the same file.

#### Trivial vs. non-trivial decision rule

A concrete rule for the orchestrating agent to apply, not "use judgment":

- **Trivial** (Mechanical Gate only, no subagent dispatch) — single-file, no new/changed public interface, exported type, DTO, or ADR-relevant decision; no new pattern introduced. Examples: renames, typo/wording fixes, single-conditional or single-log-line fixes, config value tweaks, a bug fix that doesn't change a function's contract.
- **Mechanical sweep** (Mechanical Gate only, no subagent dispatch, **regardless of file count**) — the same known-correct edit repeated across many files, introducing no new interface, pattern, or behavior. The test for this class: _is correctness decided by mechanical ground truth?_ If "lint is silent, types check, tests pass" fully establishes the change is right, a judgment agent has nothing left to judge. Examples: conforming to a newly enabled lint rule, a repo-wide rename, replacing an inline stub with an existing shared helper, extracting a stateless private method to a module-level function with unchanged behavior.
  - **File count is not a risk signal — design novelty is.** An 80-file substitution of one identical expression carries less risk than a four-line change to error handling in two files. Route novelty and behavior change to the Judgment Review, not breadth.
  - This class does **not** absorb a change that alters behavior, even by one line. If a sweep turns up a genuine defect along the way (a swallowed error, a missing edge case), that specific fix is non-trivial on its own and gets the full Judgment Review — split it out of the sweep rather than reclassifying the whole sweep.
- **Non-trivial** (Judgment Review applies) — anything that adds or changes an exported `useXxxReader` / `useXxxCommand` hook, a service interface, an exported component/hook/type; introduces a pattern not already used elsewhere in that layer; touches `data/api-client.ts` or the RTK store; changes behavior, error handling, or a public contract; any new feature work regardless of size; any `ui/` change beyond a one-line fix.
- When genuinely ambiguous, default to non-trivial (dispatch) — a wasted Judgment Review pass costs far less than a missed regression. But "spans multiple files" alone is **not** that ambiguity: apply the Mechanical sweep test first.

#### Which gate, and why they run concurrently

Both gates read the Mechanical Gate's already-produced output, and **neither re-runs the suite.** Because that output already exists before either is dispatched, `architect` is not waiting on anything `qa-engineer` produces — serializing them buys no information and doubles the latency. Each reports independently; the orchestrating agent merges the two reports.

Dispatch only the gate whose risk is actually present:

- **`qa-engineer` alone** when the risk is coverage — new or changed logic whose tests are thin, or a change whose regression surface is wider than the diff.
- **`architect` alone** when the risk is design — a new pattern, a layer-boundary question, or an oversized component in an already well-tested path. For `ui/` changes, also invoke the [`architect-review`](.claude/skills/architect-review/SKILL.md) skill, which encodes the full frontend violation list.
- **Both, concurrently,** when both apply, or when genuinely unsure which. But "it's non-trivial" is not by itself a reason to dispatch both.

This replaces an earlier `qa-engineer` → `architect` ordering whose stated purpose was to catch a broken build before reasoning about architecture on top of it. The Mechanical Gate already catches that, upstream of both — so do not reintroduce the ordering as an apparent improvement.

#### Fix-and-re-review mechanics

Neither review gate is a dead end, and neither silently patches around what it finds. When either flags something, the fix belongs to whichever engineer subagent owns that code — `backend-developer` for `server/`, `frontend-developer` for `ui/`. The only work a review-gate agent does directly: `qa-engineer` may write a genuinely missing _test_ (test-only, not a production fix); `architect` may write/update an ADR or a dev-setup/tooling file (its own domain, and the preferred outcome whenever a finding is rule-shaped). An actual implementation defect — bug, missed edge case, oversized component, principle violation — always goes back to the owning engineer.

**Scope the re-review to the fix.** Re-run the Mechanical Gate always. Then:

- **Fix confined to what was flagged** (a rename, an added guard, a split component, a new test) — re-review only that item and the files the fix touched, and only by the gate that raised it. A naming nit does not justify a second full pass of both gates.
- **Fix changed behavior, a public contract, or structure beyond the flagged site** — re-run both gates in full, concurrently. Widening the blast radius is exactly what the full pass exists for.

The orchestrating agent runs this loop, not the subagents — none of the four agent definitions in `.claude/agents/` have `Agent`-tool access, so they cannot dispatch each other directly. Each subagent returns its findings as its final report; whichever agent dispatched the original engineer (typically the main loop) reads that report and re-dispatches the fix.

#### Convergence bound

If the same category of issue survives 2 fix-and-re-review cycles (e.g. `architect` flags the same principle violation twice after two attempted fixes), stop looping automatically and surface it to the user instead of continuing indefinitely. There is no unbounded "repeat until clean" loop.

#### Known gap

Nobody reviews `architect`'s own direct edits (an ADR, an `eslint.config.js` change). This is a real limitation, not an implied guarantee of oversight everywhere.
