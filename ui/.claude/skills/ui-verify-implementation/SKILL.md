---
name: ui-verify-implementation
description: Runs the tiered PrepAI frontend quality gate (lint, format check, type-check and build, unit tests) after a change under ui/ to prove nothing existing is broken. Use after finishing any ui code or config change, before calling the work done, committing or merging.
---

# Verify Implementation (ui)

After finishing any change under `ui/` — before claiming the work is complete and before committing or merging — run the tiered gate below and show real output. The backend has its own copy, `server-verify-implementation`. A change that touches both packages runs both.

The principle is `superpowers:verification-before-completion`: evidence before assertions. Never say "done", "passing" or "works" without the command output behind it.

**Run the gate once per completed unit of work, not once per agent.** When a subagent finishes its piece it runs only the **local check** (below) and reports ready; the orchestrator runs the gate once on the assembled tree. Re-run the affected checks after any later fix: stale evidence never counts for a changed tree.

## Before you run anything

1. `pnpm install` in the repo root and in `ui/`.
2. **If pnpm stops with `ERR_PNPM_IGNORED_BUILDS`** (it names `@clerk/shared`) and offers to write an `allowBuilds` entry, **stop and tell the user.** Never set a package to `true` yourself: that lets its install script run. pnpm 11 runs a dependency check before every script, so until that policy is decided every `pnpm` command in `ui/` can fail the same way. As a stop-gap to run a check, call the binary directly (`node_modules/.bin/vitest run`), and say you did.
3. pnpm may create an untracked `ui/pnpm-workspace.yaml` containing a placeholder when it hits (2). Do not commit it; remove it if you did not mean to create it.

## Levels

| Level                    | When                        | What                                                                                                                                    |
| ------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Quick check**          | while iterating             | `prettier --write` and ESLint on touched files, plus `pnpm vitest run <test file>` for the code you touched. Never enough to say "done" |
| **Tier 1 + owed Tier 2** | the end of the unit of work | the Tier 1 commands below, then the Tier 2 the table owes                                                                               |
| **Full gate**            | before a merge to `main`    | Tier 1 plus every Tier 2 the diff reaches                                                                                               |

## Tier 1 — every ui code or config change

All are non-mutating. **The gate never uses `prettier --write`, `eslint --fix` or `pnpm lint:fix`.**

