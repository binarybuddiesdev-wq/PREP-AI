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
pnpm build                   # tsc && vite build
pnpm test                    # vitest — WATCH mode, never exits; use `pnpm test -- --run` (what CI runs)
pnpm test:ui                 # vitest --ui (not the Playwright `test:ui` at the repo root)
pnpm lint                    # eslint . --ext ts,tsx
```

Run a single test file: `pnpm vitest run src/pages/DashboardPage.test.tsx` (from `ui/`)

`pnpm build` runs plain `tsc`, which compiles **zero files** here (the root `tsconfig.json` is solution-style), so it does not type-check. The real type-check is `pnpm exec tsc -b`. The quality gate (lint, format check, type-check, build, tests, and a look at the running screen) is `ui-verify-implementation`. Do not run it from memory.

If pnpm stops with `ERR_PNPM_IGNORED_BUILDS` (it names `@clerk/shared`), that is an undecided `allowBuilds` policy for `ui/`. Stop and ask; do not set it to `true` yourself.

## Architecture

### Frontend

Routing is React Router with `SignedIn`/`SignedOut` (Clerk) gating `ProtectedRoute`/`PublicRoute` wrappers in `app/RouteGuards.tsx`. Server state goes through TanStack Query; client/global UI state through Redux Toolkit (`data/store`). All API calls go through `useApiClient()` (`service/api/`), a `ky` instance that auto-attaches the Clerk session token as a Bearer header and is prefixed with `${VITE_API_BASE_URL}/api/v1` — don't call `fetch`/`ky` directly from components. UI components follow Shadcn UI conventions (`components.json`, `components/ui/`) with Tailwind v4.

`ui/src` follows the layers in ADR-0009: `core` (types, constants, routes, env), `utils` (pure helpers), `service` (HTTP client, Clerk adapter; no business logic), `data` (Redux store), `logic` (Reader/Command hooks over TanStack Query), `components` (props in, events out; shadcn primitives under `components/ui/`), `pages` (route shells, named exports) and `app` (providers, routes, guards). Lower layers never import from higher ones. Each layer folder exposes an `index.ts` barrel.

### Path aliases

`ui/` uses `@/*` → `src/*`.

### The visual reference

`prepai-ui.html` at the repo root is a self-contained prototype of every screen. Port its visuals into React components; do not redesign them, and do not confuse it with this app.

## Known gaps in the frontend

`ui/` has no tests yet, so each change owes its own (`frontend-testing`). The ESLint layer-boundary rules from ADR-0009 are not enabled yet. Reviews flag only what a diff adds.
