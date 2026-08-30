# Changelog

All notable changes to PrepAI are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Until the first tagged release lands, the `Unreleased` section is the
single source of truth — every PR should add a bullet here in the same PR
that lands the change.

## [Unreleased]

### Added

- `.editorconfig`, `.dockerignore`, `.vscode/settings.json`, `.vscode/extensions.json`
  for repo-wide editor and container hygiene (see `CONTRIBUTING.md`)
- `.github/PULL_REQUEST_TEMPLATE.md` and `.github/ISSUE_TEMPLATE/{bug,feature,docs,question}.yml`
  with a `config.yml` that disables blank issues
- `SECURITY.md` at the repo root + `.github/SECURITY.md` plus a
  `SECURITY_HALL_OF_FAME.md` placeholder
- `.github/CODEOWNERS` mapping every top-level path to a team handle
  (replace `@prepai/*` with real GitHub teams once they exist)
- `/healthz` (liveness) and `/readyz` (readiness with Mongo / Postgres /
  Redis pings) on the NestJS API; `/health` retained for backward compatibility
- `docs/observability.md` covering logs, metrics, tracing, alerts,
  audit log, and uptime probing
- `docker-compose.yml` for a fully-containerised local stack
  (Mongo 7 + Postgres 16 + Redis 7, plus optional `server` and `ui`
  profiles)
- Idempotent MongoDB seed: `pnpm seed` writes 23 canonical topics
  (12 practice + 11 coding) and a starter question bank; safe to re-run
- `release-it` config (`release.config.cjs`) for Conventional-Commits-driven
  version bumps, changelog generation, and tag publishing

### Changed

- `app.setGlobalPrefix('api/v1', …)` now also excludes `healthz` and
  `readyz` from the API version prefix so external probes don't need to
  know about `/api/v1`
- `.gitignore` no longer ignores `.vscode/` wholesale — only personal
  overrides (`.vscode/settings.local.json`, `tasks.json`, `launch.json`)
  are excluded so the shared settings + extensions stay committed
- `HealthController` routes use explicit path decorators
  (`@Get('health')`, `@Get('healthz')`, `@Get('readyz')`) instead of an
  empty `@Controller()` so `/health` keeps responding at the root and
  `/healthz`/`/readyz` are not nested under `/health`
- `HealthService` now owns a singleton Redis client (created in the
  constructor, disconnected in `onModuleDestroy`) instead of opening a
  new connection on every probe
- `withTimeout` rewritten with `async/await` and `Promise.race` instead
  of `.then().catch()` chains
- `docker-compose.yml` mounts the workspace root files (`package.json`,
  `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json`,
  `eslint.config.js`) into the `server` and `ui` containers so
  `pnpm install --frozen-lockfile` works inside them
- `pnpm seed` scripts corrected to use `../.env` and `../scripts/seed/seed.ts`
  (relative to `server/`), not `../../.env`

### Fixed

- **Breaking:** `GET /health` was returning 404 after the previous change
  because the controller lost its path prefix. Restored.

## How to add an entry

1. Open `CHANGELOG.md` and add a bullet under the appropriate section
   (`Added`, `Changed`, `Fixed`, `Removed`, `Security`).
2. Use a present-tense verb (`add`, `fix`, `bump`, not `added`, `fixed`,
   `bumped`).
3. Reference the relevant file path or skill when it helps
   (`see .claude/skills/...`).
4. The same PR that lands the change should land this bullet — release
   notes written after the fact rot.

## How releases are cut

`pnpm release-it` runs locally or in CI (`release` workflow) and:

1. Reads commit messages since the last tag (Conventional Commits only)
2. Bumps the version in `package.json`, `server/package.json`, and
   `ui/package.json`
3. Moves every `Unreleased` bullet into a dated section above
4. Creates a Git tag and pushes it
5. Opens a GitHub Release with the same notes

For early pre-1.0 releases we stay on `0.x.y` and bump `y` for fixes,
`x` for new features (per SemVer §4).
