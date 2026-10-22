---
name: ui-upgrade-packages
description: Use when upgrading, bumping, adding or removing an npm dependency in the PrepAI ui/ package (React, Vite, Tailwind, shadcn, TanStack Query, Redux Toolkit, Clerk, Vitest). Covers breaking-change analysis, approval before install, ecosystem groups, and the verification gate. Backend dependencies use server-upgrade-packages.
---

# Upgrade Packages (ui)

`ui/` has its own `package.json` and its own `pnpm-lock.yaml`. It currently has **no tracked `pnpm-workspace.yaml`**, so pnpm 11's build-script policy is undecided there (see below). An upgrade here never touches the lockfile of `server/` or the root. This skill exists because a bare `pnpm up`, or an agent "helpfully" bumping a version while fixing something else, is the easiest way to break a screen nobody was looking at. The backend has `server-upgrade-packages`; the root tooling packages (`eslint`, `prettier`, `husky`, `commitlint`, `@playwright/test`) follow the same process from the repo root.

## When to use

- Upgrading, adding or removing a dependency in `ui/`
- A vulnerability advisory (`pnpm audit`) against a frontend dependency
- The user asks "can we upgrade X"

## 1. Preflight

1. Require a clean working tree under `ui/`. Stop if `git status` shows uncommitted changes there.
2. Branch off `main`: `chore/upgrade-ui-deps-YYYY-MM-DD`.
3. Record a baseline **before any change**: run `ui-verify-implementation` Tier 1. A failure present on `main` is not blamed on the upgrade.
4. List candidates with `pnpm outdated` in `ui/`. For a security-driven upgrade, run `pnpm audit` first.
5. If pnpm stops with `ERR_PNPM_IGNORED_BUILDS` (it names `@clerk/shared`), **stop and tell the user.** It wants an `allowBuilds` decision; never set an entry to `true` yourself, and do not commit the placeholder `ui/pnpm-workspace.yaml` pnpm may create.
6. Never use `git stash`.

## 2. Analyse before touching anything

For each candidate, before editing `package.json`:

- **Patch** (`x.y.Z`): read the changelog entries between current and target. Usually safe to batch.
- **Minor** (`x.Y.z`): read the changelog for new deprecations; confirm none appear in the post-install check.
- **Major** (`X.y.z`), or a `0.x` minor: **always** read the migration guide and get the user's approval before installing, however small the diff looks.
- **Grep the repo for usages** before approving a major: `grep -rn "from '<pkg>'" ui/src`.
- If a subagent researches a package, it reports **with evidence** (changelog links, migration-guide quotes). "No release notes found" is not licence to call it safe.

### Ecosystem groups move together, never partially

| Group               | Packages                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React               | `react`, `react-dom`, `@types/react`, `@types/react-dom`, `react-redux`, `react-router`, `react-hook-form`, `@hookform/resolvers` (check each peer range)                                                                                            |
| Build               | `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `typescript`                                                                                                                                                                                    |
| Tailwind and shadcn | `tailwindcss`, `@tailwindcss/vite`, `tailwind-merge`, `tailwindcss-animate`, `tw-animate-css`, `class-variance-authority`, `clsx`, `shadcn`, `@base-ui/react`. A major here can change generated `components/ui/*`; regenerate rather than hand-edit |
| Test                | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`                                                                                                                                              |
| Lint                | `eslint`, `@eslint/js`, `typescript-eslint`, `globals` (and `eslint-plugin-react-hooks` at the root)                                                                                                                                                 |
| State and data      | `@tanstack/react-query`, `@reduxjs/toolkit`, `react-redux`                                                                                                                                                                                           |

### Special rules

- **Clerk.** `@clerk/clerk-react` must stay compatible with the server's Clerk SDK (`@clerk/clerk-sdk-node`). A major bump here needs the sign-in, sign-up and token flow re-checked (`frontend-data-fetching` § Auth) and the pairing raised with the user.
- **`zod` and `vitest`** are also declared in `server/`. Keep one major across both packages unless the user approves a split; the two lockfiles do not enforce it.
- **`ky`** powers `useApiClient`. A bump needs the token hook (`beforeRequest`) and `throwHttpErrors` behaviour re-checked.
- **`@types/node`** stays on the major of the Node version the project runs on.
- **Bundle size.** A new runtime dependency ships to every visitor; justify it, and prefer what is already in the tree.

## 3. Report and approve

Before installing anything, show one table: package, current → target, bump, classification (safe / needs-migration / hold-back), and the evidence.

- Patch and minor upgrades with nothing breaking in the changelog proceed by default.
- Any major, any `0.x` minor, any ecosystem-group bump and anything needs-migration: **ask the user (`AskUserQuestion`)** with three real options: upgrade to target, hold back, skip. Never pick silently.

Nothing is installed before this step completes.

## 4. Install, one group at a time

1. `pnpm add <pkg>@<version>` (`-D` for dev dependencies) in `ui/`, then `pnpm install`. Use an **exact version** with no `^` or `~` if the surrounding `package.json` entries are exact; match the file.
2. Apply any approved code migration, loading `react-developer` first.
3. After each group, run `ui-verify-implementation` Tier 1, and load the app (`pnpm dev`) to check the screens the package touches. A passing build does not prove the UI works.
4. Commit the group with `git-commit` (`chore(ui): …`; there is no `deps` scope). The hooks run; never `--no-verify`.

## 5. Fix loop

For a new failure (not in the baseline), use `superpowers:systematic-debugging` and fix the root cause. Never suppress a type error, skip a test or add an ESLint disable to get green. After two failed fix attempts on one group, revert that group (`git revert`), run `pnpm install` and report it as held back with the reason.

## Red flags

- Upgrading a package as a side effect of an unrelated task.
- A major bump installed without the user's approval.
- Moving one member of an ecosystem group alone.
- `^` or `~` introduced into a `package.json` that pins exact versions.
- Hand-editing `components/ui/*` after a shadcn bump instead of regenerating.
- `pnpm install --no-frozen-lockfile` in CI.
- `git commit --no-verify`, `git stash`.
- Editing another package's lockfile in the same commit unless a cross-package pair (Clerk, zod) genuinely requires it, and saying why in the commit body.
