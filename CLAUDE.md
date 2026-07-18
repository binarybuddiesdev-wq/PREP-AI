# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
```bash
pnpm piston:start    # boot container (custom entrypoint handles cgroup v2 issues under rootless Podman/WSL2)
pnpm piston:setup    # install JS/TS/Python runtimes — run once
pnpm piston:status
pnpm piston:stop
```
Requires Podman Desktop running. Verify with `podman ps` and `curl http://127.0.0.1:2000/api/v2/runtimes`. Container binds explicitly to `127.0.0.1:2000` to avoid Windows port-forwarding issues. Troubleshooting details in `docs/PISTON_WSL_SETUP_GUIDE.md`; port is changed in `types/piston.ts`.

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
`server/prisma/schema.prisma` (MongoDB, default-generated client) holds `User`, `UserSettings`, `Topic`, `Question`. `server/prisma/schema.postgresql.prisma` generates a *separate* client into `src/generated/postgresql-client` (for Sessions/Answers-type relational data — see `server/README.md` planned modules). `PrismaService` (Mongo) is the default injectable everywhere; `PrismaPostgresqlService` wraps the Postgres client and **no-ops gracefully** if `POSTGRESQL_URL` is unset or the client hasn't been generated yet (checked at `onModuleInit`). When adding a feature, check which store it belongs in before assuming `PrismaService` is the only one.

### Module structure
Each feature lives under `server/src/modules/<name>/` as `<name>.controller.ts`, `<name>.service.ts`, `<name>.module.ts`, `dto/` (with a barrel `dto/index.ts`), and co-located `<name>.controller.spec.ts` / `<name>.service.spec.ts`. Look at `modules/topic/` as the reference implementation for new CRUD modules — it's the most complete/current example (see `question-model-spec.md` and `routes.md` at repo root for the intended shape of newer modules).

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
