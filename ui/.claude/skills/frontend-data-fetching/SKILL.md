---
name: frontend-data-fetching
description: Use when fetching, caching or mutating server data in the PrepAI ui/ app — useApiClient, the ky client and Clerk token, lib/api.ts endpoint functions, TanStack Query useQuery/useMutation, query keys, loading/error/empty states, or replacing a direct fetch call. Frontend only; the endpoints themselves are designed with api-design.
---

# Frontend Data Fetching

How `ui/` talks to the backend: one client, one cache, one place per concern. Component and file conventions are `react-developer`; testing a fetching component is `frontend-testing`. The endpoint shapes come from `routes/<name>-api-spec.md`.

## The moving parts

- **`useApiClient()`** (`ui/src/lib/api.ts`) returns a `ky` instance prefixed with `${VITE_API_BASE_URL}/api/v1` (default `http://localhost:3000`). Its `beforeRequest` hook reads the Clerk session token with `getToken()` and sets `Authorization: Bearer …`. `throwHttpErrors` is on, so a non-2xx response **throws** a ky `HTTPError` whose `error.response.status` is the status.
- **Endpoint functions** in `lib/api.ts` (`getMe`, `getSettings`, `updateSettings`, `setupComplete`) take the client as their first argument and return the parsed JSON.
- **The response envelope** is `{ success, message, data }`. Today those functions type `data` as `unknown`.
- **Providers** (`main.tsx`, outermost first): `ClerkProvider` → Redux `Provider` → `QueryClientProvider` (a default `new QueryClient()`) → `BrowserRouter`. TanStack Query is installed and wired, but no code uses `useQuery` or `useMutation` yet.

## Non-negotiable rules

1. **Every server call goes through `useApiClient()`.** Never `fetch` or `ky` directly in a component, page or hook.
2. **Server data is TanStack Query**, not `useEffect` + `useState`. Reads are `useQuery`; writes are `useMutation`.
3. **Never touch the token.** No `getToken()` in a page, no hand-built `Authorization` header, nothing in Redux or `localStorage`. The client attaches it.
4. **Query keys come from one factory per resource,** hierarchical arrays that include every parameter: `['users', 'me']`, `['users', 'settings']`, `['questions', { topicId, difficulty }]`. No ad-hoc string literals scattered across components.
5. **Gate queries on Clerk.** `enabled: isLoaded && isSignedIn`, so no request is sent before the token exists.
6. **A mutation refreshes what it changed.** In `onSuccess`, `invalidateQueries({ queryKey })` for every key the write affects. Use an optimistic update only with a rollback in `onError`.
7. **Every request renders three states:** loading (`isPending`), error (`isError`) and empty. A screen with only the happy path is incomplete.
8. **Branch on status, not message text.** Read `error.response.status`; show the server's `message` as display text. A 401 is handled by the Clerk gating (`ProtectedRoute`); do not retry it.
9. **Do not copy server data into Redux.** Redux is for client UI state (sidebar, modal, theme). The query cache is the store for server state.
10. **No `console.log` of responses or tokens.** Surface a failure to the user (`ui-developer` § Failure handling), not to the console.
11. **Type the response.** Replace `data: unknown` with the shape in the route spec, by an `IApiEnvelope<T>` and a type per resource in a `*.types.ts`. Do not scatter casts at call sites.

## The pattern

```ts
// lib/queryKeys.ts
export const userKeys = {
  all: ['users'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  settings: () => [...userKeys.all, 'settings'] as const,
};
```

```tsx
// pages/settings/useUserSettings.ts
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings, useApiClient } from '@/lib/api';
import { userKeys } from '@/lib/queryKeys';
import type { IUpdateSettingsBody } from './settings.types';

export const useUserSettings = () => {
  const api = useApiClient();
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: userKeys.settings(),
    queryFn: () => getSettings(api),
    enabled: isLoaded && isSignedIn,
  });

  const saveSettings = useMutation({
    mutationFn: (body: IUpdateSettingsBody) => updateSettings(api, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.settings() }),
  });

  return { settingsQuery, saveSettings };
};
```

The component renders `settingsQuery.isPending`, `settingsQuery.isError` and the data, and calls `saveSettings.mutate(body)`.

## Where things live (interim)

`docs/architecture/frontend-refactor.md` puts API access in `data/` and hooks in `logic/`. **Those folders do not exist yet.** Until the refactor lands:

- endpoint functions stay in `lib/api.ts` (split into `lib/<resource>.api.ts` when it grows), and key factories in `lib/queryKeys.ts`;
- a hook used by one page or feature lives in that feature's folder (`pages/settings/useUserSettings.ts`); a hook shared by several goes in `lib/`.

Do not create `data/` or `logic/` inside an unrelated feature. If your change needs them, say so in your report.

## Retries and errors

TanStack Query retries failed queries three times by default. For a 4xx that is wasteful and delays the error. Pass a `retry` function that does not retry client errors (`error.response.status < 500`) when you add the first real query, and prefer to set it once on the `QueryClient`. Read the server's message with `await error.response.json()` inside a `try`, and fall back to a generic message if the body is not JSON.

## Known backlog (do not copy, do not flag)

- `pages/DashboardPage.tsx` syncs the user in a `useEffect` and `console.log`s the result.
- `pages/SettingsPage.tsx` calls `fetch` three times with a hand-built `Authorization` header, keeps the data in `useState`, and writes debugging `console.error` lines (including whether a token was retrieved).
- `lib/api.ts` types `data` as `unknown`.

Replace these when a change substantially rewrites the file, or in a dedicated change. New code uses the pattern above.

## Common mistakes

| Mistake                                                | Fix                                           |
| ------------------------------------------------------ | --------------------------------------------- |
| `fetch(url, { headers: { Authorization } })` in a page | `useApiClient()` + an endpoint function       |
| `useEffect(() => { load() }, [])` for server data      | `useQuery`                                    |
| A query that fires before Clerk is ready               | `enabled: isLoaded && isSignedIn`             |
| `queryKey: ['me']` typed in three files                | One key factory                               |
| A mutation that leaves a stale list on screen          | `invalidateQueries` the affected keys         |
| `catch (e) { console.error(e) }`                       | Show an inline error; clear the loading state |
| Branching on `error.message === 'Not found'`           | Branch on `error.response.status`             |
| Copying the fetched user into Redux                    | Read it from the query cache                  |

## When in doubt

Fetch with a query, mutate with a mutation, name the key once, and render all three states.
