---
name: frontend-testing
description: Use when writing, changing or debugging a unit or component test in the PrepAI ui/ app — Vitest, Testing Library, jsdom, mocking Clerk, the API client or TanStack Query, test setup, or why pnpm test hangs or finds no tests. Frontend only; server specs use the testing skill.
---

# Frontend Testing

How `ui/` tests are written, and the traps in this repo's setup. The gate that runs them is `ui-verify-implementation`.

## The setup

- **Runner:** Vitest 4 with `environment: 'jsdom'` and `globals: true` (`ui/vitest.config.ts`); the alias `@` → `src`.
- **Libraries:** `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` (matchers registered in `src/test/setup.ts`).
- **Discovery:** `**/*.{test,spec}.?(c|m)[jt]s?(x)`. Put a test **next to the code** as `Name.test.tsx` (`useThing.test.ts` for a hook).
- **Not installed:** `msw`. Do not assume network interception exists; mock the API client (below). Adding a dependency goes through `ui-upgrade-packages`.
- **Current state:** `ui/` has **no tests**. `pnpm test -- --run` exits 1 with "No test files found" until the first file exists. Your change owes its own test.

## Traps in this repo

1. **`pnpm test` is watch mode and never exits.** Always `pnpm test -- --run` (what CI runs), or `pnpm vitest run <file>` for one file.
2. **Import the test globals explicitly.** `globals: true` makes them exist at runtime, but `tsconfig.app.json` sets `"types": ["vite/client"]` and `include: ["src"]`, so `tsc -b` type-checks test files **without** the Vitest globals. Every test file starts with `import { describe, it, expect, vi } from 'vitest';` (only what it uses: `noUnusedLocals` is on).
3. **A test file is part of the production type-check,** so a type error in a test fails `tsc -b`.
4. **`verbatimModuleSyntax` is on:** import types with `import type`.

## Non-negotiable rules

1. **Test behaviour through the DOM,** the way a user experiences it. Never assert on component state, props passed to children, or hook internals.
2. **Query by accessible role and label first** (`getByRole('button', { name: /save/i })`, `getByLabelText`), then `getByText`, and `getByTestId` only as a last resort.
3. **Use `userEvent`, not `fireEvent`,** and `await` it: `const user = userEvent.setup(); await user.click(...)`.
4. **Await async UI with `findBy…` or `waitFor`,** never a fixed sleep.
5. **Arrange → Act → Assert,** one behaviour per test, named for what the user sees: `"shows an error message when the settings fail to load"`.
6. **Test the failure path,** not only success: the error state renders, and the loading state clears.
7. **Mock the boundary, not your own modules:** Clerk and the API client. Do not mock a component to make a test pass.
8. **Isolate:** no test depends on another's state. Create a fresh `QueryClient` per test and reset mocks with `vi.clearAllMocks()` in `beforeEach`.
9. **No snapshot of a whole page.** A snapshot asserts nothing about behaviour and breaks on every style change.

## Rendering with the app's providers

The app wraps everything in Clerk, Redux, TanStack Query and the router (`main.tsx`). A component that uses them needs them in the test. Write one helper for the file (or share one in `src/test/`):

```tsx
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';

export const renderWithProviders = (ui: ReactElement) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};
```

`retry: false` matters: the default retries a failed query three times, which turns an error-state test into a timeout. Wrap with the Redux `Provider` and the real `store` only when the component reads it.

## Mocking Clerk and the API client

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: vi.fn() }),
  useUser: () => ({ isLoaded: true, user: { id: 'user_1', firstName: 'Asha' } }),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
}));

const getSettings = vi.fn();
vi.mock('@/service/api', () => ({
  useApiClient: () => ({}),
  getSettings: (...args: unknown[]) => getSettings(...args),
}));

describe('SettingsForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows an error message when the settings fail to load', async () => {
    getSettings.mockRejectedValue(new Error('boom'));
    renderWithProviders(<SettingsForm />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
```

Notes: `vi.mock` calls are hoisted and must be at the **top level** of the file, never inside `describe` or `beforeEach`. The mock factory cannot reference a variable declared later unless it is created with `vi.hoisted` or accessed lazily as above.

## Testing a hook

```ts
import { renderHook, waitFor } from '@testing-library/react';
// wrap with the QueryClientProvider from the helper above
const { result } = renderHook(() => useUserSettings(), { wrapper });
await waitFor(() => expect(result.current.settingsQuery.isSuccess).toBe(true));
```

Test what the hook returns for a user (data, loading, error), not its internal calls.

## Playwright is not unit testing

`e2e/ui/*.spec.ts` at the repo root is the Playwright smoke suite (`pnpm test:ui` from the root). It needs both dev servers running (`server/` has no `dev` script; start it with `start:dev`). Use it for a routed flow, not for component logic.

## Common mistakes

| Mistake                                     | Fix                                                        |
| ------------------------------------------- | ---------------------------------------------------------- |
| `pnpm test` in CI-like scripts              | `pnpm test -- --run`                                       |
| `describe`/`it` used without importing them | `import { … } from 'vitest'` (the build type-checks tests) |
| `getByTestId` for a button                  | `getByRole('button', { name })`                            |
| `fireEvent.click`                           | `await user.click`                                         |
| `setTimeout`/sleep to wait                  | `findBy…` or `waitFor`                                     |
| Error-state test times out                  | `retry: false` on the test `QueryClient`                   |
| Shared `QueryClient` across tests           | A fresh one per test; its cache leaks otherwise            |
| `vi.mock` inside `describe`                 | Top level of the file                                      |
| Asserting `useState` values                 | Assert what the DOM shows                                  |
| Mocking the component under test            | Mock Clerk and the API client only                         |

## When in doubt

Render it as the app does, do what a user does, assert what a user sees.
