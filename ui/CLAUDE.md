# CLAUDE.md — ui/

Guidance for working in the React 19 + Vite frontend (`ui/`). It loads when you work under `ui/`; the repo-wide rules (git, role dispatch, the shared skills) are in the root `CLAUDE.md`. The backend has its own `server/CLAUDE.md`.

## Required skills

Frontend skills live in `ui/.claude/skills/` and are listed only after a file under `ui/` has been read or edited in the session. **Read a file in the area you are about to change first (the page or component you will modify), then invoke the skill.** These are mandatory, not optional.

| When                                                                | Skill                      |
| ------------------------------------------------------------------- | -------------------------- |
| Before writing or modifying any frontend code                       | `ui-developer`             |
| Before creating or changing a component, page, hook, route or style | `react-developer`          |
| Before fetching or mutating server data, or touching `service/api/` | `frontend-data-fetching`   |
| Before writing or changing a `*.test.tsx` / `*.test.ts`             | `frontend-testing`         |
| After finishing an implementation, before calling it done           | `ui-verify-implementation` |
| Before adding, bumping or removing a dependency                     | `ui-upgrade-packages`      |
| Before merging a branch that touches `ui/`                          | `ui-architect-review`      |
| Before creating a git commit (only when asked)                      | `git-commit` (shared)      |

Agents: `frontend-developer` implements; `frontend-architect` and `frontend-qa-engineer` review (root `CLAUDE.md` § Role Dispatch).

## Commands (from `ui/`)

```bash
pnpm dev                     # vite dev server, http://localhost:5173
pnpm build                   # tsc -b && vite build (type-checks both UI projects)
pnpm test                    # vitest — WATCH mode, never exits; use `pnpm test -- --run` (what CI runs)
pnpm test:ui                 # vitest --ui (not the Playwright `test:ui` at the repo root)
pnpm lint                    # eslint . --ext ts,tsx
```

Run a single test file: `pnpm vitest run src/pages/DashboardPage.test.tsx` (from `ui/`)

`pnpm build` runs the project-reference type-check and the production Vite build. `pnpm exec tsc -b` runs only the type-check. The quality gate (lint, format check, type-check, build, tests, and a look at the running screen) is `ui-verify-implementation`. Do not run it from memory.

If pnpm stops with `ERR_PNPM_IGNORED_BUILDS` (it names `@clerk/shared`), that is an undecided `allowBuilds` policy for `ui/`. Stop and ask; do not set it to `true` yourself.

## Architecture

### Frontend

Routing is React Router with `SignedIn`/`SignedOut` (Clerk) gating `ProtectedRoute`/`PublicRoute` wrappers in `app/RouteGuards.tsx`. Server state goes through TanStack Query; shared client state goes through Redux Toolkit (`data/store`), while component-only state stays local. All API calls go through `useApiClient()` (`service/api/`), a `ky` instance that auto-attaches the Clerk session token as a Bearer header and is prefixed with `${VITE_API_BASE_URL}/api/v1` — don't call `fetch`/`ky` directly from components. UI components follow Shadcn UI conventions (`components.json`, `components/ui/`) with Tailwind v4.

`ui/src` follows the implemented layers in ADR-0009: `core` (types, constants, routes, env), `utils` (pure helpers), `service` (HTTP client, Clerk adapter; no business logic), `data` (Redux Toolkit client state), `logic` (Reader/Command hooks over TanStack Query), `components` (props in, events out; shadcn primitives under `components/ui/`), `pages` (named-export route screens, loaded on demand) and `app` (providers, routes, guards). Lower layers never import from higher ones. Each layer folder exposes an `index.ts` barrel where it is a public module boundary.

### Path aliases

`ui/` uses `@/*` → `src/*`.

### The visual reference

`prepai-ui.html` at the repo root is a self-contained prototype of every screen. Port its visuals into React components; do not redesign them, and do not confuse it with this app.

## Current implementation notes

The seven layers described above exist, with colocated Vitest tests, TanStack Query Readers/Commands, typed API envelopes, and Redux slices for client-owned state. Add or update tests for changed behavior. ESLint enforces the import boundaries for `core`, `utils`, `service`, `data`, `logic`, `components`, `pages`, and `app`; keep the rules aligned with ADR-0009 and `docs/architecture/frontend-refactor.md`. Reviews flag only confirmed violations and findings introduced by the change.
