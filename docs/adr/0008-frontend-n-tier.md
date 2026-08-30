# ADR-0008: Frontend (ui/) N-Tier Layer Model with Reader/Command Hooks

## Status

Accepted, 2026-08-30

## Context

The `ui/` package today is a flat, 4-folder layout (`lib/`, `pages/`,
`components/`, `store/`) with a few files inside each:

- `lib/api.ts` is a god-file holding both the `useApiClient()` hook AND
  the per-resource endpoint functions (`getMe`, `getSettings`,
  `updateSettings`, `setupComplete`).
- `lib/utils.ts` is another god-file.
- `pages/DashboardPage.tsx` calls `useApiClient()` + `getMe` + `useEffect`
  inline, mixing transport, query, and rendering in one component.
- `store/index.ts` is a placeholder RTK store (no slices yet).

The problems this causes:

1. **No seam between transport and page.** An AI agent (e.g. the Mastra
   `TheoryEvaluatorAgent` that drives UI flows programmatically) cannot
   reuse the user-flow logic locked inside `DashboardPage.tsx`'s
   `useEffect`. It has to reimplement the call sequence in its own way.
2. **No reusable Reader/Command unit.** `useQuery` is called inline in
   components; the query key, envelope unwrap, and error mapping are
   scattered. A bug in one place has to be fixed in N places.
3. **Components are coupled to data shape.** `pages/DashboardPage.tsx`
   imports from `@/lib/api` (the network layer). There's no rule that
   says components must be presentational — a junior dev can put
   `useMutation` in a button.
4. **No headless test path.** Every Reader/Command currently lives
   inside a React component, so unit-testing it requires mounting a DOM,
   providing a router, providing a Clerk provider. The agent has no
   cheap way to verify a flow.

The reference App Designer project solves this with a 6-package
monorepo (`core` → `utils` → `data` → `service` → `logic` →
`components`) where:

- `core` = DI tokens, interfaces, contracts
- `utils` = pure helpers
- `data` = state stores, types, transport
- `service` = SDK adapters
- `logic` = headless Commands and read-only ModelReaders
- `components` = presentational UI

We can't mirror that as separate packages (PrepAI is a single-app
monorepo, not a workspace), but the *layer model* transfers cleanly to
subfolders inside `ui/src/`.

## Decision

We will adopt a **7-layer N-Tier model** inside `ui/src/`:

| # | Layer | Directory | Responsibility |
|---|---|---|---|
| 1 | **Core** | `ui/src/core/` | App-wide constants, route names, env-var types, query-key prefix, branded types. No runtime code. |
| 2 | **Utils** | `ui/src/utils/` | Pure helpers — `cn()`, `formatDate()`, `formatNumber()`, validators. Zero React, zero network. |
| 3 | **Data** | `ui/src/data/` | HTTP client (`api-client.ts`), per-resource DTOs, query-key factories, RTK store + slices (client state only), response envelope types. |
| 4 | **Service** | `ui/src/service/` | Reserved for future third-party SDK adapters (Clerk, Stripe, Cloudinary). Deferred until 2nd SDK lands. |
| 5 | **Logic** | `ui/src/logic/` | **Reader hooks** (`useXxxReader()` → `useQuery` wrappers) and **Command hooks** (`useXxxCommand()` → `useMutation` wrappers). One hook per file. Owns query-key invalidation. |
| 6 | **Components** | `ui/src/components/` | Shadcn primitives + feature components. Purely presentational. Receives data via props. |
| 7 | **Pages (UI shell)** | `ui/src/pages/` | Route components. Composes components + logic. The only layer that imports from `data/` and `logic/` directly. |

Three named decisions that fall out of the model:

1. **Component file naming: `PascalCase.tsx`** (`DashboardPage.tsx`,
   `UserCard.tsx`). This overrides the prior `react-developer` skill
   Rule #10 (which said camelCase). The skill was updated in the same
   commit. Rationale: matches the React community default, matches
   Shadcn UI, matches the four existing files, and the file name
   matching the component name removes a "is the file named after the
   export?" question at a glance.

2. **Hook naming: `useXxxReader` / `useXxxCommand`** (not
   `useXxxQuery` / `useXxxMutation`). Rationale: matches the reference
   App Designer project's `useModelReader` / `useCommandExecutor`
   vocabulary; mirrors the `architect-review` skill's terminology
   (Reader/Command rather than Query/Mutation); consistent across reads
   and writes.

3. **`service/` layer deferred until 2nd SDK lands.** Rationale: one
   customer (Clerk) doesn't justify a folder. Clerk stays in its
   current location (`app/` for provider wiring, `lib/` for hooks)
   until a second adapter is needed.

The `architect-review` skill (`.claude/skills/architect-review/SKILL.md`)
encodes the violation list for this model: hard violations (e.g.
`components/` importing from `data/` or `logic/`, `useQuery` called
outside `logic/`, `useApiClient` called outside `data/` or `logic/`)
and soft violations (e.g. resource folder with > 5 hook files, page
exceeding ~150 lines). The skill is read-only and is invoked before
merging any `ui/` branch.

## Consequences

**Easier:**

- An AI agent invokes `useUserReader()` / `useUpdateSettingsCommand()`
  as plain functions inside a test harness (with a mocked QueryClient)
  to verify user flows programmatically — no DOM, no router, no Clerk
  provider needed.
