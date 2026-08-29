# PREP-AI — Session Context & Handoff

> **Purpose of this file:** persistent memory across Claude Code sessions. In a new session, say
> _"go through SESSION-CONTEXT.md"_ and Claude picks up with full context — no need to re-explain.
> **Keep this file updated** at the end of each working session (there's a checklist at the bottom).

_Last updated: 2026-08-29_

---

## 1. Who I am & what I want

- **Background:** Zero prior system design experience. Comfortable with full-stack coding.
- **Goal:** Learn system design properly by **building something real**, not just theory —
  target **85–90% understanding**, enough to clear interviews confidently.
- **Method:** As we build each feature of PREP-AI, I want to understand the **system design concept
  behind it** (why this datastore, why a queue here, how rate limiting works, etc.). Learning by
  doing, concept-per-feature.
- **We deliberately chose NOT to build a URL shortener** (too common/overused). Instead we continue
  my existing project, PREP-AI.

---

## 2. The project

- **Name:** PrepAI — AI-powered interview prep platform for software engineers
  (adaptive questions, AI-scored answers, weakness tracking, coding challenges).
- **Repo:** https://github.com/binarybuddiesdev-wq/PREP-AI
- **Local path:** `C:\teja\coding\PREP-AI`
- **Branch:** `main` (git user: `Uday-08-08-2004`)
- **Read `CLAUDE.md` first** — it has the authoritative architecture notes and commands.

### Monorepo layout (three independently-managed pnpm packages)
- `server/` — NestJS 11 + Fastify backend (pure ESM/NodeNext — `.js` extensions required in relative imports)
- `ui/` — React 19 + Vite frontend
- root — Playwright E2E + Piston (self-hosted code execution engine) scripts
- `prepai-ui.html` — standalone static HTML prototype of the FULL intended UI (no backend/build).
  **This is the design vision, not real code.** Don't confuse it with `ui/`.

---

## 3. Claude Code environment setup (already done in a previous session)

### Plugins installed globally (user scope, all projects)
`superpowers`, `frontend-design`, `code-review`, `context7`, `code-simplifier`, `playwright`,
`skill-creator`, `security-guidance`, `typescript-lsp`, `chrome-devtools-mcp`, `remember` — 11 total.

### Community MCP servers added globally
- `filesystem` — access to `C:\teja\coding` and `C:\Users\udayn`
- `sequential-thinking`
- `fetch`
- `tavily` — web search (API key already configured in the system)

---

## 4. Current state of the codebase (as of 2026-08-29 analysis)

**Headline:** There's a **large gap between the vision** (README + `prepai-ui.html`) **and what's
actually coded.** Docs describe ~11 full-featured screens; the real React app has 4 bare pages.
Backend is ahead of frontend but only ~half the planned modules exist.

### 4a. Backend (`server/`) — NestJS 11 + Fastify

**Architecture in place:**
- **Two Prisma clients / two databases (polyglot persistence):**
  - `PrismaService` → MongoDB → `User`, `UserSettings`, `Topic`, `Question`
    (schema: `server/prisma/schema.prisma`)
  - `PrismaPostgresqlService` → PostgreSQL → sessions/answers
    (schema: `server/prisma/schema.postgresql.prisma`, generates into `server/src/generated/postgresql-client`)
  - The Postgres service **no-ops gracefully** if `POSTGRESQL_URL` unset or client not generated
    (checked at `onModuleInit`). Access the client via `this.postgres.client_`.
- Auth: `ClerkAuthGuard` + `RolesGuard` applied together at controller level. `@Public()` opts out.
  `@Roles(...)` for RBAC. Local users created **only** via Clerk webhooks (`POST /webhooks/clerk`, svix-verified).
- Every response wrapped by global `TransformInterceptor` → `{ success, message, data }`.
  Controllers return plain `{ message, data }`.
- Validation: both `ZodValidationPipe` and `class-validator` DTOs in use.
- Constants centralised in `common/constants/api.constants.ts` (ApiTags/ApiRoutes/ApiOperation enums + message constants).
- Logging: `@InjectPinoLogger(X.name)` (nestjs-pino), never `console.log`.
- Env vars validated at boot via Zod in `server/src/config/env.validation.ts`.
- Redis global `CacheModule` (cache-manager-ioredis-yet).
- AI: **Mastra** agents → NVIDIA NIM. Agents: `tech-expert-agent`, `theory-evaluator-agent`
  (`server/src/mastra/`). Model: check `NVIDIA_MODEL` (`server/README.md` says
  `meta/llama-3.3-nemotron-super-49b-v1.5`, `.env.example` says `llama-3.1-8b-instruct`).

> ⚠️ **KNOWN BLOCKER:** `server/src/generated/` does not exist — nobody has run `pnpm prisma:generate`.
> Until the Postgres client is generated AND `POSTGRESQL_URL` is set, the **entire theory module
> throws `"Database not available"` at runtime.** This is the #1 thing to fix.

**Modules IMPLEMENTED:**

| Module | Routes | Notes |
|---|---|---|
| `health` | `GET /api/v1/health` | DB connectivity check, public |
| `tech-expert` | `POST /api/v1/tech-expert` | Public AI Q&A, structured output via Mastra |
| `user` | `GET /me`, `GET/PATCH /settings`, `PATCH /setup-complete`, `GET /:clerkUserId` (ADMIN) | profile/settings |
| `user` webhooks | `POST /webhooks/clerk` | `user.created/updated/deleted` sync |
| `topic` | full CRUD | **reference implementation** for new CRUD modules |
| `question` | full CRUD | MongoDB, `Question` model |
| `theory` | 8 endpoints (see `routes/theory-api-spec.md`) | session start / get questions / submit answer (AI-scored) / complete / detail / history / weak-areas / score-trend |

**Modules SPECCED BUT NOT IMPLEMENTED:**
- **`coding`** — full spec at `routes/coding-api-spec.md` (10 endpoints), Postgres schema already has
  `CodingSession` / `CodingQuestion` / `CodingAnswer`. But **no `server/src/modules/coding/` folder**,
  no Piston wired into the server. (Piston container scripts exist at repo root: `pnpm piston:start/setup/status/stop`.)

**Not started at all (docs/README only):** analytics, chatbot, payments (Razorpay),
PDF/library (Cloudinary), email (Resend), notifications.

**Theory module gaps even where implemented:**
- `mode: "weak"` and `mode: "pdf"` just pull from the Mongo `Question` bank filtered by difficulty.
  **No AI question generation, no RAG over PDFs.** Only answer *evaluation* uses AI.
- Daily-limit enforcement in `startSession` reads Postgres → non-functional until PG client exists.
- Weak-area threshold is `avgScore < 7` (spec says "below 70%").

### 4b. Frontend (`ui/`) — React 19 + Vite

**Almost nothing built.** Real pages: `SignInPage`, `SignUpPage`, `DashboardPage` (stub — shows
Clerk user id / email / created date), `SettingsPage`. Clerk auth gating works (`App.tsx`
`ProtectedRoute`/`PublicRoute` via `SignedIn`/`SignedOut`). `useApiClient()` (`ui/src/lib/api.ts`,
ky + auto bearer token, prefixed `${VITE_API_BASE_URL}/api/v1`) is wired; `getMe()` called on
dashboard mount. Redux Toolkit + TanStack Query configured but barely used. Shadcn UI + Tailwind v4.

**The entire rich UI from the README lives only in `prepai-ui.html`** — none ported to React.

---

## 5. The plan going forward

Build features in this order; each unlocks a system design concept.

| # | Build | System design concept to learn |
|---|---|---|
| 1 | Fix Postgres/Prisma setup so theory module runs | **Polyglot persistence** — why relational for sessions/answers, document for users/questions |
| 2 | Implement the `coding` module (spec is ready) | **Sandboxed execution, job/queue design, rate limiting & quota enforcement** (daily limits) |
| 3 | AI question generation for weak/PDF modes | **RAG pipeline, vector storage, prompt/cost budgeting, caching** |
| 4 | Analytics endpoint + real React Dashboard | **Read models / denormalization / aggregation** (compute-on-read vs materialized) |
| 5 | Payments (Razorpay) | **Webhooks, idempotency, state machines** |

**Recommended immediate start: #1 then #2.** #1 unblocks existing theory code; #2 is fully specced.

**Working style:** Use the `superpowers:brainstorming` skill before starting any feature build
(explore intent/requirements/design before code). Then TDD. Keep me learning the concept as we go.

---

## 6. Key commands (from `CLAUDE.md`)

```bash
# Server (from server/)
pnpm start:dev                    # watch mode, loads ../.env
pnpm test                         # vitest unit
pnpm prisma:generate              # generates BOTH clients  <-- needed to unblock theory
pnpm prisma:push:postgresql       # push PG schema
pnpm prisma:push:mongodb

# UI (from ui/)
pnpm dev                          # http://localhost:5173

# Piston (from root) — needs Podman Desktop running
pnpm piston:start / piston:setup / piston:status / piston:stop

# E2E (from root)
pnpm test
```

Swagger: `http://localhost:3000/docs`. API base: `http://localhost:3000/api/v1`.

---

## 7. Session log

### 2026-08-29 — Setup + System Design Architecture Review
- Set up environment and completed deep codebase and architecture review (`SYSTEM_DESIGN_REVIEW.md`).
- Verified core architectural foundations: MongoDB + PostgreSQL polyglot persistence, Clerk webhook synchronization, NestJS Fastify backend, Mastra AI agents, Piston code sandbox, and Redis caching/queuing are solid for 100M user scale.
- Clarified feature scope: retained core Theory, Coding Sandbox, RAG on PDFs, Weakness Analytics, and Payments; omitted generic ChatMessage collection and real-time WebRTC peer interviews.
- Created canonical **`docs/architecture.md`** containing C4 Model diagrams (Context, Container, Component) and 3 core sequence diagrams in Mermaid.js.
- Created interactive standalone **`docs/architecture-viewer.html`** with high-definition vector graphics, dark theme UI, and SVG pan-zoom controls.
- Next step: Plan Item #1 — Fix Postgres/Prisma setup and learn Polyglot Persistence concepts.

---

## 8. End-of-session checklist (update this file before ending)

- [x] Add a dated entry to §7 Session log — what was built, decisions made, what's next
- [ ] Update §4 if module/feature status changed
- [ ] Update §5 if the plan/priorities shifted
- [x] Update the "Last updated" date at the top
- [ ] Note any new blockers prominently (like the ⚠️ in §4a)

