---
name: developer
description: Develops code following consistent naming, documentation, testing, and formatting standards for the PrepAI monorepo (NestJS + React)
---

# Development Guidelines

Follow these standards when writing or modifying code in the PrepAI monorepo, regardless of which package you're working in.

## Process

1. Understand the requirement before writing any code
2. Make a plan, then execute
3. Write the implementation following the guidelines below
4. Add or update documentation
5. Write or update tests to cover the changes
6. Run the linter and fix any issues
7. Review the diff to ensure nothing unnecessary is included

### Impact Analysis for Existing Code

When modifying existing implementations:

- Analyze the change and produce an impact analysis before writing code
- Ensure existing functionality works as expected after the changes
- Implement test cases covering both new and affected existing behavior
- Perform a thorough code review and functionality review of the changes

## PrepAI Architecture Constraints

**These rules are mandatory in this codebase. Verify all items before proposing or writing code.**

### Monorepo Structure

PrepAI is a pnpm monorepo with three packages:

| Package | Layer | Responsibility |
|---|---|---|
| `server/` | Backend | NestJS + Fastify API, Prisma ORM, Mastra AI agents |
| `ui/` | Frontend | React 19 + Vite, TanStack Query, Redux Toolkit, Clerk auth |
| root | E2E + Infra | Playwright tests, Piston management, shared config |

### Server — Module Structure

Each feature lives under `server/src/modules/<name>/` as:

```
server/src/modules/<name>/
├── <name>.module.ts           # @Module({ providers, controllers })
├── <name>.controller.ts       # HTTP layer (Fastify)
├── <name>.service.ts          # Business logic + Prisma
├── <name>.controller.spec.ts  # Controller tests (mock service)
├── <name>.service.spec.ts     # Service tests (mock Prisma)
└── dto/
    ├── index.ts               # Barrel
    ├── create-<name>.dto.ts
    ├── update-<name>.dto.ts
    └── get-<name>.dto.ts
```

### Server — Layer Boundaries

| Directory | May import from | Must NOT import |
|---|---|---|
| `server/src/modules/<name>/` | `common/`, `@/common`, `@prisma/client` | Other modules' internals |
| `server/src/common/` | Nothing from modules | Modules |
| `server/src/config/` | `@/common` | Modules |
| `server/src/prisma/` | Nothing | Modules |
| `server/src/mastra/` | `@/common` | Modules (agents call services directly) |

### Frontend — Structure

```
ui/src/
├── pages/           # React Router pages
├── components/      # Shadcn UI + custom components
├── lib/             # api.ts, store, hooks
├── store/           # Redux Toolkit slices
└── App.tsx          # Routing + Clerk gates
```

- All API calls go through `useApiClient()` (`lib/api.ts`) — never call `fetch`/`ky` directly
- Server state through TanStack Query; client/global state through Redux Toolkit
- Components follow Shadcn UI conventions (`components.json`, `components/ui/`)

### ESM / NodeNext — .js extensions

Every relative import MUST end with `.js` (even for `.ts` files):

```ts
// CORRECT
import { TopicService } from './topic.service.js';
import { ApiTags } from '@/common/constants/api.constants.js';

// WRONG
import { TopicService } from './topic.service';
import { TopicService } from './topic.service.ts';
```

Path alias imports (`@/...`) also use `.js` in this project — every `@/` import in the codebase ends with `.js`.

### Prisma — Two Databases

- **MongoDB** (`PrismaService`): users, topics, questions
- **PostgreSQL** (`PrismaPostgresqlService`): sessions, answers, jobs, audit log, vectors
- Always inject the correct service. Never instantiate `new PrismaClient()`.
- The Postgres client no-ops gracefully if `POSTGRESQL_URL` is unset — always use `?.` when accessing `client_`.

### Environment Variables

- Never `process.env.X` directly — use `ConfigService`
- All env vars validated in `server/src/config/env.validation.ts`
- Add new required env vars to `env.validation.ts`, not just `.env.example`

## Naming Conventions

### Names Must Reveal Purpose

Every variable, function, class, and file name should clearly communicate what it holds or does without needing a comment.

- **Functions**: verb phrase describing the action (`createTopic`, `getTopicBySlug`)
- **Variables**: noun phrase describing the content (`mockTopic`, `topicService`)
- **Booleans**: prefix with `is`, `has`, `should`, or `can` (`isNewUser`, `hasPermission`)
- Avoid generic names: `d`, `tmp`, `val`, `data`, `info`, `result`, `process()`
- Avoid generic suffixes unless they add genuine meaning
- Avoid abbreviations — prefer `repository` over `repo`, `configuration` over `config`

### Casing Conventions