| #   | Check      | Command              | Where     | Notes                                                                                                                                                                                                                                                                                                                |
| --- | ---------- | -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lint       | `pnpm lint`          | `ui/`     | `eslint . --ext ts,tsx` with `ui/eslint.config.js`                                                                                                                                                                                                                                                                   |
| 2   | Repo lint  | `pnpm lint`          | repo root | The root flat config (what CI's lint job runs)                                                                                                                                                                                                                                                                       |
| 3   | Format     | `pnpm format:check`  | repo root | Prettier, no writes (what CI runs)                                                                                                                                                                                                                                                                                   |
| 4   | Type-check | `pnpm exec tsc -b`   | `ui/`     | **The only real type-check.** `pnpm build` runs plain `tsc`, and the root `tsconfig.json` is solution-style (`files: []`), so that step compiles zero files: a type error does not fail the build. `tsc -b` follows the project references (`tsconfig.app.json` for `src`, `tsconfig.node.json` for the Vite config) |
| 5   | Build      | `pnpm build`         | `ui/`     | `tsc && vite build`; Vite does not type-check                                                                                                                                                                                                                                                                        |
| 6   | Unit tests | `pnpm test -- --run` | `ui/`     | **Never bare `pnpm test`: it is `vitest` in watch mode and never exits.** This is the exact invocation CI uses                                                                                                                                                                                                       |

How to judge a result:

- **Lint warnings do not fail the gate; errors do.** Judge warnings only on lines your change adds.
- **Row 6 with no test files** prints `No test files found, exiting with code 1`. That is the repo's current state, not your regression. Your change owes its own test (`frontend-testing`), and that test makes the command pass.
- **Windows and CRLF.** With `core.autocrlf=true` the working tree has CRLF endings and `pnpm format:check` can flag files you never touched. Judge formatting on touched files with `pnpm exec prettier --check --end-of-line auto <files>`; CI (Linux, LF) is the authority.
- **Root lint can fail on files you did not touch.** If the root `pnpm lint` reports parser errors across the repo rather than rule violations, that is a configuration state to compare with the merge-base (§ Baseline evidence), not something your change caused.

## Tier 2 — when the change reaches these areas

| Tier           | Command                                                                        | Owed when the change touches                                                                                                |
| -------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Playwright E2E | `pnpm test:ui` (or `pnpm test`) from the **repo root**                         | A routed page, the sign-in/sign-up flow, anything a browser smoke test can see                                              |
| Visual check   | `pnpm dev` in `ui/`, open `http://localhost:5173`, exercise the changed screen | Any user-visible change. Type-checking and unit tests verify code, not that the feature works; if you cannot run it, say so |

The root `pnpm test:ui` is Playwright (project `ui`); the `ui/` `pnpm test:ui` is `vitest --ui`. Same name, different tools; check your working directory. Playwright starts the UI with `pnpm dev`, and the backend it needs must be started separately (`server/` has no `dev` script; it is `start:dev`). Say so rather than reporting the tier as passed if the backend was not up.

## What changed → which checks

| What the change touched                                                                                   | Tier 1 rows | Tier 2                                                                                                                  |
| --------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ui/src/**` (component, hook, page, store, lib)                                                           | 1–6         | Visual check; Playwright if a routed flow changed                                                                       |
| `ui/package.json`, `ui/vite.config.ts`, `ui/vitest.config.ts`, `ui/tsconfig*.json`, `ui/eslint.config.js` | 1–6         | Visual check, and ask `frontend-qa-engineer` for a tooling-change review: loosening a rule still passes by construction |
| `ui/.claude/**`, docs only                                                                                | see below   | none                                                                                                                    |
| **Before any merge to `main`**                                                                            | 1–6         | every owed Tier 2                                                                                                       |

When unsure whether a change reaches a tier, run that tier.

## Docs-, skills- or agents-only changes

No application checks. Instead run `pnpm run check:agent-docs`, run `pnpm exec prettier --check --end-of-line auto <changed files>`, confirm every command a changed instruction cites exists in `ui/package.json` or the root `package.json`, and re-read the changed instructions for contradictions with `CLAUDE.md` and the other skills. A **mixed diff** runs both sets.

## Baseline evidence

A failing check is a regression only if it passes on the base. Before saying "pre-existing":

1. Capture the output at the merge-base: `git merge-base main HEAD`, then a throwaway worktree at a **short path** (`git worktree add --detach C:/wt1 <sha>`; install there). Deep paths hit Windows `MAX_PATH`.
2. Compare the same command's output. An untouched failing file is not enough on its own.
3. If you cannot prove it, report the origin as **unverified**. Never switch branches, stash or reset the user's tree to reproduce a baseline, and never silently ignore a red check.
4. Remove the worktree on every exit path.

## Process

1. List what the change touched and pick the rows and tiers from the tables.
2. Iterate with quick checks; fix issues before moving on.
3. Run Tier 1 in table order. Fix before moving on.
4. Run the Tier 2 checks the change owes.
5. **Paste the real pass/fail summary** (test file and test counts) from each command.
6. If something is red: fix the regression, or prove it is pre-existing (§ Baseline evidence).
7. Only after the required checks are green may you claim the work is complete.

## Rules (non-negotiable)

- **Evidence, not assertions.** Real output for every "passing". A skipped tier is reported as skipped, never as passed.
- **Never claim done on a red check you introduced.**
- **Tier 1 is mandatory every time**, however small the change.
- **The gate never autofixes or writes.**
- **For a UI change, say whether you saw it work.** If you could not run the app, say so explicitly instead of claiming success.
- **Once per requested change, on the assembled tree.** Workers run only the local check.
- **No git writes as part of verification.** Verifying never commits, stashes or pushes.
