# PrepAI Frontend (ui/) N-Tier Refactor Plan

> **Companion to [`architecture.md`](architecture.md)** — the full-stack
> monorepo blueprint. This document governs the `ui/` package's internal
> layer model and the file changes required to implement it.
>
> **Status:** Finalized. Decisions confirmed by user + gemini synthesis
> and captured in [ADR-0008](../adr/0008-frontend-n-tier.md). This is
> the destination the `ui/` refactor is heading to.
>
> **See also:**
>
> - [ADR-0008](../adr/0008-frontend-n-tier.md) — Context, Decision,
>   Consequences, Alternatives
> - [`react-developer/SKILL.md`](../../.claude/skills/react-developer/SKILL.md)
>   — Rule #10 (file naming)
> - [`architect-review/SKILL.md`](../../.claude/skills/architect-review/SKILL.md)
>   — the read-only review skill that enforces this plan

---

## 0. How to read this document

- **§1** — decisions confirmed
- **§2** — the seven layers and what each can import
- **§3** — the Reader / Command hook pattern
- **§4** — folder structure
- **§5** — what the `architect-review` skill checks
- **§6** — migration plan (one atomic commit, verified against `ui/src/`)
- **§7** — anti-patterns rejected
- **§8** — references

---

## 1. Decisions confirmed

| #   | Decision                  | Choice                                                                                                                                | Rationale                                                                                                                                                                                                                      |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Scope**                 | Frontend (`ui/`) only                                                                                                                 | Backend NestJS module structure is already adequate; no full-stack refactor.                                                                                                                                                   |
| 2   | **Component file naming** | **`PascalCase.tsx`** (`DashboardPage.tsx`, `UserCard.tsx`)                                                                            | Overrides the prior `react-developer` skill Rule #10 (was camelCase). Matches the React community default, matches Shadcn UI, matches the four existing files. Skill update is part of the same atomic commit as the refactor. |
| 3   | **Hook file naming**      | `camelCase.ts` (`useUserReader.ts`, `useUpdateSettingsCommand.ts`)                                                                    | Standard React hooks convention.                                                                                                                                                                                               |
| 4   | **Types & barrels**       | `<Name>.types.ts`, `index.ts`                                                                                                         | Per the `react-developer` skill rule #1 (interfaces in separate `.ts` files) and rule #2 (one `index.ts` per folder).                                                                                                          |
| 5   | **Hook naming**           | **`useXxxReader()` for reads, `useXxxCommand()` for writes**                                                                          | CQRS-Lite, matches the reference App Designer project's `useModelReader` / `useCommandExecutor` vocabulary, lets the `architect-review` skill speak one language.                                                              |
| 6   | **`service/` layer**      | **Defer.** Add when the 2nd SDK lands (Cloudinary / Resend / Razorpay).                                                               | One customer doesn't justify a folder. Clerk stays in `app/` (provider wiring) and `lib/` (current location) until a second adapter is needed.                                                                                 |
| 7   | **Reader/Command tests**  | Headless unit tests with mocked `QueryClient` + mocked `getApiClient()`. No DOM mount needed.                                         | Lets the Mastra AI agent verify flows programmatically.                                                                                                                                                                        |
| 8   | **Undo/redo**             | **Deferred.** No `useXxxCommand().undo()`. The hook pattern exists for AI-agent invocation + structural consistency, not for history. | Premature; add when there's a real product need.                                                                                                                                                                               |
| 9   | **Test file location**    | Co-located (`UserCard.test.tsx` next to `UserCard.tsx`)                                                                               | Matches vitest config and `react-developer` skill.                                                                                                                                                                             |
| 10  | **`App.tsx` location**    | `ui/src/App.tsx` (composition root, kept at `ui/src/` root)                                                                           | Single-app monorepo; `apps/<app>/src/` flattening not needed.                                                                                                                                                                  |

---

## 2. The seven layers

