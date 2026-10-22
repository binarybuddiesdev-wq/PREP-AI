---
name: testing
description: Use when writing, changing or debugging a server unit spec in PrepAI — *.spec.ts files, service and controller mocks, guard overrides, Mastra mocks, coverage thresholds, or vitest configuration. Server (NestJS, Vitest, SWC) only; ui/ tests use frontend-testing.
---

# Server Testing

How server specs are written and what they can and cannot prove. The gate that runs them is `server-verify-implementation`.

## When to use

- Creating or editing a `*.spec.ts` (controller or service)
- Deciding how to mock Prisma, a service, a guard or `mastra.config.js`
- Adjusting `vitest.config.ts` or the 90% coverage thresholds
- Debugging a spec that fails on mock shape, token or import

Frontend tests are `frontend-testing`.

## Setup at a glance

- **Runner:** Vitest with SWC (`unplugin-swc`), `globals: true`. `describe`, `it`, `expect`, `vi`, `beforeEach` are global, though the existing specs also import them from `'vitest'`; either is fine, stay consistent within a file.
- **Mocks:** `vi.fn()` only, never `jest.fn()`.
- **Discovery:** `src/**/*.spec.ts` (unit). `test/e2e/**/*.e2e-spec.ts` is configured but **has no files**.
- **Coverage:** v8, **90%** on lines, statements, functions and branches. Excluded: `main.ts`, `*.module.ts`, `*.types.ts`, `src/types/`, barrels, `src/config/`.
- **Imports:** relative and `@/` imports end in `.js`.
- **Run one spec:** `pnpm vitest run src/modules/<name>/<name>.service.spec.ts` from `server/`.

## Non-negotiable rules

One line each; the full rule with correct and wrong examples is in [`references/rules.md`](references/rules.md).

1. **`vi.fn()`, never `jest.fn()`.**
2. **A controller spec mocks the service**, never the real one.
3. **A service spec mocks Prisma with `{ provide: PrismaService, useValue: handBuiltMock }`**, not `vi.mock` of the service.
4. **Mock the logger with the token `'PinoLogger:<ClassName>'`** and `{ info, warn, error }` as `vi.fn()`s.
5. **Override guards on the builder, before `.compile()`**: `.overrideGuard(Guard).useClass(MockGuard)`.
6. **Recreate every mock in `beforeEach`** so tests do not share state.
7. **Assert the right shape per layer:** controllers return `{ message, data }`; services return raw data.
8. **`vi.mock()` at the top level of the file**, never inside `describe` or `beforeEach`.
9. **`vi.clearAllMocks()` in `beforeEach`** when a mock lives at module scope.
10. **Every public method, its success path and every `throw`.**

## What unit tests cannot prove

PrepAI's specs replace Prisma with hand-built objects. That makes them fast, and it means they **cannot** prove:

- a query's `where` actually returns only the right rows (including the per-user scoping that stops one user reading another's data);
- that a unique index rejects a duplicate, or that an index exists;
- cascade, relation or transaction behaviour;
- a `Json` column round trip;
- Mongo and Postgres semantics.

There is no integration tier today. Until one exists (adding one needs an ADR, not a drive-by in a feature):

1. **Assert the arguments, not just the result.** Prove the service builds the scoped query: `expect(prisma.question.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ topicId }) }))`, and `findFirst` with `{ where: { id, userId } }` for owned data.
2. **Write the cross-user case.** Stub the lookup to return `null` and assert `NotFoundException`; a happy-path-only spec does not test isolation.
3. **Say it plainly in your report:** "database behaviour (constraints, indexes, cascades) is not exercised by unit tests." Never claim a constraint or index is verified because a mocked spec is green.

## E2E state

`vitest.config.e2e.ts` exists and `pnpm test:e2e` is wired, but `server/test/e2e/` is empty, so the command exits non-zero with "No test files found" until the first file is added. The Playwright smoke specs live at the repo root in `e2e/` (see `server-verify-implementation` for how to run them and the dev-server caveat). Do not write a `test/e2e` file without agreeing the approach, because it needs a running app and a database.

## Task → reference

| When you are…                                                                           | Read                                                                   |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Changing vitest config or coverage, or a spec is not discovered                         | [`references/setup.md`](references/setup.md)                           |
| Unsure how a rule reads, or reviewing a spec                                            | [`references/rules.md`](references/rules.md)                           |
| Writing a new controller, service, Mastra-service or smoke spec                         | [`references/patterns.md`](references/patterns.md)                     |
| Shaping a Prisma or Postgres mock, or checking what to mock and the coverage thresholds | [`references/mocks-and-coverage.md`](references/mocks-and-coverage.md) |

## Common mistakes

| Mistake                                        | Symptom                                   | Fix                                            |
| ---------------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| `jest.fn()`                                    | mock not working                          | `vi.fn()`                                      |
| Missing `.js` extension                        | `Cannot find module`                      | Add it to every relative import                |
| Prisma mock missing a method the service calls | `prisma.topic.findMany is not a function` | Add every method used                          |
| `{ message, data }` asserted in a service spec | fails: service returns raw data           | Assert the raw return                          |
| Raw data asserted in a controller spec         | fails: controller wraps                   | Assert `{ message: expect.any(String), data }` |
| `overrideGuard` after `.compile()`             | `overrideGuard is not a function`         | Chain it on the builder before `.compile()`    |
| `vi.mock()` inside `describe`                  | real module loaded                        | Move it to the top of the file                 |
| Happy path only                                | branches under 90%                        | A test per `throw` and per branch              |
| Real service in a controller spec              | slow, hits the database                   | `useValue` mock                                |

## Adding a spec

1. Read the reference: `topic.controller.spec.ts` and `topic.service.spec.ts`.
2. Create it next to the source: `modules/<name>/<name>.controller.spec.ts` and `<name>.service.spec.ts`.
3. Controller spec: mock guard class, mock service of `vi.fn()`s, `Test.createTestingModule`, `.overrideGuard(...)` on the builder, assert `{ message, data }` and exception types.
4. Service spec: hand-built Prisma mock, logger mock with the Pino token, assert raw data and exception types, one test per public method plus one per `throw`.
5. A service that calls an agent: `vi.mock('../../mastra/mastra.config.js', …)` at the top level, `getAgent: () => ({ generate: mockGenerate })`, and `mockGenerate` resolving `{ object, text }`.
6. Run it (`pnpm vitest run <file>`), then `pnpm test:coverage` and confirm the file is above 90% on all four metrics.

## When in doubt

Read `topic.controller.spec.ts` and `topic.service.spec.ts` and mirror them.
