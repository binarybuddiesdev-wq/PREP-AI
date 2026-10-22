# Routing, state, auth and styling conventions

Reference for the `react-developer` skill. How routes are declared, which state tool to use, how Clerk is used, and how styling is layered. Data fetching has its own skill: `frontend-data-fetching`.

## Project-specific conventions

These are the patterns PrepAI already uses. Mirror them.

### Routing

`ui/src/app/App.tsx` declares the route tree. Public routes use `<PublicRoute>`,
authenticated routes use `<ProtectedRoute>`. Both wrap `<SignedIn>` /
`<SignedOut>` from Clerk. New routes follow the same pattern:

```tsx
<Route
  path="/practice"
  element={
    <ProtectedRoute>
      <PracticePage />
    </ProtectedRoute>
  }
/>
```

### State management

- **Server state** (anything fetched from the API): TanStack Query via
  `useQuery` / `useMutation`. The API client (`useApiClient`) handles the
  bearer token automatically.
- **Global UI state** (theme, sidebar collapse, modal open): Redux
  Toolkit via `useAppSelector` / `useAppDispatch`.
- **Form state**: react-hook-form with Zod resolvers. Don't roll your own.
- **Local state** (UI within one component): `useState`.

### Auth

Use Clerk hooks directly:

- `useUser()` for the current user
- `useAuth()` for the session token (rare; `useApiClient` does this for you)
- `useClerk()` for `signOut`, `openSignIn`, etc.
- `<SignedIn>` / `<SignedOut>` for conditional rendering
- `<UserButton />` for the avatar menu

Never store auth tokens in Redux. Never read them manually. `useApiClient`
attaches the bearer token on every request.

### API client

Server data is fetched with TanStack Query through `useApiClient()`. The client, query keys, mutations, error and loading handling, and the current backlog are all in the **`frontend-data-fetching`** skill; read it before calling the API. Never `fetch` or `ky` from a component.

### Styling

The project uses Tailwind v4 + shadcn/ui. Both are available. For new
components, prefer shadcn primitives (`<Button>`, `<Input>`, `<Card>`)
when they exist. Extend them with Tailwind utilities for layout.

The reference UI is in `prepai-ui.html` at the repo root — a self-contained
HTML prototype with all screens designed. Port its visuals to React
components, don't redesign.
