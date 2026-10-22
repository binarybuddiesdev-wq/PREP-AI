# React rules — full text and examples

Reference for the `react-developer` skill. The eleven non-negotiable rules with correct and wrong examples. Load when writing or reviewing a component, hook or file against one of the one-line rules in `SKILL.md`.

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

The server uses the same `I` prefix for interfaces in module `*.types.ts` files
(`ITechExpertRequest`, `IReadinessReport`), so this is the repo-wide convention
for **new** interfaces. A component's props interface is therefore
`I<Component>Props` — never a bare `<Component>Props`.

**Format for a component receiving props:**

```ts
// Hello.types.ts
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
  export * from './Hello';
  export * from './World';
  // ... whatever is meant to be used outside the folder
  ```
- For a feature folder with **one** `.tsx` file: still have an `index.ts` that
  re-exports it.
- **Exempt (not feature folders):** `components/ui/` (shadcn-generated
  primitives, imported as `@/components/ui/button`), `assets/`, `test/`, and
  `lib/` (flat single-purpose modules). Do not hand-edit shadcn output to
  satisfy these rules; regenerate or extend it with a wrapper.
- Pages import from the folder, not from the file:
  ```tsx
  // CORRECT
  import { Hello } from '@/components/hello';
  // WRONG
  import { Hello } from '@/components/hello/Hello';
  ```

**Why:** rename / move files freely without breaking imports. The folder
becomes the public surface.

### 3. Tailwind first; a per-folder `styles.css` only for custom classes; never inline

Styling order of preference:

1. **Tailwind utilities in `className`**, composed with `cn()`. This is the
   default for layout, spacing, color and typography.
2. **A per-folder `styles.css`** (next to the `.tsx` files) **only when the
   folder's components need named classes that utilities express badly**
   (repeated utility bundles, pseudo-elements, animations). Build them with
   `@apply`. One `styles.css` per folder, shared by its components. Do **not**
   create an empty or token `styles.css` just to satisfy a checklist.
3. **Shadcn primitives** (`@/components/ui/*`) for buttons, inputs, cards,
   dialogs. Extend them with utilities; do not fork them.

**Never use:**

- `style={{ ... }}` inline styles (except for genuinely dynamic values
  like `transform: \`translateX(${x}px)\`` where the value is computed
  at render time)
- `styled-components` or any CSS-in-JS library

**Tailwind convention:** use the `cn()` helper from `@/utils` to compose
class names cleanly. Don't concatenate class names with string templates.

```tsx
import { cn } from '@/utils';

export const Hello = (props: IHelloProps) => {
  const { className, name } = props;

  return <div className={cn('rounded-lg border p-4', className)}>Hello {name}</div>;
};
```

For complex conditional classes, build a small helper inside the
component file (not in `utils`):

```tsx
const buttonClass = (active: boolean) =>
  cn('rounded-md px-3 py-1', active && 'bg-amber-500 text-black');
```

### 4. Shared helpers live in `ui/src/utils/`, one concern per file

`@/utils` resolves to the file `ui/src/utils/cn.ts`, which holds shadcn's
`cn()`. **Do not create a `utils/` directory next to it** — `@/utils`
would then be ambiguous. Put new helpers in a file named for the concern:

```ts
// lib/format.ts
export const formatDate = (date: Date): string => { ... };
export const formatCurrency = (n: number, currency = 'USD'): string => { ... };
```

- Keep `utils/cn.ts` for `cn()` only.
- API access belongs in `service/api/` (see the `frontend-data-fetching` skill).
- When `lib/` outgrows flat files, convert it to concern folders in one
  dedicated change (`utils/cn.ts` → `lib/utils/index.ts` + `lib/utils/cn.ts`)
  and update every `@/utils` import in that same change.

### 5. `React.memo`, `useMemo`, `useCallback` — use when it matters

Don't wrap every component in `memo` blindly. Use the React DevTools
Profiler (or React Scan) to find the actual re-render hot spots, then memo
those.

**When you do wrap a component in `memo()`, the wrap only pays off if both
of these hold — check and report them together, not just the first:**

1. **The wrap itself** — arrow function form with `displayName` set explicitly (`export const Foo = memo((props: IFooProps) => { ... }); Foo.displayName = 'Foo';`, per Rule #7's arrow-functions-only convention), so DevTools and stack traces keep the component name.
2. **The caller passes reference-stable props.** `memo()` compares shallowly: a fresh object, array, or inline arrow function passed as a prop defeats the comparison and re-renders the child anyway — the wrap buys nothing. The caller needs `useCallback`/`useMemo` or a hoisted constant for anything non-primitive it passes down. Treat the wrap and its caller's prop-stability as one change, not two independent choices — a `memo()` with no caller-side stability work is a decoration, not an optimization.

Use `useMemo`/`useCallback` when:

- `useMemo` for expensive computations: sorting a list of 1000 items,
  filtering a large array, building a derived object.
- `useCallback` for functions passed as props to memoized children, or
  functions used in dependency arrays of other hooks.
- `React.memo` for leaf components that re-render unnecessarily because
  a parent re-renders — with condition 2 above satisfied at the call site.

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
import { useApiClient } from '@/service/api';
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

> **Existing files:** page and component files already follow the `PascalCase.tsx`
> naming. If you find one that doesn't (e.g. a leftover `hello.tsx` exporting
> `Hello`), rename it in the change that substantially modifies it. See
> § Existing code and known backlog for the rules the current files do **not**
> yet meet.

### 11. Component props pattern — pass as a single object, destructure after

```tsx
export const Hello = (props: IHelloProps) => {
  const { name, age, onClick } = props;

  return (
    <button onClick={onClick}>
      Hello {name}, age {age}
    </button>
  );
};
```

Never destructure in the function signature:

```tsx
// WRONG
export const Hello = ({ name, age, onClick }: IHelloProps) => {
  return (
    <button onClick={onClick}>
      Hello {name}, age {age}
    </button>
  );
};
```

**Why:** consistency. Easier to add wrappers (e.g., `React.memo`,
`forwardRef`) without rewriting every callsite. Easier to pass the
entire `props` to a child without re-listing every field.
