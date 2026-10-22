---
name: server-verify-implementation
description: Runs the tiered PrepAI server quality gate (lint, format check, build, spec type-check, unit tests, coverage) after a change under server/ to prove nothing existing is broken. Use after finishing any server code or config change, before calling the work done, committing or merging.
---

# Verify Implementation (server)

After finishing any change under `server/` — before claiming the work is complete and before committing or merging — run the tiered gate below and show real output. The frontend has its own copy, `ui-verify-implementation`. A change that touches both packages runs both.

The principle is `superpowers:verification-before-completion`: evidence before assertions. Never say "done", "passing" or "works" without the command output behind it.

**Run the gate once per completed unit of work, not once per agent.** A unit of work is the whole requested change. When a subagent finishes its piece it runs only the **local check** (below) and reports ready; the orchestrator runs the gate once on the assembled tree. Re-run the affected checks after any later fix: stale evidence never counts for a changed tree.

## Before you run anything

1. `pnpm install` in the repo root and in `server/`.
2. **`pnpm prisma:generate` in `server/`.** Without it the build and most spec files fail with `Cannot find module '.prisma/client/default'` or a missing `generated/postgresql-client`. CI runs it before the build. Re-run it after any `.prisma` schema change.
3. If pnpm stops with `ERR_PNPM_IGNORED_BUILDS` and offers to write an `allowBuilds` entry, **stop and tell the user.** Never set a package to `true` yourself: that lets its install script run. `server/pnpm-workspace.yaml` shows the current policy.

## Levels

| Level                    | When                        | What                                                                                                                               |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Quick check**          | while iterating             | `prettier --write` and ESLint on touched files, plus `pnpm vitest run <spec>` for the code you touched. Never enough to say "done" |
| **Tier 1 + owed Tier 2** | the end of the unit of work | the Tier 1 commands below, then the Tier 2 the table owes                                                                          |
| **Full gate**            | before a merge to `main`    | Tier 1 plus `pnpm test:coverage`, plus every Tier 2 the diff reaches                                                               |

Each command is a whole command, not a hand-picked file list. Only the quick check names files.

## Tier 1 — every server code or config change

All are non-mutating. **The gate never uses `pnpm format`, `pnpm lint:fix` or any `--write`/`--fix`**: a gate that can fix what it checks can pass on code that is not what gets committed.

| #   | Check            | Command                                   | Where     | Notes                                                                                     |
| --- | ---------------- | ----------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| 1   | Lint             | `pnpm lint`                               | repo root | ESLint flat config for the whole repo (what CI runs)                                      |
| 2   | Format           | `pnpm format:check`                       | repo root | Prettier, no writes (what CI runs)                                                        |
| 3   | Build            | `pnpm build`                              | `server/` | `tsc -p tsconfig.build.json`; **excludes specs**                                          |
| 4   | Type-check specs | `pnpm exec tsc --noEmit -p tsconfig.json` | `server/` | Vitest compiles with SWC and never type-checks specs, so this is the only check that does |
| 5   | Unit tests       | `pnpm test`                               | `server/` | `vitest run` over `src/**/*.spec.ts`                                                      |

How to judge a result:

- **Lint warnings do not fail the gate; errors do.** Judge warnings only on lines your change adds.
- **Row 4 can show errors you did not cause.** Act on errors in files **you touched**; compare the rest with the merge-base (§ Baseline evidence) before calling any a regression.
- **Windows and CRLF.** With `core.autocrlf=true` the working tree has CRLF endings and `pnpm format:check` can flag files you never touched. Judge formatting on touched files with `pnpm exec prettier --check --end-of-line auto <files>`; CI (Linux, LF) is the authority.

## Tier 2 — when the change reaches these areas

| Tier                    | Command                                                                        | Owed when the change touches                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Coverage                | `pnpm test:coverage` in `server/` (90% lines, statements, functions, branches) | Any new or changed server logic, and always before a merge                                                                         |
| Prisma generate + specs | `pnpm prisma:generate`, then rows 3–5                                          | `server/prisma/*.prisma`                                                                                                           |
| Playwright E2E          | `pnpm test:server` (or `pnpm test`) from the repo root                         | A route, guard or auth flow a browser or HTTP smoke test can see                                                                   |
| Server e2e (Vitest)     | `pnpm test:e2e` in `server/`                                                   | Only once `server/test/e2e/**/*.e2e-spec.ts` files exist. None do today, and the command exits non-zero with "No test files found" |

Before relying on Playwright: `playwright.config.ts` starts the apps with `pnpm dev`, and **`server/` has no `dev` script** (it is `start:dev`). Start the backend yourself first (`reuseExistingServer` picks it up locally), or say the tier could not boot rather than reporting it passed.

## What changed → which checks

| What the change touched                                                    | Tier 1 rows                 | Tier 2                                                                                                             |
| -------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `server/src/modules/**`, `server/src/common/**`                            | 1–5                         | Coverage; Playwright if an endpoint changed                                                                        |
| `server/src/mastra/**`                                                     | 1–5                         | Coverage                                                                                                           |
| `server/prisma/**`                                                         | 1–5 after `prisma:generate` | Coverage. A green mocked spec does **not** prove database behaviour (`testing`)                                    |
| `server/vitest*.ts`, `server/tsconfig*.json`, `server/pnpm-workspace.yaml` | 1–5                         | Coverage, and ask `backend-qa-engineer` for a tooling-change review: loosening a rule still passes by construction |
| `server/.claude/**`, `routes/*.md`, docs only                              | see below                   | none                                                                                                               |
| **Before any merge to `main`**                                             | 1–5                         | Coverage + every owed Tier 2                                                                                       |

When unsure whether a change reaches a tier, run that tier.

## Docs-, skills- or agents-only changes

No application checks. Instead run `pnpm run check:agent-docs`, run `pnpm exec prettier --check --end-of-line auto <changed files>`, confirm every command a changed instruction cites exists in `server/package.json` or the root `package.json`, and re-read the changed instructions for contradictions with `CLAUDE.md` and the other skills. A **mixed diff** runs both sets.

## Baseline evidence

A failing check is a regression only if it passes on the base. Before saying "pre-existing":

1. Capture the output at the merge-base: `git merge-base main HEAD`, then a throwaway worktree at a **short path** (`git worktree add --detach C:/wt1 <sha>`; install and run `prisma:generate` there). Deep paths hit Windows `MAX_PATH`.
2. Compare the same command's output. An untouched failing file is not enough on its own: a changed dependency can break it.
3. If you cannot prove it, report the origin as **unverified**. Never switch branches, stash or reset the user's tree to reproduce a baseline, and never silently ignore a red check.
4. Remove the worktree on every exit path.

## Process

1. List what the change touched and pick the rows and tiers from the tables.
2. Iterate with quick checks; fix issues before moving on.
3. Run Tier 1 in table order. Fix before moving on.
4. Run the Tier 2 commands the change owes.
5. **Paste the real pass/fail summary** (test file and test counts) from each command.
6. If something is red: fix the regression, or prove it is pre-existing (§ Baseline evidence).
7. Only after the required checks are green may you claim the work is complete.

## Rules (non-negotiable)

- **Evidence, not assertions.** Real output for every "passing". A skipped tier is reported as skipped, never as passed.
- **Never claim done on a red check you introduced.**
- **Tier 1 is mandatory every time**, however small the change.
- **The gate never autofixes or writes.** `pnpm format` and `prettier --write` are for quick iteration only.
- **Once per requested change, on the assembled tree.** Workers run only the local check.
- **No git writes as part of verification.** Verifying never commits, stashes or pushes.
