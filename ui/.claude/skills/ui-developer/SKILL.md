---
name: ui-developer
description: Use before writing or modifying any code under ui/ in PrepAI — the frontend baseline for process, impact analysis, failure handling, security authoring, naming, comments, testing principles and code quality. Component and file conventions are in react-developer; the backend has its own server-developer.
---

# UI Development Guidelines

The baseline for **every** change under `ui/`. Component, hook and file conventions are in `react-developer`; this skill is the process and judgement layer on top of it. The backend has its own copy, `server-developer`.

| Work                                                                          | Skill                      |
| ----------------------------------------------------------------------------- | -------------------------- |
| A component, page, hook, route or style                                       | `react-developer`          |
| Fetching or mutating server data, query keys, the API client, the Clerk token | `frontend-data-fetching`   |
| A `*.test.tsx` / `*.test.ts`                                                  | `frontend-testing`         |
| Finishing the task                                                            | `ui-verify-implementation` |
| Reviewing a branch or diff                                                    | `ui-architect-review`      |

## Process

1. Understand the requirement before writing code. The endpoint you call is specified in `routes/<name>-api-spec.md`; read it, do not guess the response. The visual reference is `prepai-ui.html` at the repo root; port its screens, do not redesign them.
2. Make a plan, then execute it.
3. Implement following this skill and the stack skills that apply.
4. Update the documentation the change affects (an ADR, the skill that describes the behaviour).
5. Write or update tests at the level that proves the behaviour (`frontend-testing`).
6. Run the quick check on what you touched; the gate (`ui-verify-implementation`) runs once, on the assembled change.
7. Review the diff so nothing unnecessary is in it.

### Impact analysis for existing code

Before changing existing code, write down what it affects: the pages and hooks that import it, the query keys it shares, the Redux state it reads, and **the backend contract** it depends on. If the change needs a different response from `server/`, that is a contract change (`api-design` § contract): say so rather than coding around it. Then cover both the new behaviour and the existing behaviour you touched with tests.

### Bounded investigation

Read what the change needs: the files you modify, their direct imports, their call sites and the relevant test. Do not re-explore the whole repository when a spec or plan already names the files.

## Non-negotiable musts

- **All API calls go through `useApiClient()`.** Never `fetch` or `ky` directly from a component or page.
- **No auth tokens anywhere you can read them.** Not in Redux, `localStorage`, the URL or a hand-built `Authorization` header: the API client attaches the Clerk token.
- **No secrets in the bundle.** Anything under `VITE_` is shipped to every visitor.
- **Dependencies change only through `ui-upgrade-packages`.**
- **Git:** no commit, push, stash, branch or reset unless the user explicitly asks, and then through `git-commit`. Never `--no-verify`.

## Reuse before build

Search for the concept and its synonyms first (`grep -rn "formatDate\|dateFormat" ui/src`), then check `ui/src/components/ui/` (shadcn primitives) and `ui/src/utils/`. Build new only when nothing fits.

## Design principles

- **Separation of concerns.** A component renders; a hook owns stateful logic and data access; a pure function owns a calculation. No business logic or data access inline in a component that a hook or function could own.
- **One reason to change** per component, hook and function. A component with more than about three unrelated concerns (state, effects, data reads, handlers) is a defect: split it before review has to.
- **Server state is TanStack Query; shared client state is Redux Toolkit; component-local state is `useState`.** Do not duplicate server data into Redux.
- **An interface with one implementer and no substitution need** is a finding; so is an abstraction nothing else uses.

## Failure handling

Classify a failure before you handle it. Each failure has exactly one class:

| Class            | Meaning                                                                           | What to do                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Expected**     | The user or server said no: validation, 404, 409, quota reached                   | Show an inline, human message; offer the next step. Not logged as an error                                          |
| **Unexpected**   | A genuine fault: a thrown render error, a 5xx, a network failure                  | Let it reach the nearest error boundary or the query's `error` state; one user-visible message, never a stack trace |
| **Auth expired** | A 401                                                                             | The Clerk gating (`ProtectedRoute`/`SignedOut`) sends the user to sign in; do not retry blindly                     |
| **Best-effort**  | The step does not change the outcome if it fails (analytics, a prefetch)          | Catch, log at `warn`, carry on; the reason is visible at the site                                                   |
| **Safe default** | A read falls back to a value safe for the user (an empty list, a default setting) | Fall back and keep the UI usable                                                                                    |