- Reader/Command hooks are unit-testable in isolation, which is the
  basis for AI-driven flow verification.
- A layer violation is caught by `architect-review` *before* it ships,
  not by a human staring at a PR.
- The page becomes a thin composition file: it imports hooks, imports
  components, returns JSX. If a page exceeds ~150 lines, it's a signal
  the page is doing more than composition and needs to be split.
- New resources slot into a known shape: `data/<resource>/` for API
  + types + keys, `logic/<resource>/` for Reader/Command hooks,
  `components/<feature>/` for UI.

**Harder:**

- **One-time refactor cost.** ~8 moves + ~30 new files + 1 ESLint
  config change + 4 page refactors in a single atomic commit. Detailed
  in [`../architecture/frontend-refactor.md`](../architecture/frontend-refactor.md).
- **Boilerplate per resource.** Every resource needs 4 files in
  `data/` (`*.api.ts`, `*.types.ts`, `*.keys.ts`, `index.ts`) and
  2+ files in `logic/` (`useXxxReader.ts`, `useXxxCommand.ts`, `index.ts`).
  For a micro-feature (≤1 query, ≤0 mutations, ≤1 type), the
  `data/` files may be folded into one — see the micro-feature
  exception in the refactor doc.
- **One more skill to remember.** `architect-review` is the new
  pre-merge gate for `ui/` branches, alongside `verify-implementation`.
- **`react-developer` skill Rule #10 was overridden.** Existing files
  were already PascalCase (so no renames were needed during the
  refactor), but a developer reading the old skill would have been
  misled. The skill was updated in the same commit.

## Alternatives considered

- **Stay flat (status quo).** Reject: doesn't solve the seam problem,
  no AI-agent reuse, no headless test path. Not a real alternative.
- **Adopt the App Designer's full pnpm-workspace monorepo (separate
  `packages/core`, `packages/data`, etc.).** Reject: PrepAI is a
  single-app monorepo. The cost of multiple lockfiles, multiple CI
  pipelines, multiple build configurations is not justified for a
  4-page UI. The subfolder model captures the layer rules without
  that cost.
- **Layer the rules into ESLint only (no skill, no doc).** Reject: ESLint
  catches literal import violations but not design violations ("a page
  contains business logic", "a hook file has too many responsibilities",
  "a resource folder has no `keys.ts`"). The `architect-review` skill
  encodes the design-level rules.
- **Use `useXxxQuery` / `useXxxMutation` instead of
  `useXxxReader` / `useXxxCommand`.** Reject: Reader/Command maps 1:1
  to the reference project's vocabulary and the `architect-review`
  skill's terminology. The 60/40 trade-off (conventional React naming
  vs. CQRS-Lite vocabulary) went to the side that keeps the project
  consistent with the reference and gives the AI agent one vocabulary
  to learn.
- **Create `service/clerk/` now.** Reject: one customer doesn't justify
  a folder. Add `service/` when Stripe / Cloudinary / Razorpay land.

## When to revisit

- When the project grows past ~20 pages, re-evaluate whether
  `pages/<feature>/hooks/` is better than `logic/<resource>/` (the
  current model is feature-folder-agnostic; a feature-folder model
  may be more discoverable for a very large codebase).
- When the team grows past ~3 frontend devs, consider extracting
  `data/`, `logic/`, and `components/` into separate workspace
  packages (true N-Tier monorepo, as the reference App Designer does).
- When a 2nd third-party SDK lands (Stripe, Cloudinary, Razorpay),
  add `ui/src/service/`.
- When undo/redo becomes a real product requirement (timeline UI for
  interview answers, perhaps), add `captureUndo`/`undo` to the
  Command hook contract.

## References

- [`../architecture/frontend-refactor.md`](../architecture/frontend-refactor.md) — the granular migration plan, file inventory, folder structure, and anti-patterns
- [`../architecture/architecture.md`](../architecture/architecture.md) — the full-stack monorepo blueprint this layer model sits inside
- [App Designer's `ARCHITECTURE_GUIDE.md`](../../../ARCHITECTURE_GUIDE.md) — the reference project's N-Tier model (919 lines)
- App Designer's `component-designer-spec.md` §"Architecture & Monorepo" — the 6-package pattern this 7-folder model mirrors
- [App Designer's `architect-review` skill](../../../Users/udayn/Downloads/.claude/skills/architect-review/skill.md) — the read-only review protocol this project's skill is modeled on
- [App Designer's ADR-006](../../../Users/udayn/Downloads/.claude/skills/architect-review/skill.md) — UI → Data boundary, ModelReader + CommandExecutor
- [App Designer's ADR-007](../../../Users/udayn/Downloads/.claude/skills/architect-review/skill.md) — Command pattern for all state mutations
- [`../../.claude/skills/architect-review/SKILL.md`](../../.claude/skills/architect-review/SKILL.md) — this project's read-only frontend review skill
- [`../../.claude/skills/react-developer/SKILL.md`](../../.claude/skills/react-developer/SKILL.md) — Rule #10 (PascalCase) updated in the same commit
- [`SYSTEM_DESIGN_REVIEW.md`](../../SYSTEM_DESIGN_REVIEW.md) — the design review that produced the action item to harden the frontend layer model
