# CLAUDE.md — server/

Guidance for working in the NestJS + Fastify backend (`server/`). It loads when you work under `server/`; the repo-wide rules (git, role dispatch, the shared skills) are in the root `CLAUDE.md`. The frontend has its own `ui/CLAUDE.md`.

## Required skills

Server skills live in `server/.claude/skills/` and are listed only after a file under `server/` has been read or edited in the session. **Read a file in the area you are about to change first, then invoke the skill.** These are mandatory, not optional.

| When                                                                          | Skill                          |
| ----------------------------------------------------------------------------- | ------------------------------ |
| Before writing or modifying any server code                                   | `server-developer`             |
| Before any `server/src/` work: modules, controllers, services, guards, config | `nestjs-developer`             |
| Before adding or changing an endpoint, DTO, status code or message            | `api-design`                   |
| Before writing or reviewing a Prisma query, or deciding which database        | `prisma-database`              |
| Before changing a schema, index, backfill or seed data                        | `db-schema-change`             |
| Before touching `server/src/mastra/` or any LLM call                          | `mastra-ai`                    |
| Before writing or changing a `*.spec.ts`                                      | `testing`                      |
| After finishing an implementation, before calling it done                     | `server-verify-implementation` |
| Before adding, bumping or removing a dependency                               | `server-upgrade-packages`      |
| Before merging a branch that touches `server/`                                | `server-architect-review`      |
| Before creating a git commit (only when asked)                                | `git-commit` (shared)          |

Agents: `backend-developer` implements; `backend-architect` and `backend-qa-engineer` review (root `CLAUDE.md` § Role Dispatch).

## Commands (from `server/`)

```bash
pnpm start:dev              # watch mode; runs src/main.ts directly via swc-node, loads ../.env
pnpm build                  # tsc + tsc-alias -> dist/
pnpm test                   # vitest run (unit, src/**/*.spec.ts)
pnpm test:watch
pnpm test:coverage          # v8 coverage, 90% threshold on lines/statements/functions/branches
pnpm test:e2e               # vitest run --config vitest.config.e2e.ts (test/e2e/**/*.e2e-spec.ts; no such files yet)
pnpm format                 # prettier --write src/**/*.ts — WRITES files; the quality gate uses `pnpm format:check` from the repo root
```

After a fresh install or any `.prisma` schema change, run `pnpm prisma:generate` (below) before `pnpm build` or `pnpm test`; both fail without the generated clients.

Run a single unit test file: `pnpm vitest run src/modules/topic/topic.service.spec.ts`
Run tests matching a name: `pnpm vitest run -t "should create topic"`

Prisma (two separate schemas/databases — see Architecture):

```bash
pnpm prisma:generate            # generates both clients
pnpm prisma:push:mongodb        # prisma db push --schema=prisma/schema.prisma
pnpm prisma:push:postgresql     # prisma db push --schema=prisma/schema.postgresql.prisma
pnpm prisma:migrate:postgresql  # prisma migrate dev --schema=prisma/schema.postgresql.prisma
```

The quality gate (lint, format check, build, spec type-check, tests, coverage) is `server-verify-implementation`. Do not run it from memory.

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

`server/` uses `@/*` → `src/*`. The server is pure ESM/NodeNext (`.js` extensions required in relative imports even for `.ts` files, e.g. `from './topic.service.js'`) — keep this pattern when adding new files.

### Infrastructure dependencies

AI/LLM calls go through Mastra agents (`server/src/mastra/`) calling NVIDIA NIM (`meta/llama-3.3-nemotron-super-49b-v1.5` per `server/README.md`, `.env.example` defaults to `llama-3.1-8b-instruct` — check `NVIDIA_MODEL` before assuming which). Redis (via `cache-manager-ioredis-yet`) is a global `CacheModule`. Cloudinary (PDFs), Resend (email), and Razorpay (payments) are referenced in docs/README but not yet implemented in `server/src/modules/` — check before assuming an integration exists.

## Known gaps in the backend

The skills record what is **backlog, not precedent** (for example `process.env` in `mastra/providers.ts`, the 403 on another user's session in `theory.service.ts`, `NotFoundException('Database not available')`). Reviews flag only what a diff adds. The open architecture work is `docs/architecture/TODO.md`.