| #   | Layer                | Directory            | Responsibility                                                                                                                                                                | May import from                            | Must NOT import from                          |
| --- | -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| 1   | **Core**             | `ui/src/core/`       | App-wide constants, route names, env-var types, query-key prefix, branded types. No runtime code.                                                                             | (nothing)                                  | anything else                                 |
| 2   | **Utils**            | `ui/src/utils/`      | Pure helpers — `cn()`, `formatDate()`, `formatNumber()`, `isValidEmail()`. Zero React, zero network.                                                                          | `core/`                                    | any layer above                               |
| 3   | **Data**             | `ui/src/data/`       | HTTP client (`api-client.ts`), per-resource DTOs, query-key factories, RTK store + slices (client state only), response envelope types.                                       | `core/`, `utils/`                          | `service/`, `logic/`, `components/`, `pages/` |
| 4   | **Service**          | `ui/src/service/`    | _(Deferred — see Decision 6.)_ Reserved for future third-party SDK adapters.                                                                                                  | `core/`, `utils/`                          | `data/`, `logic/`, `components/`, `pages/`    |
| 5   | **Logic**            | `ui/src/logic/`      | **Reader hooks** (`useXxxReader()` → `useQuery` wrappers) and **Command hooks** (`useXxxCommand()` → `useMutation` wrappers). One hook per file. Owns query-key invalidation. | `core/`, `utils/`, `data/`, `service/`     | `components/`, `pages/`                       |
| 6   | **Components**       | `ui/src/components/` | Shadcn primitives + feature components. Purely presentational. Receives data via props.                                                                                       | `core/`, `utils/`, `service/` (when added) | `data/`, `logic/`, `pages/`                   |
| 7   | **Pages (UI shell)** | `ui/src/pages/`      | Route components. Composes components + logic. The only layer that imports from `data/` and `logic/` directly.                                                                | any layer                                  | (top of stack)                                |

### 2.1 The single most important rule

> **`pages/` is the only layer that imports `data/` directly.**
> `components/` is purely presentational and never knows about the API.

This is the PrepAI equivalent of the reference App Designer project's
"UI never imports data models" rule. It is the seam that makes the rest of
the architecture coherent.

### 2.2 What "no data import" means concretely

- A `<UserCard user={user} />` in `components/` does **not** import from
  `@/data/user/`. It only declares `user: IUser` in its props (types only).
