<!--
Fill every section that applies. Keep it tight — the merge-bot and reviewers
read this. Delete sections that do not apply.
-->

## Summary

<!-- One sentence. What does this PR do and why? -->

## Linked issues / ADRs

<!--
Link the issue, ticket, or ADR this PR implements or moves forward.

Examples:
- Fixes #123
- Closes #456
- Refs ADR-0009 (Frontend layers)
- Refs docs/architecture/services.md
-->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation only (no code change)
- [ ] Refactor (no functional change)
- [ ] Test only
- [ ] Chore / tooling
- [ ] ADR (new or superseded)

## Scope

<!-- Tick every box that this PR touches. Helps reviewers route the PR. -->

- [ ] `server/` (NestJS API)
- [ ] `ui/` (React frontend)
- [ ] `prisma/` (Mongo or Postgres schema)
- [ ] `mastra/` (AI agents)
- [ ] `routes/` (API specs)
- [ ] `docs/` (architecture, ADRs)
- [ ] `.claude/` (skills / agents / settings)
- [ ] `.github/` (CI, templates, workflows)
- [ ] Repo hygiene (config, scripts, dependencies)

## Layer boundaries (ui/)

<!-- Required for ui/ changes. Skip if backend-only. -->

- [ ] Imports respect the 7-layer N-Tier model (`docs/architecture/frontend-refactor.md` §2)
- [ ] `data/` files do not import from `logic/`
- [ ] `components/` files do not import from `data/` or `logic/`
- [ ] `utils/` and `core/` are leaves (no layer imports)

## AI / prompt changes

<!-- Required for any change to server/src/mastra/*, prompts, schemas, or AI agents. -->

- [ ] Prompt version bumped or ADR linked
- [ ] Schema change documented in `mastra/<agent>.types.ts`
- [ ] Eval set updated (see TODO.md §3)
- [ ] Provider routing unchanged or `LLM_PROVIDER` env var documented

## Database changes

<!-- Required for any change to server/prisma/*. Skip if none. -->

- [ ] Mongo (`schema.prisma`) only — no Postgres side effects
- [ ] Postgres (`schema.postgresql.prisma`) only — no Mongo side effects
- [ ] `prisma:generate` was run locally
- [ ] `prisma db push` (dev) was run and confirmed
- [ ] New columns are indexed if filtered / sorted on
- [ ] New model has `createdAt` / `updatedAt`

## Tests

- [ ] New tests added (controller spec + service spec for new modules)
- [ ] All existing tests still pass (`pnpm test` in `server/` and `ui/`)
- [ ] Coverage holds at 90% (run `pnpm test:coverage` from `server/`)
- [ ] IDOR / multi-tenancy test added for any new user-scoped endpoint
- [ ] I followed the `testing` skill (vitest + `vi.fn()` + `useValue` mocks)

## Screenshots / recordings

<!-- Required for any visible ui/ change. -->

<!--
Drag image here or paste a Markdown image link.
For interactive changes attach a 5–15s screen recording.
-->

## Verification

<!--
Paste real command output, not "I ran it and it worked".

For backend changes:
  $ cd server && pnpm build && pnpm test

For frontend changes:
  $ cd ui && pnpm lint && pnpm build && pnpm test

For repo-wide changes:
  $ pnpm format:check && pnpm lint
-->

```text
<paste output here>
```

## Risks and rollback

<!-- What can go wrong, and how do we undo this PR if it has to be reverted? -->

## Checklist

- [ ] I have read `CLAUDE.md`, `docs/architecture/README.md`, and the relevant skill files
- [ ] My commit messages follow Conventional Commits (`feat(server): …`, `fix(ui): …`)
- [ ] Husky pre-commit ran (`lint-staged`) — staged files were formatted and linted
- [ ] I removed unused imports and dead code
- [ ] I added or updated an ADR for any new architectural decision
- [ ] I did not commit secrets, `.env`, or generated artifacts
