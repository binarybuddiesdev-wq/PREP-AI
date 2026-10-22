---
name: react-developer
description: Use when creating, modifying or reviewing a React component, page, hook, route, style or shared module under ui/src in PrepAI — .tsx, .ts or .css files, file structure, naming, props, memoization, Tailwind and shadcn styling, routing, Redux or Clerk usage. Frontend only; the backend uses nestjs-developer.
---

# React Developer

The conventions for `ui/src`: file layout, naming, component and hook style, styling and accessibility. It sits on the `ui-developer` skill and hands specialised work to its siblings:

| Work                                                                          | Skill                    |
| ----------------------------------------------------------------------------- | ------------------------ |
| Fetching or mutating server data, query keys, the API client, the Clerk token | `frontend-data-fetching` |
| Writing or changing a `*.test.tsx`                                            | `frontend-testing`       |

Not for `server/`: that is `nestjs-developer`.

## When to use

- Creating a component, page, hook or shared module
- Reviewing or refactoring any `.tsx`, `.ts` or `.css` file in `ui/`
- Designing the folder for a new feature
- Wiring a route, a Redux slice, or Clerk gating

## Non-negotiable rules

These govern **new and substantially modified code** (see § Existing code and known backlog). One line each; the full rule with correct and wrong examples is in [`references/rules.md`](references/rules.md).

1. **Interfaces live in a sibling `*.types.ts`**, never inline in a `.tsx`. They are `I`-prefixed and named for what they serve: `IHelloProps`, `IUseUserReturn`. The server uses the same `I` prefix.
2. **A feature folder has an `index.ts` barrel**, and consumers import from the folder (`@/components/hello`), never from a file inside it. Exempt: `components/ui/` (shadcn), `assets/`, `test/`, `lib/`.
3. **Tailwind first.** Compose classes with `cn()`. A per-folder `styles.css` (`@apply`) only for custom classes utilities express badly. No inline `style={{}}` (except a genuinely computed value) and no CSS-in-JS.
4. **Shared helpers go in `ui/src/utils/`, one concern per file.** `@/utils` is the file `utils/cn.ts` (shadcn's `cn()`); never create a `utils/` folder beside it.
5. **Memoize on evidence.** A `memo()` pays off only if the wrap is correct (arrow form with `displayName`) **and** callers pass reference-stable props. Check both together.
6. **One component per file, as a named export.** The file is `PascalCase.tsx` and matches the component name. No default exports.
7. **Arrow functions only** for components, hooks and helpers.
8. **No `any`.** Use `unknown` and narrow, or define the type.
9. **Imports in three blocks:** third-party, then `@/…`, then relative, separated by blank lines, each sorted. Types use `import type`.
10. **Naming:** components `PascalCase.tsx`; hooks `useCamelCase.ts`; everything else `camelCase.ts`; types `Name.types.ts`; barrels `index.ts`; tests beside the code as `Name.test.tsx`.
11. **Props arrive as one `props` argument and are destructured on the next line**, not in the signature.

## Existing code and known backlog

The rules above govern **new and substantially modified code**. Some existing files predate them. Treat these as a known backlog, not as precedent:

| Existing code                                                          | Rule it does not meet                     |
| ---------------------------------------------------------------------- | ----------------------------------------- |
| `App.tsx` and the four pages in `pages/` are `export default function` | #6 named exports, #7 arrow functions      |
| `service/api/` declares `useApiClient` with `function`                 | #7 arrow functions                        |
| `pages/SettingsPage.tsx` calls `fetch` directly, three times           | all API calls go through `useApiClient()` |
| `store/index.ts` holds only a placeholder reducer                      | no real slices exist yet                  |
| No `*.test.tsx` files exist                                            | `frontend-testing`                        |

How to apply this:

- **Never copy a backlog pattern into new code** because a neighbouring file does it. "The existing page does it" is not a justification.
- **Convert a backlog file only when your change substantially rewrites it** (more than a quarter of its lines) or in a dedicated refactor change. Do not convert files as a drive-by inside an unrelated feature.
- **Reviewers flag only what the diff adds**, never the backlog. A changed line inside a default-exported page is not a new violation.
- **Generated or vendored code** (`components/ui/*`, Vite scaffolding) is exempt.

## Component size and accessibility

- A component with more than about three unrelated concerns (state, effects, data reads, handlers) is a defect; split it before review has to. Judge by responsibilities, not line count alone; a file over roughly 250 lines you substantially changed is worth a second look.
- Never define a component inside another component (it remounts every render).
- Semantic elements over `div`/`span`; every interactive element keyboard-reachable; every input labelled; every image has `alt` (`alt=""` if decorative); contrast at least 4.5:1; manage focus in dialogs. The full list is in [`references/checklist.md`](references/checklist.md).

## Task → reference

| When you are…                                                          | Read                                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Unsure how a rule reads, or reviewing code against one                 | [`references/rules.md`](references/rules.md)                                 |
| Creating a new feature folder or page                                  | [`references/structure-and-example.md`](references/structure-and-example.md) |
| Adding a route, choosing a state tool, using Clerk, or layering styles | [`references/project-conventions.md`](references/project-conventions.md)     |
| About to report component work as done                                 | [`references/checklist.md`](references/checklist.md)                         |
| Calling the API or caching server data                                 | the `frontend-data-fetching` skill                                           |

## Common mistakes

| Mistake                                                                    | Fix                                                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Props interface written inside the `.tsx`                                  | Move it to `Name.types.ts` as `INameProps`                           |
| `export default` on a new component                                        | Named export                                                         |
| `function Hello()` on a new component                                      | `const Hello = (props: IHelloProps) => {…}`                          |
| `({ name, age }: IHelloProps)` in the signature                            | `(props)` then `const { name, age } = props`                         |
| `memo()` on a component whose caller passes a fresh object or inline arrow | Stabilise the props with `useCallback`/`useMemo`, or drop the `memo` |
| A `utils/` folder next to `utils/cn.ts`                                    | Put the helper in `utils/<concern>.ts`                               |
| `fetch(...)` in a page or component                                        | `useApiClient()` (see `frontend-data-fetching`)                      |
| An empty `styles.css` created to satisfy a rule                            | Delete it; Tailwind is enough                                        |

## When in doubt

Mirror the structure in [`references/structure-and-example.md`](references/structure-and-example.md), not the nearest page: the existing pages are backlog. Where existing code does something the rules do not cover, it is the source of truth; where it contradicts a rule, the rule wins for new code.
