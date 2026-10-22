# Mandatory checklist before marking component work complete

Reference for the `react-developer` skill. Run every item before reporting a component, hook or page change as complete.

## React Best Practices — Mandatory Checklist

**Before marking any component work as complete**, run through every item below. These rules are enforced consistently across this project.

### Component Structure

- [ ] **One component per file** — no file exports multiple components unless they are tightly related and the file name predicts both
- [ ] **Named exports, not default exports** — `export const Hello = ...` not `export default Hello`
- [ ] **Props interface in a separate `.ts` file** — never inline in `.tsx`; the `.tsx` imports from the `.ts` file
- [ ] **Props interface named `I<Component>Props`** — `IHelloProps` (Rule #1), not `HelloProps`, `HelloProp` or `HelloProperties`
- [ ] **Props marked as `readonly`** — enforce immutability at the type level
- [ ] **Default values for optional props** applied in the destructuring line after `const { ... } = props` (Rule #11), not in the function signature
- [ ] **No component defined inside another component** — all component definitions at module scope (causes remounts on every render)
- [ ] **File name predicts exports** — if the file's name doesn't match its exports, it is two files

### Styling

- [ ] **Tailwind CSS v4** for layout and spacing utilities (`flex`, `gap-*`, `w-*`, `overflow-*`, `items-*`, `justify-*`, `rounded`, `border`, `text-*`, `bg-*`)
- [ ] **Shadcn UI** components for standard primitives (buttons, inputs, cards, dialogs, etc.)
- [ ] **No inline `style={{}}` props** anywhere — always Tailwind or a Shadcn UI component
- [ ] **Custom (non-utility) classes live in the folder's `styles.css`** — created only when the folder needs them, never empty (Rule #3)
- [ ] **`components/ui/`** is shadcn-generated — follow `components.json` conventions and don't hand-edit to satisfy these rules

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
- [ ] **`memo()` uses the arrow function form** with `displayName` set — `export const Hello = memo((props: IHelloProps) => { ... }); Hello.displayName = 'Hello';`
- [ ] **Every caller of a `memo()`-wrapped component passes reference-stable props** — a fresh object/array/inline arrow at the call site defeats the memo. Check this alongside the wrap itself, not as a separate later task
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

### Testing (React) — full guidance in `frontend-testing`

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