Rules:

- **Boundary calls** are the calls that leave the browser: every `useApiClient()` request, Clerk, and storage.
- **Surface a failure once, where the user can see it.** Nothing monitors errors for you, so an error swallowed in a `catch` is lost. Never `catch` and do nothing; never `console.error` alone for a failure the user waited on.
- **Always clear loading state on the failure path** (`finally`, or the query's `isPending`), so a failed request does not leave a spinner or a half-built screen.
- **Check the status, not the message text.** Branch on `error.response.status`; message wording is for display.
- **Keep the cause** when wrapping: `new Error(message, { cause })`.

## Security authoring notes

Authoring-time awareness, not a review checklist (that is `ui-architect-review`).

- **XSS.** Do not use `dangerouslySetInnerHTML`. If it is genuinely required, sanitise first and say why in a comment. User-generated text (a topic name, an answer) is rendered as text, never as HTML.
- **Tokens.** The Clerk session token is read only inside `useApiClient`. Never store or log it.
- **Secrets.** A `VITE_` variable is public. Put nothing in it you would not publish.
- **Do not trust the client.** UI checks (hiding a button, a role check) are convenience, not security: the server decides. Never rely on a client-side role to protect data.
- **Links and redirects.** Do not build a redirect target or `href` from user input without validating it.

## Naming

- **Functions** are verb phrases; **variables** noun phrases; **booleans** take `is`, `has`, `should` or `can`. Hooks start with `use`.
- No generic names (`d`, `tmp`, `val`, `data`, `info`, `result`), no abbreviations (`repository`, not `repo`). **A generic noun carries what it belongs to:** `value` fails, `inputValue` passes. Exempt: `err`, `prev`, `i`, `j`, `x`, `y`, `_`.
- **Casing and files:** components `PascalCase.tsx`; hooks `useCamelCase.ts`; everything else `camelCase.ts`; types `Name.types.ts`; barrels `index.ts` (details in `react-developer` rule 10).

Four failure modes a denylist cannot catch:

1. **Shortened or acronym-compressed identifiers** where the full word costs nothing (`btn`, `usrCfg`).
2. **Generic placeholders:** a bare `Kind`, `Info`, `Data` or `Mode`.
3. **A name disagreeing with the codebase's own vocabulary.** The server says `category` and `role`; a UI field called `kind` or `tier` for either is a second vocabulary. Match the API's field names.
4. **The dictionary test.** Would a newcomer have to look the word up? Prefer the plain word.

## Documentation and comments

- Code is self-explanatory: a clearer name, a smaller component or an early return before a comment.
- **Default to no comment.** Add one only when the **why** is non-obvious (a re-render workaround, a browser quirk, a constraint from Clerk or the router). Never explain **what**.
- Short, simple English; one line. No redundant comments, no commented-out code, no reference to the task or ticket.

## Testing principles

- Every new component, hook and pure function gets a test, in **Arrange → Act → Assert** shape, named by the behaviour a user sees (`"shows an error message when the email is empty"`).
- Test behaviour through the DOM and accessible roles, not internal state.
- Tests are isolated and mock the network and Clerk, not your own modules.
- The mechanics are in `frontend-testing`. `ui/` currently has no tests, so your change owes its own.

## Code quality

- Short, single-purpose components, hooks and functions with early returns.
- **More than three parameters** → one named input type (`I<Name>Input`), destructured at the top.
- **A closed set of domain string values is a union type**, not a bare `string` (`'practice' | 'coding'`).
- No magic numbers or strings: named constants. No `any`: use `unknown` and narrow.
- Prefer `const`; do not mutate props or state.

## Formatting and file layout

- Prettier and ESLint are the authority (`pnpm lint` in `ui/`; `pnpm format:check` from the repo root). Use `prettier --write <files>` while iterating; the gate only checks.
- No unused imports or dead code. Imports in three blocks: third-party, `@/…`, relative, separated by blank lines. `import type { … }` for types.
- A file holds what its name promises. One exported component per file, named export.