- **Variables and functions**: `camelCase`
- **Classes and types**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: lowercase with hyphens (`kebab-case`) for general files, `camelCase` for component files
- **DTOs**: `PascalCase` with `Dto` suffix (`CreateTopicDto`, `UpdateTopicDto`)
- **Spec files**: `<name>.controller.spec.ts`, `<name>.service.spec.ts`

### NestJS Conventions

- **Controllers**: PascalCase with `Controller` suffix (`TopicController`)
- **Services**: PascalCase with `Service` suffix (`TopicService`)
- **Guards**: PascalCase with `Guard` suffix (`ClerkAuthGuard`)
- **Interceptors**: PascalCase with `Interceptor` suffix (`TransformInterceptor`)
- **Pipes**: PascalCase with `Pipe` suffix (`ZodValidationPipe`)
- **Decorators**: PascalCase with `Decorator` suffix (`Public`, `Roles`, `CurrentUser`) — applied as `@Public()`, `@Roles()`, `@CurrentUser()`
- **Modules**: PascalCase with `Module` suffix (`TopicModule`)

## Documentation

- **Code should be self-explanatory.** Reach for a clear name, a smaller function, or an early return before reaching for a comment — the goal is code a reader understands without one.
- Default to writing no comments. Only add one when the **why** is genuinely non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific bug, or behavior that would surprise a reader. Never explain **what** the code does — a well-named identifier already does that.
- When a comment is needed, write it in short, simple English — one line if possible. If removing it wouldn't confuse a future reader, don't write it.
- Do not add a doc comment to every exported function/class/type by default. Reserve `@param`/`@returns`/`@throws` blocks for genuinely non-obvious public APIs.
- Do not write redundant comments (e.g., `// increment counter` above `counter++`).
- Do not reference the current task, ticket, or fix in a comment (e.g., "added for the X flow", "fixes issue #123") — that belongs in the commit message or PR description, and rots as the codebase evolves.

## Testing

- Write unit tests for every new function or module
- Follow the **Arrange → Act → Assert** pattern in each test
- Use descriptive test names that state the expectation:
  - `"should create topic successfully"`
  - `"should throw ConflictException when topic already exists"`
- Cover at minimum:
  - The happy path (expected input → expected output)
  - Edge cases (empty input, null, boundary values)
  - Error cases (invalid input, failure scenarios)
- Keep tests isolated — no test should depend on another test's state
- Controller specs: mock the service, assert `{ message, data }` response shape
- Service specs: mock Prisma with `useValue`, assert raw data (no envelope)
- Use `vi.fn()` exclusively — never `jest.fn()`

## Code Quality

- Keep functions short and single-purpose — if a function does more than one thing, split it
- Prefer early returns to reduce nesting:
  ```ts
  if (!topic) throw new NotFoundException(TOPIC_NOT_FOUND);
  ```
- Avoid magic numbers and strings — extract them into named constants
- Handle errors explicitly — never silently swallow exceptions
- Prefer immutability — use `const` over `let`, avoid mutating function arguments

## Code Formatting

- Use the project's existing formatter/linter config
- Run `pnpm format` (Prettier) before committing
- Run `pnpm lint` (ESLint) and fix any issues
- Remove unused imports, variables, and dead code before committing
- Never write two separate `import` statements for the same module specifier where one is type-only — prefer `import type { ... }` for types and `import { ... }` for values. A single `import type { X }` alongside a value `import { Y }` from the same module is acceptable; merge only value-only imports.

### File layout

Order within a file: imports → types → module constants → implementation. No `import` after the first statement. Put `export` on the declaration itself; reserve a trailing `export { … }` block for barrel files. A file should be predictable from its name: if its exports don't match what the name promises, it is two files.

Group imports in order: external libraries → internal modules → relative imports, separated by a blank line.

## React Frontend Conventions

When working in `ui/`:

- **Components**: functional components with hooks, TypeScript
- **State management**: TanStack Query for server state, Redux Toolkit for client/global state
- **Styling**: Tailwind CSS v4 + Shadcn UI components
- **Auth**: Clerk (`SignedIn`/`SignedOut` wrappers, `ProtectedRoute`/`PublicRoute`)
- **API**: `useApiClient()` (`ky` instance with Bearer token)
- **Routing**: React Router in `App.tsx`
- **Named exports, not default exports**
- **Path alias**: `@/*` → `src/*`

## Process

1. Understand the requirement and identify which files and layers are affected
2. Make a plan — which modules, which DTOs, which tests
3. Build from the bottom up — DTOs first, then service, then controller, then tests
4. Add TypeScript types first, then implement the logic
5. Write tests alongside the implementation
6. Run the linter and formatter
7. Review the diff to ensure nothing unnecessary is included