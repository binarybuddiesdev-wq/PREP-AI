# ADR-0009: Frontend layers (core, utils, service, data, logic, components, pages, app)

- Status: Accepted
- Supersedes (in part): [ADR-0008](0008-frontend-n-tier.md)

## Context

ADR-0008 proposed a layered `ui/src` but nothing was implemented: pages were default-exported, `SettingsPage` called `fetch` directly and `lib/` mixed HTTP, helpers and types.

## Decision

`ui/src` is split by purpose. A layer may import only from layers above it in this list.

| Layer        | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `core`       | types, constants, route names, env                             |
| `utils`      | pure helpers                                                   |
| `service`    | external I/O: HTTP client and Clerk adapter, no business logic |
| `data`       | client-side state (Redux store)                                |
| `logic`      | Reader/Command hooks over TanStack Query                       |
| `components` | presentational only: props in, events out                      |
| `pages`      | route shells composing logic and components (named exports)    |
| `app`        | composition root: providers, routes, route guards              |

The deliberate difference from ADR-0008: HTTP lives in `service`, not `data`, because it is external I/O. `data` holds only client state.

## Consequences

- The old `lib/` and `store/` folders are removed; `@/utils` replaces `@/lib/utils` (shadcn alias updated).
- Follow-ups: ESLint layer-boundary rules in `ui/eslint.config.js`, Vitest tests, and a short CLAUDE.md per layer folder.
