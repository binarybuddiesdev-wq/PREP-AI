# Frontend (ui/**) checklist

Reference for the `ui-architect-review` skill. The checks a `ui/**` judgment dispatch runs. Load when reviewing a change under `ui/`.

## What to flag — frontend (`ui/**`)

The judgment gate must consult the "What the architect-review skill checks"
subsection of `docs/architecture/architecture.md` §Frontend Refactor for the full list. The
condensed reference (also reproduced here so the gate can run without
re-reading the architecture doc):

### Current state: implemented layers

`ui/src` contains `core`, `utils`, `service`, `data`, `logic`, `components`,
`pages`, and `app`. The import direction and layer responsibilities are
defined in `docs/architecture/frontend-refactor.md` and enforced with ESLint.
Review the current implementation against those rules; do not use the former
pre-refactor folder map or historical backlog as an exemption. Pages use
named exports, server requests live in the service/logic layers, Redux holds
client-owned state, and colocated tests exist.

### Hard violations (Should-fix)

- **`components/` imports from `data/`, `logic/`, or `service/`** — the layer rule broken
- **`useQuery` / `useMutation` called outside `logic/`** — page or component doing what hooks should do
- **`useApiClient` / `getApiClient` called outside `data/` or `logic/`** — direct transport access
- **A page contains business logic** (calculations, branching, transforms) beyond composition — extract to a `logic/` hook
- **A component calls a hook from `logic/`** — components must be presentational; raise data via props
- **A `data/` file imports from `logic/`** — circular layer
- **A `utils/` file imports from any layer except `core/`** — `utils/` is a leaf above core
- **A `core/` file imports from any layer** — `core/` is the bottom
- **Component file not in `PascalCase.tsx`** — violates `react-developer/SKILL.md` Rule #10 (post-refactor)
- **Hook file not in `camelCase.ts`** — violates `react-developer/SKILL.md` Rule #10

### Soft violations (Nit)

- A resource folder has more than 5 hook files — consider grouping
- A `components/<feature>/` folder has no `index.ts` — add the barrel
- A page exceeds ~150 lines — split into sub-components
- A `logic/` hook doesn't have a query-key factory entry in `logic/<resource>/<resource>.keys.ts` — extract
- A non-trivial query resource is missing a key factory in `logic/` — add it
- A file's exports don't match its name (e.g. `useUserReader.ts` exporting `getUserData`) — rename or split

### File-shape (Should-fix, in their own section)

- **Passengers** — a file exports something not predicted by its name (e.g. `userCard.tsx` exporting both `UserCard` and `formatUserName`).
- **Imports after the first statement** — no ESLint rule covers this in `ui/`; the judgment gate is the only check.
- **Deep import past a directory's `index.ts` barrel** — e.g. `import { getMe } from '@/service/api/user.api'` instead of `import { getMe } from '@/service/api'`. Flag only the ones _this change adds_.
- **Stringly-typed domain value** — a parameter or field typed `string` whose real domain is a closed set (a status, a mode, a type tag). Wants a union.
- **Trailing `export { ... }` block in a non-barrel file** — e.g. `const Foo = ...; const Bar = ...; export { Foo, Bar };` instead of `export const Foo = ...; export const Bar = ...;`. Exception: barrel/`index.ts`.
- **Oversized file** — a file this change substantially modified (50+ added lines, or a quarter of its lines touched) that is over 250 lines when the change is done. _Blocker_ if the file ended the change larger than it started and was already over 250; _Should-fix_ otherwise. Brand-new files are exempt from the ceiling — judge them on the other shape items instead.

### What NOT to flag on a `ui/**` dispatch (other skills' territory)

- Naming conventions, formatting, comments — `ui-developer` skill
- Presentational rules (arrow functions, no `any`, CSS conventions) — `react-developer` skill
- Anything under `server/` — the `server-architect-review` skill
- Test coverage gaps — `frontend-qa-engineer`'s own dispatch (step 5), not this one

If a finding belongs in another skill's lane, **say which skill owns it**
in the report and route it there. Do not duplicate the other skill's
review.