- A page in `pages/` does:
  ```ts
  import { useUserReader } from '@/logic/user'; // hook
  import { useUpdateSettingsCommand } from '@/logic/user'; // hook
  import { UserCard } from '@/components/user'; // presentational
  ```
  …and **nothing** from `@/data/` at runtime. Type-only imports from `data/`
  are fine (they're erased at compile time).

---

## 3. The Reader / Command pattern

### 3.1 Reader hook (query)

A Reader hook is a thin wrapper around `useQuery` that owns:

- the query key (from a query-key factory in `data/<resource>/<resource>.keys.ts`)
- the envelope unwrap
- the error mapping
- the type narrowing

```ts
// ui/src/logic/user/useUserReader.ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getApiClient } from '@/data/api-client';
import { getMe } from '@/data/user/user.api';
import { userQueryKeys } from '@/data/user/user.keys';
import type { IUser } from '@/data/user/user.types';

export const useUserReader = (): UseQueryResult<IUser, Error> =>
  useQuery({
    queryKey: userQueryKeys.me(),
    queryFn: async () => {
      const { data } = await getMe(getApiClient());
      return data as IUser;
    },
  });
```

### 3.2 Command hook (mutation)

A Command hook is a thin wrapper around `useMutation` that owns:

- the `mutationFn`
- the `onSuccess` invalidation of related query keys
- the type of the request and response
- the error envelope unwrap

```ts
// ui/src/logic/user/useUpdateSettingsCommand.ts
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { getApiClient } from '@/data/api-client';
import { updateSettings } from '@/data/user/user.api';
import { userQueryKeys } from '@/data/user/user.keys';
import type { IUpdateSettingsBody } from '@/data/user/user.types';

export const useUpdateSettingsCommand = (): UseMutationResult<void, Error, IUpdateSettingsBody> => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => updateSettings(getApiClient(), body).then(() => undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userQueryKeys.me() });
      qc.invalidateQueries({ queryKey: userQueryKeys.settings() });
    },
  });
};
```

### 3.3 Why this matters for the Mastra AI agent

The Mastra agent (in `server/src/mastra/agents/`) needs to drive PrepAI's
UI flows programmatically. Today it can't — every flow is locked inside a
React component. After this refactor:

- An agent invokes `useUserReader()` / `useUpdateSettingsCommand()` as
  plain functions inside a test harness (with a mocked QueryClient) to
  verify flows.
- The hook bodies are unit-testable in isolation: no DOM, no router, no
  Clerk provider needed.
- Agent tools can call these hooks in headless Node tests (with a
  QueryClient created in-process) to assert end-to-end behavior.

### 3.4 The Headless Constraint (where it bends)

The reference App Designer project says "`packages/logic` must never
import `react`." PrepAI **cannot** keep that rule — `useQuery` and
`useMutation` are React hooks. The spirit of the rule survives:
**`logic/` is the only place in `ui/` that imports
`@tanstack/react-query` and calls `getApiClient()`**. Pages import from
`logic/`, never from `@tanstack/react-query` directly. Components don't
even know React Query exists.

---

## 4. Folder structure

```
ui/src/
├── core/                              # §4.1
│   ├── env.ts                         # VITE_API_BASE_URL typed
│   ├── routes.ts                      # ROUTES.dashboard, ROUTES.settings, ...
│   ├── query-prefix.ts                # 'prepai' — central query-key prefix
│   └── index.ts
│
├── utils/                             # §4.2 — pure helpers, no React
│   ├── cn.ts
│   ├── formatDate.ts
│   ├── formatNumber.ts
│   ├── validators.ts                  # isValidEmail, isValidPhone, etc.
│   └── index.ts
│
├── data/                              # §4.3 — HTTP, DTOs, query keys, RTK
│   ├── api-client.ts                  # ky instance + Bearer; getApiClient() singleton
│   ├── envelope.ts                    # IApiEnvelope<T> = { success, message, data }
│   ├── store/                         # RTK store + slices (client state ONLY)
│   │   ├── index.ts                   # configureStore, RootState, AppDispatch
│   │   ├── rootReducer.ts
│   │   └── slices/
│   │       └── ui.slice.ts            # sidebar, theme, modals
│   ├── user/
│   │   ├── user.api.ts                # getMe, getSettings, updateSettings, setupComplete
│   │   ├── user.types.ts              # IUser, ISettings, IUpdateSettingsBody
│   │   ├── user.keys.ts               # userQueryKeys.me(), .settings()
│   │   └── index.ts
│   ├── session/                       # future: coding sessions, theory sessions
│   ├── topic/                         # future: question bank
│   └── index.ts
│
├── service/                           # DEFERRED — see Decision 6
│   └── README.md                      # "Add adapters here when 2nd SDK lands"
│
├── logic/                             # §4.4 — Reader + Command hooks
│   ├── user/
│   │   ├── useUserReader.ts
│   │   ├── useSettingsReader.ts
│   │   ├── useUpdateSettingsCommand.ts
│   │   ├── useSetupCompleteCommand.ts
│   │   └── index.ts
│   ├── session/                       # future
│   ├── topic/                         # future
│   └── index.ts
│
├── components/                        # §4.5 — presentational only
│   ├── ui/                            # Shadcn primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── ...
│   ├── user/
│   │   ├── UserCard.tsx
│   │   ├── UserCard.types.ts
│   │   ├── UserCard.test.tsx
│   │   ├── styles.css
│   │   └── index.ts
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── index.ts
│   ├── settings/                      # presentational settings widgets
│   │   ├── SettingsForm.tsx
│   │   ├── SettingsForm.types.ts
│   │   ├── styles.css
│   │   └── index.ts
│   └── index.ts
│
├── pages/                             # §4.6 — UI shell, the only layer that wires logic
│   ├── DashboardPage.tsx
│   ├── Dashboard/                     # sub-components used only by Dashboard
│   │   ├── DashboardHeader.tsx
│   │   ├── KpiCards.tsx
│   │   ├── RecentSessionsTable.tsx
│   │   ├── styles.css
│   │   └── index.ts
│   ├── SettingsPage.tsx
│   ├── Settings/
│   │   ├── SettingsFormContainer.tsx  # the only one in pages/ that calls a Command hook
│   │   └── index.ts
│   ├── SignInPage.tsx
│   ├── SignUpPage.tsx
│   └── index.ts
│
├── App.tsx                            # Router + Clerk gates + providers composition
├── main.tsx                           # Vite entry
├── test/
│   ├── setup.ts                       # vitest + testing-library + jest-dom
│   ├── render.tsx                     # renderWithProviders(<El />) — QueryClient + Redux
│   └── index.ts
├── assets/                            # images, fonts
├── styles/
│   └── globals.css                    # tailwind directives
└── index.css
```

### 4.1 What goes in `core/`

- `env.ts` — typed Vite env vars (`VITE_API_BASE_URL`, etc.)
- `routes.ts` — `ROUTES = { dashboard: '/', settings: '/settings', signIn: '/sign-in' }` as `as const`
- `query-prefix.ts` — the root TanStack Query key prefix (`['prepai']`)
- Any branded type used across layers (e.g. `type UserId = string & { __brand: 'UserId' }`)

### 4.2 What goes in `utils/`

- `cn()` — Shadcn className helper
- `formatDate`, `formatNumber`, `formatCurrency`
- `isValidEmail`, `isValidPhone`
- Anything pure that doesn't import React

### 4.3 What goes in `data/`

- `api-client.ts` — the `ky` instance with `Bearer` auth + `getApiClient()` for non-React callers (a lazy-initialized singleton that the React `useApiClient()` hook returns the same instance of)
- `envelope.ts` — `IApiEnvelope<T> = { success: boolean; message: string; data: T }` (mirrors the backend's `TransformInterceptor`)
- One folder per backend resource (`user/`, `session/`, `topic/`):
  - `<resource>.api.ts` — pure HTTP functions
  - `<resource>.types.ts` — DTOs, request bodies, response shapes
  - `<resource>.keys.ts` — the query-key factory for that resource
  - `index.ts` — barrel
- `store/` — RTK store + slices for **client-only** state (UI flags, theme, modals). Server state lives in TanStack Query inside `logic/`.

**Micro-feature exception:** A feature with ≤ 1 query, ≤ 0 mutations, and ≤ 1 type may fold `<resource>.api.ts` + `<resource>.types.ts` + `<resource>.keys.ts` into a single `<resource>.api.ts` file. The moment it grows, split.

### 4.4 What goes in `logic/`

- One folder per resource
- `useXxxReader.ts` — wraps `useQuery`
- `useXxxCommand.ts` — wraps `useMutation`
- **One hook per file.** No `useXxxMutations.ts` that exports three hooks.

### 4.5 What goes in `components/`

- `components/ui/` — Shadcn primitives (no business logic)
- `components/<feature>/` — feature components, each folder is:
  ```
  <feature>/
  ├── <Feature>Component.tsx       # one component per file
  ├── <Feature>Component.types.ts  # interface I<Feature>Props { ... }
  ├── <Feature>Component.test.tsx
  ├── styles.css
  └── index.ts                     # barrel
  ```
- **Components are presentational.** They take data via props. They emit
  events via props (onClick, onSubmit, onChange). They don't call hooks from
  `@/logic/`.
- **Components can import from `service/`** (when it lands). If a component
  needs Clerk context, it imports from `@/service/clerk`. That's the
  "adapters" layer, not the "data" layer.

### 4.6 What goes in `pages/`

- `pages/<Page>.tsx` — thin file: imports hooks from `logic/`, imports components from `components/`, returns JSX
- `pages/<Page>/` — sub-components used only by that page
- **Pages are the only place that imports from `data/` (for types) and from `logic/` (for hooks).**

---

## 5. What the `architect-review` skill checks

The skill is read-only. For a UI change, it dispatches one judgment gate.
It flags:

### 5.1 Hard violations (Should-fix)

- **`components/` imports from `data/` or `logic/`** — the layer rule broken
- **`useQuery` / `useMutation` called outside `logic/`** — page or component is doing what hooks should do
- **`useApiClient` / `getApiClient` called outside `data/` or `logic/`** — direct transport access
- **A page contains business logic** (calculations, branching, transforms) beyond composition — extract to a `logic/` hook
- **A component calls a hook from `logic/`** — components must be presentational; raise data via props
- **A `data/<resource>/` file imports from `logic/`** — circular layer
- **A `utils/` file imports from any layer** — `utils/` is a leaf
- **A `core/` file imports from any layer** — `core/` is the bottom
- **Component file not in `PascalCase.tsx`** — violates `react-developer/SKILL.md` Rule #10 (post-refactor)
- **Hook file not in `camelCase.ts`** — violates `react-developer/SKILL.md` Rule #10

### 5.2 Soft violations (Nit)

- A resource folder has more than 5 hook files — consider grouping
- A `components/<feature>/` folder has no `index.ts` — add the barrel
- A page exceeds ~150 lines — split into sub-components
- A `logic/` hook doesn't have a query-key factory entry in `data/<resource>/<resource>.keys.ts` — extract
- A `data/<resource>/` folder is missing `<resource>.types.ts` or `<resource>.keys.ts` and the resource is non-trivial — add them
- A file's exports don't match its name (e.g. `useUserReader.ts` exporting `getUserData`) — rename or split

### 5.3 What the skill does NOT check (out of scope)

- Naming conventions, formatting, JSDoc — handled by `developer` skill
- Presentational rules (arrow functions, no `any`, CSS conventions) — handled by `react-developer` skill
- Backend layer rules — `nestjs-developer` skill
- API contract design — `api-design` skill
- Database rules — `prisma-database` skill
- AI agent rules — `mastra-ai` skill

---

## 6. Migration plan (one atomic commit)

Per user decision: all refactor in one commit, manual push after the skills commit.

### 6.1 Verified against current `ui/src/`

The migration plan was verified against the current `ui/src/` tree on
2026-08-30. Current contents:

```
ui/src/
├── App.css
├── App.tsx
├── assets/
├── components/
│   └── ui/
│       └── button.tsx                ← rename to Button.tsx (PascalCase)
├── index.css
├── lib/
│   ├── api.ts                        ← split into data/api-client.ts + data/user/user.api.ts
│   └── utils.ts                      ← rename to utils/cn.ts
├── main.tsx
├── pages/
│   ├── DashboardPage.tsx             ← keep, extract sub-components to pages/Dashboard/
│   ├── SettingsPage.tsx              ← keep, extract sub-components to pages/Settings/
│   ├── SignInPage.tsx                ← keep as-is
│   └── SignUpPage.tsx                ← keep as-is
├── store/
│   └── index.ts                      ← move to data/store/, split
└── test/
    └── setup.ts                      ← keep
```

### 6.2 Skills update (same commit)

- Update `.claude/skills/react-developer/SKILL.md` Rule #10 ✅ **DONE**
- Write `.claude/skills/architect-review/SKILL.md` based on §5 of this document ✅ **DONE**
- Update `CLAUDE.md` and `GEMINI.md` skill tables to include `architect-review` ✅ **DONE**
- Update `.claude/agents/architect.md` and `frontend-developer.md` to reference the new skill ✅ **DONE**

### 6.3 `ui/` moves/renames (8 ops)

| From                              | To                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `ui/src/lib/api.ts`               | deleted; split into `data/api-client.ts` + `data/user/user.api.ts`                |
| `ui/src/lib/utils.ts`             | `ui/src/utils/cn.ts`                                                              |
| `ui/src/store/index.ts`           | `ui/src/data/store/index.ts` (split into `rootReducer.ts` + `slices/ui.slice.ts`) |
| `ui/src/components/ui/button.tsx` | `ui/src/components/ui/Button.tsx` (PascalCase per Decision 2)                     |

**No page renames needed** — `DashboardPage.tsx`, `SettingsPage.tsx`,
`SignInPage.tsx`, `SignUpPage.tsx` are all already `PascalCase.tsx` per
the new rule.

### 6.4 New files (~30)

**`core/` (4 files):** `env.ts`, `routes.ts`, `query-prefix.ts`, `index.ts`

**`utils/` (5 files):** `cn.ts`, `formatDate.ts`, `formatNumber.ts`, `validators.ts`, `index.ts`

**`data/` (3 files):** `api-client.ts`, `envelope.ts`, `index.ts`

**`data/store/` (3 files):** `index.ts`, `rootReducer.ts`, `slices/ui.slice.ts`

**`data/user/` (4 files):** `user.api.ts`, `user.types.ts`, `user.keys.ts`, `index.ts`

**`service/` (1 file):** `README.md` (placeholder noting the deferral)

**`logic/user/` (5 files):** `useUserReader.ts`, `useSettingsReader.ts`, `useUpdateSettingsCommand.ts`, `useSetupCompleteCommand.ts`, `index.ts`

**`pages/Dashboard/` (5 files):** `DashboardHeader.tsx`, `KpiCards.tsx`, `RecentSessionsTable.tsx`, `styles.css`, `index.ts`

**`pages/Settings/` (2 files):** `SettingsFormContainer.tsx`, `index.ts`

**`test/` (3 files):** `setup.ts`, `render.tsx`, `index.ts`

**Total: ~35 new files** (4+5+3+3+4+1+5+5+2+3 = 35).

### 6.5 Page refactors (the heart of the change)

- **`DashboardPage.tsx`** — replace inline `useApiClient + getMe + useEffect` with `useUserReader()`; split into:
  - `DashboardPage.tsx` (thin composition: hooks → components → JSX)
  - `Dashboard/DashboardHeader.tsx` (presentational, props in)
  - `Dashboard/KpiCards.tsx` (presentational)
  - `Dashboard/RecentSessionsTable.tsx` (presentational)
- **`SettingsPage.tsx`** — replace inline `useApiClient + updateSettings` with `useUpdateSettingsCommand()`; split into:
  - `SettingsPage.tsx` (thin composition)
  - `Settings/SettingsFormContainer.tsx` (the only file in `pages/` that calls a Command hook)
  - `components/settings/SettingsForm.tsx` (presentational, props in)

### 6.6 ESLint config additions (`ui/eslint.config.js`)

- `no-restricted-imports` rules enforcing layer boundaries:
  - `ui/src/components/**` cannot import from `@/data/**` or `@/logic/**`
  - `ui/src/data/**` cannot import from `@/logic/**` (would be circular)
  - `ui/src/utils/**` cannot import from anything outside `@/core/**`
  - `ui/src/core/**` cannot import from anything in `ui/src/`
- `react-hooks/exhaustive-deps` (already present)
- A path-pattern restriction that flags `useQuery`/`useMutation` usage outside `logic/`

### 6.7 Total scope

- ~35 new files
- 4 moves/renames
- 1 ESLint config change
- 4 page refactors
- 1 skill update (`react-developer/SKILL.md` Rule #10) — already done
- 1 new skill (`architect-review/SKILL.md`) — already done
- 2 cross-reference edits (`CLAUDE.md` and `GEMINI.md` skill tables) — already done
- 1 ADR (`docs/adr/0008-frontend-n-tier.md`) — already written
- 1 architecture doc (`docs/architecture/frontend-refactor.md`) — this file
- 1 architecture move (`ARCHITECTURE.md` from root to `docs/architecture/architecture.md`) — done by gemini, per user instruction to keep all architecture docs in `docs/architecture/`

**All in a single atomic commit** (the architecture move is in a separate
commit so the git history is clean).

---

## 7. Anti-patterns rejected

- **"Pages can use `useQuery` for simple cases."** No. The whole point of the Reader pattern is the seam. If a Reader hook is 3 lines, fine — it's still a Reader hook.
- **"`utils/` is a single file with multiple exports."** No. `lib/utils.ts` was a god-file; splitting it into per-function files is the point.
- **"Components can import `IUser` from `@/data`."** Allowed for types (type-only imports are erased at runtime), but discouraged. The canonical `IUser` lives in `@/data/user/user.types.ts`; if it gets used in non-data layers, alias it.
- **"Server state and client state can both be in Redux."** No. Server state lives in TanStack Query (`logic/`). Client state lives in RTK (`data/store/`). The boundary is the QueryClient vs the Store.
- **"Pages can have inline business logic for one-off calculations."** No. If a page does `score = accuracy * 0.7 + speed * 0.3`, that's a `logic/` function. Pages compose; they don't compute.
- **"`pages/` is just a folder for files; it doesn't have its own rules."** No. `pages/` is the only layer that imports from `data/` and `logic/`. It is the seam.
- **"We don't need `service/` for a single Clerk integration."** Correct — that's why Decision 6 defers it.
- **"`core/` is overkill for a few route names."** No. `core/` is also the home for the query-key prefix, env-var types, and any branded type.

---

## 8. References

- [ADR-0008: Frontend N-Tier layer model](../adr/0008-frontend-n-tier.md) — Context, Decision, Consequences, Alternatives
- [`architecture.md`](architecture.md) — full-stack monorepo blueprint (server + ui + piston + e2e)
- The App Designer reference architecture (the source of the N-Tier model that informed this design) — see [ADR-0008's References section](../adr/0008-frontend-n-tier.md#references) for the equivalent citations.
- `CLAUDE.md` (project root) — project overview
- `.claude/skills/developer/SKILL.md` — general dev standards
- `.claude/skills/react-developer/SKILL.md` — presentational rules + Rule #10 (PascalCase) updated in the same commit
- `.claude/skills/nestjs-developer/SKILL.md` — backend, unaffected by this refactor
- `.claude/skills/architect-review/SKILL.md` — the read-only frontend review skill
