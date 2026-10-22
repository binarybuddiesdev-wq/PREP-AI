# PrepAI Frontend (ui/) Architecture

Canonical description of `ui/src`. The decision and its rationale are in [ADR-0009](../adr/0009-frontend-layers.md); the original plan is [ADR-0008](../adr/0008-frontend-n-tier.md). Each layer folder also has a short `CLAUDE.md` with its local rules.

## 1. Layers and import rules

A layer may import only from layers listed before it. `app` may import everything.

| Layer        | Purpose                                                      | May import                                            |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------------- |
| `core`       | types, constants, route names, env                           | nothing                                               |
| `utils`      | pure helpers                                                 | `core`                                                |
| `service`    | external I/O: HTTP client, endpoint functions, Clerk adapter | `core`, `utils`                                       |
| `data`       | client-side state (Redux store)                              | `core`, `utils`                                       |
| `logic`      | Reader/Command hooks over TanStack Query                     | `core`, `utils`, `service`, `data`                    |
| `components` | presentational only: props in, events out                    | `core`, `utils`                                       |
| `pages`      | route shells composing `logic` and `components`              | `core`, `logic`, `components`, `service/auth` widgets |
| `app`        | providers, routes, route guards                              | all                                                   |

`components/ui/` (shadcn primitives) imports `utils` only.

## 2. Reader / Command hooks

- **Reader** (`use<Thing>Reader`): a `useQuery` wrapper. It gets the client from `useApiClient()`, calls a `service/api` function, and is gated on the session (`enabled: isLoaded && isSignedIn`).
- **Command** (`use<Thing>Command`): a `useMutation` wrapper that invalidates the matching key from `<resource>.keys.ts` on success.
- Pages never call `service/api` directly, and components never fetch.

## 3. Folder layout

```
ui/src/
  app/         App, AppProviders, AppRoutes, RouteGuards
  components/  auth, dashboard, form, layout, settings, ui (shadcn)
  core/        api, user, env.ts, routes.ts
  data/        store
  logic/       api, auth, user, queryClient.ts
  pages/       DashboardPage, SettingsPage, SignInPage, SignUpPage
  service/     api (ky client, user.api.ts), auth (Clerk adapter, widgets)
  utils/       cn.ts, formatDate.ts
```

Conventions: arrow-function components with `X.tsx` + `X.types.ts` (props `IXProps`), a barrel `index.ts` per folder, named exports for pages.

## 4. Enforcement

- ESLint `no-restricted-imports` per layer in `ui/eslint.config.js` (mechanical).
- `ui-architect-review` checks the rest (judgment): Reader/Command shape, state placement, accessibility.
- Vitest tests live beside the code (`*.test.ts(x)`).

## 5. Anti-patterns

- `fetch`/`ky` outside `service/`.
- Server state in Redux.
- Business logic in components or `service/`.
- Default-exported pages.
- Inline query-key arrays.
