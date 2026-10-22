---
name: git-commit
description: Commits staged changes with a conventional commit message that passes PrepAI's commitlint config
---

# Git Commit Rules (PrepAI)

When committing staged changes, always follow the **Conventional Commits** specification. The repo has a `commitlint.config.js` and a `.husky/commit-msg` hook that **enforces** this — an invalid message fails the commit.

## Commit Message Format

```
<type>(<scope>): <short summary>

<body>
```

### Type (required)

Use one of the conventional types:

- `feat` — a new feature
- `fix` — a bug fix
- `docs` — documentation-only changes
- `style` — formatting, missing semicolons, etc. (no logic change)
- `refactor` — code restructuring without fixing a bug or adding a feature
- `test` — adding or updating tests
- `chore` — build process, dependency updates, tooling changes
- `perf` — performance improvements
- `ci` — CI/CD changes

### Scope (optional, but enforced when present)

`commitlint.config.js` sets `scope-enum` and `scope-case: lower-case`, and `.husky/commit-msg` runs commitlint — **an off-list scope fails the commit.** Use one of:

```
server   ui   e2e   root   deps   config   docs   skills   agents   arch
```

**What each scope covers:**

| Scope    | Covers                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `server` | `server/src/**`, `server/package.json`, `server/prisma/**`, `server/vitest.config.ts`                                            |
| `ui`     | `ui/src/**`, `ui/package.json`, `ui/eslint.config.js` (legacy), `ui/vitest.config.ts`, `ui/vite.config.ts`, `ui/components.json` |
| `e2e`    | Root-level Playwright tests (`tests/`, `playwright.config.ts`)                                                                   |
| `root`   | Top-level files: `package.json`, `tsconfig.json`, `.gitignore`, `.gitattributes`, `pnpm-lock.yaml`, README, CLAUDE.md, GEMINI.md |
| `deps`   | Dependency bumps in any `package.json` (without other code changes)                                                              |
| `config` | Tooling config: `eslint.config.js`, `prettier.config.js`, `commitlint.config.js`, `.husky/*`, `.nvmrc`, `.vscode/*`              |
| `docs`   | `docs/**` (architecture docs, ADRs)                                                                                              |
| `skills` | `.claude/skills/**`, `ui/.claude/skills/**`, `server/.claude/skills/**`                                                          |
| `agents` | `.claude/agents/**`                                                                                                              |
| `arch`   | `docs/architecture/**` + `docs/adr/**` together (cross-cutting architecture work)                                                |

**Common mistakes to avoid:**

- `frontend` / `backend` / `api` — not in the enum, use `ui` / `server` instead
- `claude` / `tooling` / `eslint` / `commitlint` for individual config files — use `config`
- `architecture` (singular) — not in the enum, use `arch`

If your change genuinely doesn't fit any listed scope, omit the scope (`docs: …`) rather than inventing one. Adding a scope to the enum is a deliberate config change, not something to do mid-commit.

### Short Summary (required)

- Use imperative mood ("add", not "added" or "adds")
- Do not capitalize the first letter
- No period at the end
- Keep under 72 characters
- `commitlint.config.js` enforces all four rules via `subject-case`, `subject-full-stop`, and `header-max-length`

### Body (required when multiple files or non-trivial changes)

- Separate from the summary with a blank line
- Explain **what** changed and **why**, not how
- Wrap lines at 72 characters
- Reference related ADRs (`ADR-0008: Frontend N-Tier layer model`), skills (`server-architect-review`, `ui-architect-review`), or docs (`docs/architecture/frontend-refactor.md`) when relevant

## Process

1. Run `git diff --staged` to review all staged changes before writing the message
2. Determine the appropriate type and scope from the diff (use the table above)
3. Write the commit message following the format above
4. Commit. For a subject-only message, `git commit -m "<message>"` is fine. For anything with a body, pipe a heredoc instead — a body containing backticks, quotes, `$`, or `!` gets mangled by shell interpolation inside `-m`:

   ```bash
   git commit -F- <<'EOF'
   fix(server): handle expired refresh token gracefully

   Body line one.
   Body line two.
   EOF
   ```

   The quotes around `'EOF'` are what disable interpolation — do not omit them.

5. If commitlint rejects the message, fix the message; do **not** pass `--no-verify`.
6. The `pre-commit` hook (`.husky/pre-commit`) also runs `lint-staged` on staged files. If ESLint or Prettier reformats your files, the commit will fail. Run `pnpm lint:fix` and `pnpm format` to pre-empt this.

## Examples

Single-line (small change):

```
fix(server): handle expired refresh token gracefully
```

Multi-line (larger change):

```
feat(server): add pagination to /users endpoint

Return results in pages of 25 by default. Accepts `page` and
`per_page` query parameters. Includes `X-Total-Count` header
in the response for client-side page calculation.
```

Layer-boundary violation fix (cross-references ADR):

```
fix(ui): enforce 7-layer import boundaries in eslint config

Adds no-restricted-imports rules per ADR-0008. Components/
no longer imports from data/ or logic/. utils/ and core/
cannot import from any other layer. Catches the cheap
violations at lint time; the rest still goes through
the stack architect-review skills.

Per docs/architecture/frontend-refactor.md §2.
```

## Pitfalls

- **Don't use `git commit --no-verify`** to skip the hooks. The hooks catch real issues (lint violations, non-conventional messages). If a hook is failing for the wrong reason, fix the hook, don't bypass it.
- **Don't put the scope in the type slot.** `chore(config): …` is correct; `config: …` or `config(eslint): …` will fail because `config` is a scope, not a type. Types must be standard (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `build`, `style`).
- **Don't use periods in the summary.** `feat(ui): add login.` is rejected; `feat(ui): add login` passes.
- **Don't capitalize the first letter of the summary.** `feat(ui): Add login` is rejected; `feat(ui): add login` passes.
- **Don't use past tense in the summary.** `feat(ui): added login` reads as documentation; `feat(ui): add login` reads as a command.
