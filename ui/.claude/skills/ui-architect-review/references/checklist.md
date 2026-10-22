# Frontend (ui/**) checklist

Reference for the `ui-architect-review` skill. The checks a `ui/**` judgment dispatch runs. Load when reviewing a change under `ui/`.

## What to flag — frontend (`ui/**`)

The judgment gate must consult the "What the architect-review skill checks"
subsection of `docs/architecture/architecture.md` §Frontend Refactor for the full list. The
condensed reference (also reproduced here so the gate can run without
re-reading the architecture doc):

### Current state: the 7 layers are a target, not yet the code

ADR-0008 and the root `eslint.config.js` `no-restricted-imports` rules describe
`core`, `utils`, `data`, `service`, `logic`, `components`, `pages`. `ui/src`
today has only `components/`, `lib/`, `pages/`, `store/` (and `test/`,
`assets/`). Apply the layer checks below **only to layers whose folders
exist**. For a change that needs a missing layer (a new query hook, a new
transport module), do not fail the change for lacking the folder: report one
**Nit** that it should land in the target layer when the refactor reaches
it, and judge the rest against `react-developer`. A `Hard violation` below
applies when the diff adds code **to** or **imports across** an existing
layer boundary. Never flag the existing default-exported pages or direct
`fetch` calls: they are listed as backlog in `react-developer` §Existing
code and known backlog.

### Hard violations (Should-fix)

- **`components/` imports from `data/` or `logic/`** — the layer rule broken
- **`useQuery` / `useMutation` called outside `logic/`** — page or component doing what hooks should do
- **`useApiClient` / `getApiClient` called outside `data/` or `logic/`** — direct transport access
- **A page contains business logic** (calculations, branching, transforms) beyond composition — extract to a `logic/` hook
- **A component calls a hook from `logic/`** — components must be presentational; raise data via props
- **A `data/<resource>/` file imports from `logic/`** — circular layer
- **A `utils/` file imports from any layer** — `utils/` is a leaf
- **A `core/` file imports from any layer** — `core/` is the bottom
- **Component file not in `PascalCase.tsx`** — violates `react-developer/SKILL.md` Rule #10 (post-refactor)
- **Hook file not in `camelCase.ts`** — violates `react-developer/SKILL.md` Rule #10

### Soft violations (Nit)

- A resource folder has more than 5 hook files — consider grouping
- A `components/<feature>/` folder has no `index.ts` — add the barrel
- A page exceeds ~150 lines — split into sub-components
- A `logic/` hook doesn't have a query-key factory entry in `data/<resource>/<resource>.keys.ts` — extract
- A `data/<resource>/` folder is missing `<resource>.types.ts` or `<resource>.keys.ts` and the resource is non-trivial — add them
- A file's exports don't match its name (e.g. `useUserReader.ts` exporting `getUserData`) — rename or split

### File-shape (Should-fix, in their own section)

- **Passengers** — a file exports something not predicted by its name (e.g. `userCard.tsx` exporting both `UserCard` and `formatUserName`).
- **Imports after the first statement** — no ESLint rule covers this in `ui/`; the judgment gate is the only check.
- **Deep import past a directory's `index.ts` barrel** — e.g. `import { getMe } from '@/data/user/user.api'` instead of `import { getMe } from '@/data/user'`. Flag only the ones _this change adds_, never the backlog.
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
