---
name: verify-implementation
description: Runs the tiered test suite after an implementation to verify nothing existing is broken in the PrepAI monorepo
---

# Verify Implementation

After finishing any code implementation or bugfix — before claiming the work is complete and before committing or merging — run the tiered test gate below to prove nothing existing is broken.

**Run this once per completed unit of work, not once per agent.** The gate fires at the boundary of a whole task — after all the pieces are implemented and assembled. When an individual subagent finishes its piece, do **not** run the gate for it; just continue with the ongoing work. If a task is split across several subagents, the tiered suite runs a single time at the end of the whole task.

The underlying principle is `superpowers:verification-before-completion`: evidence before assertions. Never say "done", "passing", or "works" without the actual command output to back it up.

## Test Tiers

All commands run from the repo root or the relevant package directory.

### Tier 1 — Always (fast gate)

Run these after **every** implementation, no exceptions:

#### Server (`server/`)

1. `pnpm format` — Prettier. Fix any formatting issues.
2. `pnpm build` — `tsc + tsc-alias`. Verify the project compiles without errors.
3. `pnpm test` — Vitest run (unit tests, `src/**/*.spec.ts`). Fix any failing tests.

#### UI (`ui/`)

1. `pnpm format` — Prettier. Fix any formatting issues.
2. `pnpm lint` — ESLint. Fix any lint errors.
3. `pnpm build` — `tsc && vite build`. Verify the project compiles without errors.
4. `pnpm test` — Vitest run (unit tests). Fix any failing tests.

#### Full monorepo

After changes touch both `server/` and `ui/`, run both package suites.

### Tier 2 — When relevant / before merge

These are slow; run them only when the change reaches these areas, and always before a merge:

- `pnpm test:e2e` — Playwright end-to-end tests (from repo root). Spins up both `ui` and `server` dev servers. Auto-boots the dev servers.
- `pnpm test:coverage` — Vitest coverage (v8, 90% thresholds on lines/statements/functions/branches). Run from `server/` or `ui/` as appropriate.

## What changed → which tiers

| What the change touched                    | Tier 1                       | Tier 2                                                         |
| ------------------------------------------ | ---------------------------- | -------------------------------------------------------------- |
| `server/src/modules/<name>/*` (any module) | ✅ format, build, test       | `pnpm test:e2e` if API endpoints changed                       |
| `server/src/common/*` (shared utilities)   | ✅ format, build, test       | `pnpm test:e2e` if shared behavior affects e2e flows           |
| `server/prisma/*` (schemas)                | ✅ format, build, test       | `pnpm prisma:generate` + `pnpm test:e2e` if data model changed |
| `ui/src/**/*` (any frontend file)          | ✅ format, lint, build, test | `pnpm test:e2e` if UI flows changed                            |
| `server/src/mastra/agents/*` (AI agents)   | ✅ format, build, test       | `pnpm test:e2e` if agent behavior affects API responses        |
| **Before any merge to main**               | ✅ all Tier 1 commands       | ✅ `pnpm test:e2e` + `pnpm test:coverage`                      |

When unsure whether a change reaches a Tier 2 area, run that tier.

## Process

1. Identify what the change touched and select the tiers from the table above.
2. Run Tier 1 in order (format → lint → build → test). Fix issues before moving on.
3. Run any required Tier 2 suites.
4. **Paste the real pass/fail summary** from each command as evidence.
5. If a suite is red:
   - Fix the regression, or
   - If (and only if) the failure is pre-existing and unrelated to your change, state that explicitly and show it was already failing on the base branch. Do not silently ignore it.
6. Only after the required tiers are green may you claim the work is complete.

## Rules (non-negotiable)

- **Run from the correct directory** — `server/` for server tests, `ui/` for frontend tests, repo root for `pnpm test:e2e`.
- **Evidence, not assertions** — real command output for every claim of "passing".
- **Never claim done on a red suite.** A regression you introduce blocks completion.
- **Tier 1 is mandatory every time.** Skipping it is never acceptable, however small the change.
- **Once per task, at the end** — run the gate when the whole unit of work is complete, not after each subagent finishes. Delegated work is covered by this single end-of-task run.
- **Coverage threshold** — `pnpm test:coverage` must show 90% on all four metrics (lines, statements, functions, branches). If a new file drops coverage below 90%, add more test cases before claiming completion.
