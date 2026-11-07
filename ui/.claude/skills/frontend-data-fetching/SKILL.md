---
name: frontend-data-fetching
description: Use when fetching, caching or mutating server data in the PrepAI ui/ app — useApiClient, the ky client and Clerk token, service/api/ endpoint functions, TanStack Query useQuery/useMutation, query keys, loading/error/empty states, or replacing a direct fetch call. Frontend only; the endpoints themselves are designed with api-design.
---

# Frontend Data Fetching

How `ui/` talks to the backend: one client, one cache, one place per concern. Component and file conventions are `react-developer`; testing a fetching component is `frontend-testing`. The endpoint shapes come from `routes/<name>-api-spec.md`.

## The moving parts

- **`useApiClient()`** (`ui/src/service/api/`) returns a `ky` instance prefixed with `${VITE_API_BASE_URL}/api/v1` (default `http://localhost:3000`). Its `beforeRequest` hook reads the Clerk session token with `getToken()` and sets `Authorization: Bearer …`. `throwHttpErrors` is on, so a non-2xx response **throws** a ky `HTTPError` whose `error.response.status` is the status.
- **Endpoint functions** in `service/api/` (`getMe`, `getSettings`, `updateSettings`, `setupComplete`) take the client as their first argument and return the parsed JSON.
- **The response envelope** is `IApiEnvelope<TData>` (`success`, `message`, `data`); endpoint functions use typed resource responses.
- **Providers** (`AppProviders.tsx`, outermost first): `ClerkProvider` → Redux `Provider` → `QueryClientProvider` (configured by `createQueryClient`) → `BrowserRouter`. Readers and Commands in `logic/` use TanStack Query for server state.

## Non-negotiable rules

1. **Every server call goes through `useApiClient()`.** Never `fetch` or `ky` directly in a component, page or hook.
2. **Server data is TanStack Query**, not `useEffect` + `useState`. Reads are `useQuery`; writes are `useMutation`.
3. **Never touch the token.** No `getToken()` in a page, no hand-built `Authorization` header, nothing in Redux or `localStorage`. The client attaches it.
4. **Query keys come from one factory per resource,** hierarchical arrays that include every parameter, including the Clerk user ID for user-owned data. No ad-hoc string literals scattered across components.
5. **Gate queries on Clerk.** `enabled: isLoaded && isSignedIn`, so no request is sent before the token exists.
6. **A mutation refreshes what it changed.** In `onSuccess`, `invalidateQueries({ queryKey })` for every key the write affects. Use an optimistic update only with a rollback in `onError`.
7. **Every request renders three states:** loading (`isPending`), error (`isError`) and empty. A screen with only the happy path is incomplete.
8. **Branch on status, not message text.** Read `error.response.status`; show the server's `message` as display text. A 401 is handled by the Clerk gating (`ProtectedRoute`); do not retry it.
9. **Do not copy server data into Redux.** Redux is for client UI state (sidebar, modal, theme). The query cache is the store for server state.
10. **No `console.log` of responses or tokens.** Surface a failure to the user (`ui-developer` § Failure handling), not to the console.
11. **Type the response.** Replace `data: unknown` with the shape in the route spec, by an `IApiEnvelope<T>` and a type per resource in a `*.types.ts`. Do not scatter casts at call sites.

## The pattern

```ts
// logic/<resource>/<resource>.keys.ts
export const userKeys = {
  all: ['users'] as const,
  me: (userId: string) => [...userKeys.all, userId, 'me'] as const,
  settings: (userId: string) => [...userKeys.all, userId, 'settings'] as const,
};
```

```tsx
// logic/user/useUserSettings.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IUpdateSettingsBody } from '@/core';
import { getSettings, updateSettings, useApiClient } from '@/service/api';
import { useSessionReader } from '../auth';
import { userKeys } from './user.keys';

export const useUserSettings = () => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: userKeys.settings(userId),
    queryFn: () => getSettings(api),
    enabled: isLoaded && isSignedIn && Boolean(userId),
  });

  const saveSettings = useMutation({
    mutationFn: (body: IUpdateSettingsBody) => updateSettings(api, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.settings(userId) }),
  });

  return { settingsQuery, saveSettings };
};
```

The component renders `settingsQuery.isPending`, `settingsQuery.isError` and the data, and calls `saveSettings.mutate(body)`.

## Where things live

Per ADR-0009:

- the `ky` client and endpoint functions (`getMe`, `getSettings`, …) are in `service/api/`, one `<resource>.api.ts` per resource; they take the client as the first argument;
- Readers (`use<Thing>Reader`) and Commands (`use<Thing>Command`) are in `logic/<resource>/`, with key factories in `<resource>.keys.ts`;
- pages call Readers and Commands only, never `service/api`; components never fetch.

## Retries and errors

The app's `createQueryClient()` retries server errors and network failures up to two times, but does not retry HTTP client errors (4xx). Keep this policy centralized; use `retry: false` only for queries where repeating the request is specifically undesirable. Parse server error details in the service/API error mapper and retain a safe fallback when the response body is malformed.

## Current implementation

The old backlog of direct `fetch` calls, manually attached Clerk tokens, untyped API envelopes, and unused TanStack Query has been resolved. Screens compose Readers and Commands from `logic/`; user-scoped query keys include the authenticated Clerk user ID to prevent cached profile or settings from appearing after an account switch.

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
