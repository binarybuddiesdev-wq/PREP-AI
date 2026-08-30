---
name: react-developer
description: Use when creating, modifying, or reviewing any React component, page, hook, or shared module under ui/src/. Triggers on any work involving .tsx, .ts, .css files in the ui package — pages, components, layouts, hooks, utils, store, lib. Also use when the user asks about React patterns, file structure, or component design in this project.
---

# React Developer

> If you are writing React code in the PrepAI `ui/` package, this is your
> playbook. It encodes the project's file structure, naming, and style
> conventions, plus the React best practices that apply to every component
> you write.

## When to use this skill

Use this skill whenever you are:

- Creating a new component, page, hook, or shared module under `ui/src/`
- Reviewing or refactoring any existing `.tsx` / `.ts` / `.css` file
- Designing the file structure for a new feature
- Wiring up a new route, a new Redux slice, or a new TanStack Query hook
- Working with the API client (`useApiClient`), Clerk auth, or any provider

If the work is backend, Prisma schema, AI agents, or infrastructure —
**this skill does not apply**.

## The non-negotiable rules

These are not guidelines. Code that violates them is wrong.

### 1. Interfaces in `.ts` files, never inline in `.tsx`

Every interface for a component lives in a separate `.ts` file. The `.tsx`
file imports the interface from that file.

- For 10 components in a folder, you have 10 interfaces in **one** `.ts` file
  (commonly named `types.ts` or `<folder>.types.ts`) — not 10 separate files,
  not inline in the components.
- For 1 component in a folder, the rule is the same: one `.tsx` and one
  accompanying `.ts` for the interface.

**Why:** `.tsx` files re-render with the component. `.ts` files compile to
zero JS, so the interface definitions don't bloat the bundle. More
importantly, a single source of truth for types makes refactors safe.

**Interface naming convention:** the name starts with `I` and describes the
function/component it serves.

- Component `Hello` → `IHelloProps`
- Function `getName` → `IGetNameProps`
- Form `LoginForm` → `ILoginFormProps` and `ILoginFormState`
- Hook `useUser` → `IUseUserReturn` (or `IUseUserOptions` for args)

**Format for a component receiving props:**

```ts
// hello.types.ts
export interface IHelloProps {
  name: string;
  age?: number;
}
```

```tsx
// Hello.tsx
import type { IHelloProps } from './Hello.types';

export const Hello = (props: IHelloProps) => {
  const { name, age } = props;

  return <div>Hello {name}</div>;
};
```

**Notice:** props are passed in as a single `props` argument, then
**destructured on the next line**, not in the function signature.

### 2. One `index.ts` per folder, no exceptions

Every folder has an `index.ts` that re-exports whatever is needed externally.

- For a folder `hello/` with 10 `.tsx` files and one `.types.ts`:
  ```ts
  // hello/index.ts
  export * from './hello';
  export * from './world';
  // ... whatever is meant to be used outside the folder
  ```
- For a folder with **one** `.tsx` file: still have an `index.ts` that
  re-exports it. No exceptions.
- Pages import from the folder, not from the file:
  ```tsx
  // CORRECT
  import { Hello } from '@/components/hello';
  // WRONG
  import { Hello } from '@/components/hello/Hello';
  ```

**Why:** rename / move files freely without breaking imports. The folder
becomes the public surface.

### 3. CSS in a per-folder `styles.css`, never inline

Every folder with `.tsx` files has a `styles.css` next to them. All CSS
classes for that folder's components go in this file.

- For 10 `.tsx` files in a folder, you have one `styles.css` with classes
  used across them.
- For 1 `.tsx` file in a folder, the rule is the same: one `styles.css`.

**Never use:**
- `style={{ ... }}` inline styles (except for genuinely dynamic values
  like `transform: \`translateX(${x}px)\`` where the value is computed
  at render time)
- `styled-components` or any CSS-in-JS library
- Tailwind utility classes inside `className` (Tailwind is fine — see below)

**Tailwind convention:** when using Tailwind, use the `cn()` helper from
`@/lib/utils.ts` to compose class names cleanly. Don't concatenate with
string templates.

```tsx
import { cn } from '@/lib/utils';

export const Hello = (props: IHelloProps) => {
  const { className, name } = props;

  return (
    <div className={cn('rounded-lg border p-4', className)}>
      Hello {name}
    </div>
  );
};
```

For complex conditional classes, build a small helper inside the
component file (not in `utils`):

```tsx
const buttonClass = (active: boolean) =>
  cn('rounded-md px-3 py-1', active && 'bg-amber-500 text-black');
```

### 4. Utils in `@/lib/utils/`, organized by concern

All shared utility functions live in `ui/src/lib/utils/`. Two patterns are
acceptable:

- **Single file** (when utils are few and related):
  ```ts
  // lib/utils/format.ts
  export const formatDate = (date: Date): string => { ... };
  export const formatCurrency = (n: number, currency = 'USD'): string => { ... };
  ```
- **Per-function file** (when utils grow and need to be tree-shaken):
  ```ts
  // lib/utils/format-date.ts
  export const formatDate = (date: Date): string => { ... };
  // lib/utils/format-currency.ts
  export const formatCurrency = (n: number): string => { ... };
  ```

`lib/utils/index.ts` re-exports everything that's part of the public
utility surface.

### 5. `React.memo`, `useMemo`, `useCallback` — use when it matters

Don't wrap every component in `memo` blindly. Use the React DevTools
Profiler (or React Scan) to find the actual re-render hot spots, then memo
those.

Use them when:

- `useMemo` for expensive computations: sorting a list of 1000 items,
  filtering a large array, building a derived object.
- `useCallback` for functions passed as props to memoized children, or
  functions used in dependency arrays of other hooks.
- `React.memo` for leaf components that re-render unnecessarily because
  a parent re-renders.

Don't use them when:

- The component is already cheap to render
- The deps array changes every render anyway
- You're memoizing for "performance" without measuring

### 6. One component per file, code-split at the file level

Each `.tsx` file exports exactly one component as a **named export**. The
file name is PascalCase; the component name is also PascalCase.

- `Hello.tsx` exports `Hello`
- `DashboardPage.tsx` exports `DashboardPage`
- `GetName.tsx` exports `GetName` (file and component share the same name)

**Why named exports, not default exports:** named exports give you
better refactoring safety (TypeScript catches broken imports on rename,
default exports don't), work cleanly with `React.lazy` for code-splitting,
and compose properly with barrel re-exports (`export * from './hello'`).

**Why one component per file:** dynamic imports and code-splitting work
at the file level. A file with two components can't be lazy-loaded as one
unit.

### 7. Arrow functions only, no `function` declarations

All components, hooks, and helper functions in this project are arrow
functions. No `function Hello() { ... }` syntax.

```ts
// CORRECT
export const Hello = (props: IHelloProps) => {
  const { name } = props;
  return <div>Hello {name}</div>;
};

// WRONG
export function Hello(props: IHelloProps) {
  return <div>Hello {props.name}</div>;
}
```

### 8. No `any` type, anywhere

Never use `any` in interface declarations, function signatures, or type
assertions. Use `unknown` if the type is genuinely unknown and you must
narrow it, or define a proper interface.

```ts
// WRONG
const handler = (data: any) => { ... };
const parsed = JSON.parse(raw) as any;

// CORRECT
interface IParsedData {
  id: string;
  name: string;
}
const handler = (data: IParsedData) => { ... };
const parsed = JSON.parse(raw) as IParsedData;
```

If you find yourself reaching for `any`, the right move is to define a
type or interface, not to suppress the type checker.

### 9. Import order — 3rd party first, local second

Every file's imports follow this order, separated by blank lines:

```ts
// 1. 3rd party packages (anything in node_modules)
import { useEffect, useState } from 'react';
import { useUser, UserButton } from '@clerk/clerk-react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';

// 2. Internal alias imports (@/...)
import { useApiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { IUserProfile } from '@/types/user.types';

// 3. Relative imports (./, ../)
import { Hello } from './hello';
import type { IHelloProps } from './hello.types';
import './styles.css';
```

The first block is sorted alphabetically within itself. Same for the
second and third.

**Type-only imports:** always use `import type { ... }` for types, never
mix with value imports. This helps bundlers tree-shake type-only code.

### 10. File naming: PascalCase for components, camelCase for everything else

Every file in `ui/src/` follows one of two conventions, depending on what
the file contains:

- **Component files:** `PascalCase.tsx` — the file name matches the
  exported component name.
  - `Hello.tsx`, `DashboardPage.tsx`, `UserCard.tsx`
- **Everything else** (hooks, utilities, types, styles, barrels, config):
  `camelCase.ts` (or `.tsx` if it returns JSX, `.css` for styles).
  - `useUser.ts` (a hook)
  - `cn.ts` (a utility)
  - `Hello.types.ts` (a types file co-located with `Hello.tsx`)
  - `index.ts` (a barrel — always lowercase, always the folder entry point)
  - `apiClient.ts` (a non-component module)
  - `vite.config.ts`, `tsconfig.json` (config files)

**Why:** matching the component's filename to its export name removes a
class of "is the file named after the export or not?" question, and lets
IDEs and editors group related files more reliably. The casing distinction
now tells you at a glance whether a name refers to a component file
(`Hello.tsx`) or a hook file (`useHello.ts`) — both are unambiguous
because component files and hook files use different casing.

**Special names:** `index.ts` / `index.tsx` (always lowercase, always the
folder entry point).

> **Existing files:** all current `ui/src/` files conform to this rule.
> If you find a file that doesn't (e.g. a leftover `hello.tsx` with a
> `Hello` component from before the rule was changed), rename it as part
> of the change that touches it.

