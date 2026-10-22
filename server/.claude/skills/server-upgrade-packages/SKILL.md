---
name: server-upgrade-packages
description: Use when upgrading, bumping, adding or removing an npm dependency in the PrepAI server/ package (NestJS, Fastify, Prisma, Mastra, Clerk SDK, Vitest). Covers breaking-change analysis, approval before install, ecosystem groups, and the verification gate. Frontend dependencies use ui-upgrade-packages.
---

# Upgrade Packages (server)

`server/` has its own `package.json`, its own `pnpm-lock.yaml` and its own `pnpm-workspace.yaml` (the `allowBuilds` policy). There is no root workspace. An upgrade here never touches the lockfile of `ui/` or the root. This skill exists because a bare `pnpm up`, or an agent "helpfully" bumping a version while fixing something else, is the easiest way to break a module nobody was looking at. The frontend has `ui-upgrade-packages`; the root tooling packages (`eslint`, `prettier`, `husky`, `commitlint`, `@playwright/test`) follow the same process from the repo root.

## When to use

- Upgrading, adding or removing a dependency in `server/`
- A vulnerability advisory (`pnpm audit`) against a server dependency
- The user asks "can we upgrade X"

## 1. Preflight

1. Require a clean working tree under `server/`. Stop if `git status` shows uncommitted changes there.
2. Branch off `main`: `chore/upgrade-server-deps-YYYY-MM-DD`.
3. Record a baseline **before any change**: run `server-verify-implementation` Tier 1 (including `pnpm prisma:generate` first). A failure present on `main` is not blamed on the upgrade.
4. List candidates with `pnpm outdated` in `server/`. For a security-driven upgrade, run `pnpm audit` first.
5. Never use `git stash`.

## 2. Analyse before touching anything

For each candidate, before editing `package.json`:

- **Patch** (`x.y.Z`): read the changelog entries between current and target. Usually safe to batch.
- **Minor** (`x.Y.z`): read the changelog for new deprecations; confirm none appear in the post-install check.
- **Major** (`X.y.z`), or a `0.x` minor: **always** read the migration guide and get the user's approval before installing, however small the diff looks.
- **Grep the repo for usages** before approving a major: `grep -rn "from '<pkg>'" server/src`.
- If a subagent researches a package, it reports **with evidence** (changelog links, migration-guide quotes). "No release notes found" is not licence to call it safe; treat it as needs-manual-review.

### Ecosystem groups move together, never partially

| Group          | Packages                                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NestJS         | `@nestjs/common`, `core`, `platform-fastify`, `config`, `swagger`, `cache-manager`, `schedule`, `event-emitter`, `testing`, `cli`, `schematics`; check peers `rxjs`, `reflect-metadata`, `nestjs-pino`   |
| Fastify        | `fastify` and every `@fastify/*` (`cors`, `helmet`, `multipart`, `rate-limit`, `static`). Plugins assert the Fastify version only at **registration**, so a mismatch is a boot-time crash the specs miss |
| Prisma         | `prisma` (dev) and `@prisma/client`, and **both** schemas must still generate: `pnpm prisma:generate`                                                                                                    |
| Mastra / AI    | `@mastra/core` and `@ai-sdk/openai`. Read `mastra-ai` first: a router or structured-output change needs its rules re-verified, not just a type-check                                                     |
| Test and build | `vitest` and `@vitest/coverage-v8`; `@swc/core`, `@swc-node/register`, `unplugin-swc`; `typescript`; `tsc-alias`; `tsx`                                                                                  |
| Logging        | `pino`, `pino-pretty`, `nestjs-pino`                                                                                                                                                                     |
| Validation     | `class-validator`, `class-transformer`. Check changed defaults do not weaken the global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`)                                                           |

### Special rules

- **Clerk.** The server uses `@clerk/clerk-sdk-node`. A major bump, or a move to `@clerk/backend`, must be checked against `ui/`'s `@clerk/clerk-react` so the two SDKs stay compatible; raise it with the user.
- **`zod` and `vitest`** are also declared in `ui/`. Keep one major across both packages unless the user approves a split; the two lockfiles do not enforce it.
- **`svix`** verifies the Clerk webhook. A bump needs the webhook controller re-checked.
- **Security-sensitive:** `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cors`, `class-validator`, `svix`, `@clerk/clerk-sdk-node`. Cite the advisory a bump fixes.
- **`@types/node`** stays on the major of the Node version the server runs on.
- **Installed but not used yet** (`razorpay`, `resend`, `cloudinary`): upgrading them proves nothing; do not spend an approval on them.
- **`allowBuilds`.** If pnpm stops on `ERR_PNPM_IGNORED_BUILDS`, stop and tell the user. Never set an entry to `true` yourself.

## 3. Report and approve

Before installing anything, show one table: package, current → target, bump, classification (safe / needs-migration / hold-back), and the evidence.

- Patch and minor upgrades with nothing breaking in the changelog proceed by default.
- Any major, any `0.x` minor, any ecosystem-group bump and anything needs-migration: **ask the user (`AskUserQuestion`)** with three real options: upgrade to target, hold back, skip. Never pick silently.

Nothing is installed before this step completes.

## 4. Install, one group at a time

1. `pnpm add <pkg>@<version>` (`-D` for dev dependencies) in `server/`, then `pnpm install`. Use an **exact version** with no `^` or `~` if the surrounding `package.json` entries are exact; match the file.
2. Apply any approved code migration, loading `nestjs-developer` first.
3. After a Prisma move: `pnpm prisma:generate`.
4. After each group, run `server-verify-implementation` Tier 1, so a failure points to one group.
5. Commit the group with `git-commit` (scope `server`, or `deps` is **not** a scope; use `chore(server): …`). The hooks run; never `--no-verify`.

## 5. Fix loop

For a new failure (not in the baseline), use `superpowers:systematic-debugging` and fix the root cause. Never suppress a type error, skip a spec or lower a coverage threshold to get green. After two failed fix attempts on one group, revert that group (`git revert`), run `pnpm install` and report it as held back with the reason.

## Red flags

- Upgrading a package as a side effect of an unrelated task.
- A major bump installed without the user's approval.
- Moving one member of an ecosystem group alone.
- `^` or `~` introduced into a `package.json` that pins exact versions.
- `pnpm install --no-frozen-lockfile` in CI.
- `git commit --no-verify`, `git stash`.
- Editing another package's lockfile in the same commit unless a cross-package pair (Clerk, zod) genuinely requires it, and saying why in the commit body.