### 11. Component props pattern — pass as a single object, destructure after

```tsx
export const Hello = (props: IHelloProps) => {
  const { name, age, onClick } = props;

  return <button onClick={onClick}>Hello {name}, age {age}</button>;
};
```

Never destructure in the function signature:

```tsx
// WRONG
export const Hello = ({ name, age, onClick }: IHelloProps) => {
  return <button onClick={onClick}>Hello {name}, age {age}</button>;
};
```

**Why:** consistency. Easier to add wrappers (e.g., `React.memo`,
`forwardRef`) without rewriting every callsite. Easier to pass the
entire `props` to a child without re-listing every field.

## The file structure for a new feature

For a new feature called "hello" with 3 components:

```
ui/src/components/hello/
├── Hello.types.ts                 # all interfaces for this feature
├── Hello.tsx                      # the main component
├── World.tsx                      # a second component
├── Greeting.tsx                   # a third component
├── styles.css                     # all CSS for these components
└── index.ts                       # public exports
```

Plus, if it has shared helpers:

```
ui/src/lib/utils/
└── hello-helpers.ts               # pure functions used by hello/*
```

For a single-component feature, the structure is the same (rule #2):

```
ui/src/components/bye/
├── Bye.types.ts
├── Bye.tsx
├── styles.css
└── index.ts
```

For a page (top-level route):

```
ui/src/pages/DashboardPage.tsx
ui/src/pages/dashboard/
│   ├── dashboard.types.ts
│   ├── DashboardHeader.tsx
│   ├── KpiCards.tsx
│   ├── RecentSessionsTable.tsx
│   ├── styles.css
│   └── index.ts
```

The page file itself is thin — it composes the sub-components and wires
data fetching.

## Project-specific conventions

These are the patterns PrepAI already uses. Mirror them.

### Routing

`ui/src/App.tsx` declares the route tree. Public routes use `<PublicRoute>`,
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

```ts
import { useApiClient, getMe } from '@/lib/api';

export const DashboardPage = () => {
  const api = useApiClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => getMe(api),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  return <div>Welcome {data?.data.name}</div>;
};
```

Mutations:

```ts
const mutation = useMutation({
  mutationFn: (body: IUpdateSettingsBody) => updateSettings(api, body),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['user-settings'] });
  },
});
```

### Styling

The project uses Tailwind v4 + shadcn/ui. Both are available. For new
components, prefer shadcn primitives (`<Button>`, `<Input>`, `<Card>`)
when they exist. Extend them with Tailwind utilities for layout.

The reference UI is in `prepai-ui.html` at the repo root — a self-contained
HTML prototype with all screens designed. Port its visuals to React
components, don't redesign.

## A complete component example

```ts
// ui/src/components/hello/hello.types.ts
export interface IHelloProps {
  name: string;
  age?: number;
  className?: string;
  onGreet?: () => void;
}
```

```css
/* ui/src/components/hello/styles.css */
.hello {
  @apply rounded-lg border p-4 flex flex-col gap-2;
}

.hello-title {
  @apply text-lg font-semibold;
}

.hello-greeting {
  @apply text-amber-500;
}
```

```tsx
// ui/src/components/hello/Hello.tsx
import { memo } from 'react';
import { cn } from '@/lib/utils';

import type { IHelloProps } from './Hello.types';

export const Hello = memo((props: IHelloProps) => {
  const { name, age, className, onGreet } = props;

  return (
    <div className={cn('hello', className)}>
      <h2 className="hello-title">
        Hello, <span className="hello-greeting">{name}</span>
      </h2>
      {age !== undefined && <p>Age: {age}</p>}
      {onGreet && (
        <button onClick={onGreet} className="text-sm underline">
          Greet
        </button>
      )}
    </div>
  );
});

Hello.displayName = 'Hello';
```

```ts
// ui/src/components/hello/index.ts
export * from './hello';
```

## React Best Practices — Mandatory Checklist

**Before marking any component work as complete**, run through every item below. These rules are enforced consistently across this project.

### Component Structure

- [ ] **One component per file** — no file exports multiple components unless they are tightly related and the file name predicts both
- [ ] **Named exports, not default exports** — `export const Hello = ...` not `export default Hello`
- [ ] **Props interface in a separate `.ts` file** — never inline in `.tsx`; the `.tsx` imports from the `.ts` file
- [ ] **Props named with `Props` suffix** — `HelloProps`, not `HelloProp` or `HelloProperties`
- [ ] **Props marked as `readonly`** — enforce immutability at the type level
- [ ] **Default values for optional props** via destructuring defaults
- [ ] **No component defined inside another component** — all component definitions at module scope (causes remounts on every render)
- [ ] **File name predicts exports** — if the file's name doesn't match its exports, it is two files

### Styling

- [ ] **Tailwind CSS v4** for layout and spacing utilities (`flex`, `gap-*`, `w-*`, `overflow-*`, `items-*`, `justify-*`, `rounded`, `border`, `text-*`, `bg-*`)
- [ ] **Shadcn UI** components for standard primitives (buttons, inputs, cards, dialogs, etc.)
- [ ] **No inline `style={{}}` props** anywhere — always Tailwind or a Shadcn UI component
- [ ] **CSS in a per-folder `styles.css`** — every folder with `.tsx` files has a `styles.css` alongside them (Rule #3)
- [ ] **Styling in `components/ui/`** — follow `components.json` conventions

### Hooks

- [ ] **Custom hooks prefixed with `use`** — e.g., `useAuth`, `useTopics`, `useApiQuery`
- [ ] **Custom hooks encapsulate one piece of reusable stateful logic**
- [ ] **Every `useEffect`, `useCallback`, and `useMemo` has an accurate dependency array**
- [ ] **If a dependency is intentionally omitted**, `// eslint-disable-next-line react-hooks/exhaustive-deps` appears on the line above with a comment explaining why
- [ ] **Every `useEffect` that registers an event listener, subscription, or timer returns a cleanup function**
- [ ] **TanStack Query hooks** (`useQuery`, `useMutation`, `useQueryClient`) for all server-state data fetching — not `useEffect` with manual `fetch`
- [ ] **Redux Toolkit** slices and selectors for client/global state — not `useState` for shared state
- [ ] **`useApiClient()`** for all API calls — never `fetch`/`ky` directly from components

### Memoization

- [ ] **`memo()` is used with a reason** — expensive render, list item, or stable props under a frequently re-rendering parent — not applied reflexively
- [ ] **`memo()` uses the arrow function form** — `export const Hello = memo((props: IHelloProps) => { ... })`
- [ ] **`useCallback`** for async handlers, handlers passed to memoized children, and handlers used as `useEffect` deps — simple one-liner inline handlers do not need it
- [ ] **`useMemo`** for expensive computations, stable derived values, reference-stable objects passed to memoized children

### Accessibility

- [ ] **Semantic HTML elements** (`<button>`, `<nav>`, `<main>`, `<section>`, `<form>`) instead of generic `<div>` and `<span>`
- [ ] **Every interactive element is keyboard accessible**
- [ ] **Every form input has a `<label>`** or `aria-label`
- [ ] **Every image has an `alt` attribute** — empty `alt=""` for decorative images
- [ ] **Color contrast ≥ 4.5:1** for normal text (WCAG AA minimum)
- [ ] **Focus management** works correctly in modals, drawers, and dynamic content

### Clerk Auth

- [ ] **`SignedIn`/`SignedOut`** gating used appropriately in `App.tsx`
- [ ] **`ProtectedRoute`/`PublicRoute`** wrappers used for route-level auth
- [ ] **No auth logic in components** — auth state comes from Clerk, not from local state
- [ ] **`useApiClient()`** auto-attaches the Clerk session token — never manually attach a Bearer token

### Testing (React)

- [ ] **React Testing Library** — test behavior from the user's perspective, not implementation details
- [ ] **Query by accessible roles and labels** (`getByRole`, `getByLabelText`) before falling back to `getByTestId`
- [ ] **Never test internal state or hook implementation** — test what the user sees and interacts with
- [ ] **Arrange → Act → Assert** pattern in every test
- [ ] **Descriptive test names** — `"should display error message when form is submitted with an empty email"`, not `"test 1"`
- [ ] **Mock API calls and external dependencies**, not internal modules

### Code Quality

- [ ] **No `any`** — use `unknown` when the type is genuinely not known, then narrow it
- [ ] **`interface` for object shapes and props**, `type` for unions, intersections, and primitives
- [ ] **Exports alongside the code** that uses them from the feature's `index.ts`
- [ ] **No unused imports, variables, or dead code**
- [ ] **Early returns** to reduce nesting
- [ ] **No magic numbers and strings** — extract into named constants

### File Layout

- [ ] **Imports → types → implementation** — no `import` after the first statement
- [ ] **Group imports**: external libraries → internal modules → relative imports, separated by a blank line
- [ ] **Barrel `index.ts`** exports everything from sibling modules
- [ ] **Import from the directory** (`from './parts/status-bar'`), never a file inside it

## When in doubt

Mirror the existing pages (`DashboardPage.tsx`, `SettingsPage.tsx`) and the `api-design` skill for the backend side. If the existing code does something the rules above don't cover, the existing code is the source of truth — update the rules if they're wrong, don't fight them.
