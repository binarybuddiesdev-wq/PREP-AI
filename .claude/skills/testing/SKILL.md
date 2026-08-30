---
name: testing
description: Use when writing or modifying tests in the PrepAI server — unit specs, service mocks, controller guards, e2e setup, coverage thresholds, or vitest configuration. Triggers on any *.spec.ts file, any test/e2e/ work, or any change to vitest.config.ts.
---

# Testing

> If you are writing tests for the PrepAI `server/` package, this is your
> playbook. It covers the vitest setup, the mock conventions, the spec
> file patterns, and the coverage requirements — every convention the
> codebase actually uses.
>
> For the broader backend context (how tests fit into modules, services,
> controllers), see the `nestjs-developer` skill.

## When to use this skill

Use this skill whenever you are:

- Creating a new `*.spec.ts` file (controller or service)
- Adding a test to an existing spec
- Deciding how to mock Prisma, a service, or a guard
- Configuring vitest or adjusting coverage thresholds
- Writing an e2e test (the config exists, no files yet)
- Debugging why a test fails (mock shape mismatch, wrong token, missing `vi.fn()`)
- Adding a new Mastra agent and need to mock `mastra.config.js`

If the work is only frontend tests, this skill does not apply — see
`react-developer` for frontend testing conventions.

## The testing setup at a glance

- **Framework:** Vitest 4.1.8 (not Jest)
- **Transpiler:** SWC via `unplugin-swc` (not ts-jest, not babel)
- **Module system:** ESM / NodeNext — both relative imports (`./`, `../`) AND path alias imports (`@/...`) SHOULD include the `.js` extension (e.g. `import { PrismaService } from '@/prisma/prisma.service.js'`).
- **Globals:** `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll` are all globally available (`globals: true` in vitest config). You do not need to import them. The TypeScript config (`tsconfig.json`) has `"types": ["vitest/globals"]`.
- **Mock framework:** `vi.fn()` exclusively. Never `jest.fn()`.
- **Coverage:** v8 provider, hard 90% thresholds on **lines**, **statements**, **functions**, and **branches**.
- **Path alias:** `@/` → `./src` via vitest alias config.

## The vitest configuration

### Unit tests — `vitest.config.ts`

```ts
// server/vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    // ... alias, plugins, coverage
  },
});
```

- **`include`**: only `src/**/*.spec.ts`. Files outside `src/` are not
  discovered by this config.
- **Coverage reporter**: `['text', 'json', 'html']`.
- **Coverage excludes**: `src/main.ts`, `src/**/*.module.ts`,
  `src/**/*.types.ts`, `src/types/**/*`, `src/common/index.ts`,
  `src/prisma/index.ts`, `src/config/**/*`.
- **No custom matchers**, no `expect.extend(...)`, no setup file.

### E2E tests — `vitest.config.e2e.ts`

- **`include`**: `test/e2e/**/*.e2e-spec.ts`.
- The config exists and is wired (`pnpm test:e2e`), but **no e2e test
  files have been written yet**. When you write the first one, follow
  the structure of `vitest.config.e2e.ts` exactly.
- E2E tests are not instrumented (no coverage block in the e2e config).

### Available scripts (from `server/package.json`)

| Script               | What it does                               |
| -------------------- | ------------------------------------------ |
| `pnpm test`          | `vitest run` — unit tests once             |
| `pnpm test:watch`    | `vitest` — watch mode                      |
| `pnpm test:coverage` | `vitest run --coverage` — with v8 report   |
| `pnpm test:e2e`      | `vitest run --config vitest.config.e2e.ts` |

## The non-negotiable rules

### 1. Use `vi.fn()` — never `jest.fn()`

```ts
// CORRECT
const mockFn = vi.fn();
mockFn.mockResolvedValue({ id: '1' });

// WRONG
const mockFn = jest.fn();
mockFn.mockResolvedValue({ id: '1' });
```

Vitest and Jest are incompatible mocking APIs. `vi.fn()` is the only
mock function in this project.

### 2. Controller specs mock the service — never call the real service

Every controller spec uses `Test.createTestingModule` with `useValue`
to inject a mock service. The controller tests the HTTP layer only.

```ts
// CORRECT — mock the service
const module: TestingModule = await Test.createTestingModule({
  controllers: [TopicController],
  providers: [{ provide: TopicService, useValue: topicService }],
}).compile();

// WRONG — calling the real service in a controller spec
const module: TestingModule = await Test.createTestingModule({
  controllers: [TopicController],
  providers: [TopicService],
}).compile();
```

If the service is real, the test hits Prisma, the database, and the
test fails or is slow. Controller specs must be fast and isolated.

### 3. Service specs mock Prisma with `useValue` — never `vi.mock` for PrismaService

```ts
// CORRECT
prisma = {
  topic: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
// ...
providers: [
  TopicService,
  { provide: PrismaService, useValue: prisma },
],

// WRONG
vi.mock('@/prisma/prisma.service.js', () => ({ PrismaService: ... }));
```

PrismaService is always mocked via `useValue` with a hand-built object
shaped exactly like the Prisma client. The mock methods are called
`.mockResolvedValue(...)`, `.mockResolvedValueOnce(...)`, or
`.mockImplementation(...)`.

### 4. Mock the logger with the Pino token — not the class name

```ts
// CORRECT — the NestJS pino provider token
{ provide: 'PinoLogger:TopicService', useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }

// WRONG — this token does not exist
{ provide: TopicService, useValue: { logger: { ... } } }
```

The token format is `'PinoLogger:' + ServiceClassName`. The mock object
must have `info`, `warn`, and `error` methods, each a `vi.fn()`.

### 5. Override guards with `.overrideGuard().useClass()` — not `useValue`

```ts
// CORRECT
class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true;
  }
}
// ...
module = await Test.createTestingModule({
  controllers: [TopicController],
  providers: [{ provide: TopicService, useValue: topicService }],
}).compile();
module.overrideGuard(ClerkAuthGuard).useClass(MockAuthGuard);
module.overrideGuard(RolesGuard).useClass(MockAuthGuard);
await module.compile();

// WRONG — guards cannot be overridden with useValue
module.overrideGuard(ClerkAuthGuard).useValue({ canActivate: () => true });
```

Guards implement `CanActivate` and must be overridden with `useClass`,
not `useValue`. The mock class must implement `CanActivate`.

### 6. Every spec file uses `beforeEach` to recreate mocks

```ts
// CORRECT
beforeEach(async () => {
  prisma = { topic: { findFirst: vi.fn(), ... } };
  mockPinoLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const module: TestingModule = await Test.createTestingModule({ ... }).compile();
  service = module.get(TopicService);
});

// WRONG — stale mocks from a previous test
beforeEach(() => {
  // mocks not recreated, carrying state from prior tests
});
```

Recreate all mock objects inside `beforeEach` so each test starts
fresh. Stale mocks cause cross-test pollution.

### 7. Assert the correct shape for each layer

```ts
// Controller spec — expect { message, data }
expect(result).toEqual({ message: CREATE_TOPIC_SUCCESS, data: mockTopic });

// Service spec — expect raw data, no envelope
expect(result).toEqual(mockTopic);
```

Controllers wrap the service result in `{ message, data }`. Services
return raw data. Asserting the wrong shape is the most common test-fails
pattern.

### 8. Use `vi.mock()` at the top of the file for external modules

```ts
// CORRECT — top-level, outside describe
vi.mock('../../mastra/mastra.config.js', () => ({
  mastra: {
    getAgent: () => ({ generate: mockGenerate }),
  },
}));

// WRONG — inside describe or beforeEach
describe('...', () => {
  vi.mock(...) // must be at top level
});
```

`vi.mock()` calls must be at the top level of the file, not inside
`describe`, `beforeEach`, or any function. This is a vitest requirement.

### 9. Clear mocks between tests when mocks are at module scope

```ts
// CORRECT — when mocks are declared at module top-level
beforeEach(() => {
  vi.clearAllMocks();
});

// WRONG — mocks at module scope but never cleared
// (stale call counts leak between tests)
```

If you declare `const mockFn = vi.fn()` at module scope (outside
`beforeEach`), call `vi.clearAllMocks()` in `beforeEach`. If you
recreate the mock inside `beforeEach`, you don't need `clearAllMocks`.

### 10. Cover every public method, success + every thrown exception

Each service spec must test:

- Every public method at least once
- The success path for each method
- Every `throw` in the service (each throws a different exception type)

```ts
// topic.service.spec.ts must test:
// - createTopic: success path
// - createTopic: ConflictException when duplicate exists
// - getTopicBySlug: success path
// - getTopicBySlug: NotFoundException when missing
// - getAllTopics: success path
// - deleteTopic: success path
// - deleteTopic: BadRequestException when questions exist
```

A spec that only tests the happy path is incomplete — the exception
paths are where bugs live.

## The spec file patterns

### Controller spec — full NestJS testing module

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { TopicController } from './topic.controller.js';
import { TopicService } from './topic.service.js';
import { ClerkAuthGuard, RolesGuard } from '@/common/index.js';
import { CREATE_TOPIC_SUCCESS } from '@/common/constants/api.constants.js';
import { TopicService } from './topic.service.js';

describe('TopicController', () => {
  let controller: TopicController;
  let service: TopicService;

  // 1. Mock guard class
  class MockAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      return true;
    }
  }

  // 2. Create mock service object with typed mock methods
  const topicService = {
    createTopic: vi.fn().mockResolvedValue({ id: '1', name: 'React' }),
    getTopicBySlug: vi.fn().mockResolvedValue(null),
  } as unknown as TopicService;

  // 3. beforeEach: compile fresh module each time
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TopicController],
      providers: [{ provide: TopicService, useValue: topicService }],
    })
      .overrideGuard(ClerkAuthGuard)
      .useClass(MockAuthGuard)
      .overrideGuard(RolesGuard)
      .useClass(MockAuthGuard)
      .compile();

    controller = module.get(TopicController);
    service = module.get(TopicService);
  });

  // 4. Tests: assert controller shape { message, data }
  it('returns the success envelope on create', async () => {
    const result = await controller.createTopic({
      name: 'React',
      category: 'practice',
      slug: 'react',
    });
    expect(result).toEqual({ message: expect.any(String), data: { id: '1', name: 'React' } });
    expect(topicService.createTopic).toHaveBeenCalledWith({
      name: 'React',
      category: 'practice',
      slug: 'react',
    });
  });

  // 5. Error case: assert the thrown exception type
  it('throws ConflictException when slug already exists', async () => {
    topicService.createTopic.mockRejectedValue(new ConflictException('already exists'));
    await expect(
      controller.createTopic({ name: 'React', category: 'practice', slug: 'react' })
    ).rejects.toThrow(ConflictException);
  });
});
```

### Service spec — mock Prisma + Logger

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PrismaService } from '@/prisma/prisma.service.js';
import { TopicService } from './topic.service.js';

describe('TopicService', () => {
  let service: TopicService;
  let prisma: { topic: { findFirst: ReturnType<typeof vi.fn>; ... } };
  let mockPinoLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      topic: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    mockPinoLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopicService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'PinoLogger:TopicService', useValue: mockPinoLogger },
      ],
    }).compile();

    service = module.get(TopicService);
  });

  it('creates a topic successfully', async () => {
    prisma.topic.findFirst.mockResolvedValue(null); // no duplicate
    prisma.topic.create.mockResolvedValue({ id: '1', name: 'React', slug: 'react' });
    const result = await service.createTopic({ name: 'React', category: 'practice', slug: 'react' });
    expect(result).toEqual({ id: '1', name: 'React', slug: 'react' }); // raw data, no envelope
    expect(prisma.topic.create).toHaveBeenCalledWith({ data: { name: 'React', category: 'practice', slug: 'react' } });
  });

  it('throws ConflictException when topic already exists', async () => {
    prisma.topic.findFirst.mockResolvedValue({ id: '1', name: 'React' });
    await expect(service.createTopic({ name: 'React', category: 'practice', slug: 'react' })).rejects.toThrow(ConflictException);
  });
});
```

### Mastra agent spec — mock mastra.config.js

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { TechExpertService } from './tech-expert.service.js';

// Top-level vi.mock for the mastra config module
const mockGenerate = vi.fn();
vi.mock('../../mastra/mastra.config.js', () => ({
  mastra: {
    getAgent: () => ({
      generate: mockGenerate,
    }),
  },
}));

describe('TechExpertService', () => {
  let service: TechExpertService;

  beforeEach(async () => {
    mockGenerate.mockResolvedValue({ object: { topic: 'Arrays' }, text: '{"topic":"Arrays"}' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [TechExpertService],
    }).compile();
    service = module.get(TechExpertService);
  });

  it('returns structured answer', async () => {
    const result = await service.askQuestion({ question: 'What are arrays?' });
    expect(result.data).toEqual({ topic: 'Arrays' });
    expect(mockGenerate).toHaveBeenCalled();
  });
});
```

### Simple controller spec — no NestJS testing module

For controllers with no guards and no Prisma dependency:

```ts
import { vi } from 'vitest';
import { TechExpertController } from './tech-expert.controller.js';
import { TechExpertService } from './tech-expert.service.js';

describe('TechExpertController', () => {
  let controller: TechExpertController;
  let service: TechExpertService;

  beforeEach(() => {
    const mockService = { askQuestion: vi.fn() } as unknown as TechExpertService;
    controller = new TechExpertController(mockService);
    service = mockService;
  });

  it('returns the response', async () => {
    service.askQuestion.mockResolvedValue({ data: { topic: 'Arrays' }, error: null, meta: {} });
    const result = await controller.ask({ question: 'What are arrays?' });
    expect(result).toEqual({ data: { topic: 'Arrays' }, error: null, meta: {} });
  });
});
```

### Smoke test — service with no dependencies

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { QuestionService } from './question.service.js';

describe('QuestionService', () => {
  it('should be defined', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuestionService],
    }).compile();
    const service = module.get(QuestionService);
    expect(service).toBeDefined();
  });
});
```

## The mocking reference table

| What to mock                           | How                                                                    | Pattern                                            |
| -------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| Service (controller spec)              | `{ provide: SomeService, useValue: mockObj }`                          | Inline mock object                                 |
| PrismaService (service spec)           | `{ provide: PrismaService, useValue: prisma }`                         | Hand-built mock shaped like Prisma client          |
| PrismaPostgresqlService (service spec) | `{ provide: PrismaPostgresqlService, useValue: postgres }`             | Mock shaped like `{ client_: { model: { ... } } }` |
| Logger (service spec)                  | `{ provide: 'PinoLogger:ClassName', useValue: { info, warn, error } }` | PinoLogger + ClassName token                       |
| ClerkAuthGuard (controller spec)       | `.overrideGuard(ClerkAuthGuard).useClass(MockAuthGuard)`               | Mock class implements `CanActivate`                |
| RolesGuard (controller spec)           | `.overrideGuard(RolesGuard).useClass(MockAuthGuard)`                   | Same mock class for both guards                    |
| External npm package                   | `vi.mock('package-name', () => ({ ... }))`                             | Top-level, not inside describe                     |
| Local config module                    | `vi.mock('../../path/to/config.js', () => ({ ... }))`                  | Top-level, not inside describe                     |

## The mock shape conventions

### Prisma client mock (Topic)

```ts
prisma = {
  topic: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
```

Every model you query must have every method your service calls.
If your service calls `prisma.topic.findMany`, you must have
`findMany: vi.fn()` in the mock. A missing method returns `undefined`,
which causes a TypeError at runtime.

### Postgres client mock

```ts
postgres = {
  client_: {
    theorySession: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    theoryAnswer: {
      create: vi.fn(),
    },
  },
};
```

The Postgres mock mirrors the shape of `PrismaPostgresqlService.client_`.
Use `client_` (with trailing underscore) as the property name — that
matches the service's getter.

### Mock call setup

```ts
// Success
mockFn.mockResolvedValue({ id: '1', name: 'React' });

// Success, different values on consecutive calls
mockFn.mockResolvedValueOnce({ id: '1' }).mockResolvedValueOnce({ id: '2' });

// Error
mockFn.mockRejectedValue(new ConflictException('already exists'));

// Custom implementation
mockFn.mockImplementation((data) => { ... });
```

## Coverage — the hard thresholds

The vitest coverage config enforces:

| Metric     | Threshold |
| ---------- | --------- |
| Lines      | 90%       |
| Statements | 90%       |
| Functions  | 90%       |
| Branches   | 90%       |

Run `pnpm test:coverage` to see the report. If your new spec does
not push coverage above the threshold for a file, you need more test
cases — typically the exception paths or branch conditions.

**Coverage is excluded for:** `main.ts`, `*.module.ts`, `*.types.ts`,
`src/types/`, `common/index.ts`, `prisma/index.ts`, `config/`.

## E2E tests

The e2e config exists (`vitest.config.e2e.ts`) but no e2e test files
have been written yet. The convention:

- **Location:** `test/e2e/**/*.e2e-spec.ts`
- **Suffix:** `.e2e-spec.ts`
- **Pattern:** Real HTTP calls against a running server (both ui and
  server dev servers must be running)
- **No coverage:** e2e tests are not instrumented
- **Runner:** `pnpm test:e2e`

When you write the first e2e test, follow the structure of
`vitest.config.e2e.ts` and mirror any existing Playwright e2e tests
at the repo root.

## The test execution flow

```
pnpm test
  ↓
vitest run
  ↓
Discovers src/**/*.spec.ts
  ↓
Loads each file via SWC (unplugin-swc, nodenext)
  ↓
Runs each describe block sequentially
  ↓
beforeEach: recreate mocks, compile module
  ↓
Runs each it() block
  ↓
Reports: passed / failed / skipped
  ↓
Coverage report (if --coverage): lines/statements/functions/branches
```

## Common mistakes

| Mistake                                                    | Symptom                                              | Fix                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| `jest.fn()` instead of `vi.fn()`                           | `vi is not defined` or mock not working              | Replace with `vi.fn()`                              |
| Missing `.js` extension in import                          | `Cannot find module` at runtime                      | Add `.js` to every relative import                  |
| Missing `findMany` in Prisma mock                          | `TypeError: prisma.topic.findMany is not a function` | Add every method the service calls                  |
| Asserting `{ message, data }` in a service spec            | Test fails — service returns raw data                | Assert the raw return value                         |
| Asserting raw data in a controller spec                    | Test fails — controller wraps in `{ message, data }` | Assert `{ message: expect.any(String), data: ... }` |
| Guard override with `useValue`                             | Guard not actually overridden, test fails            | Use `.overrideGuard(Guard).useClass(MockGuard)`     |
| `vi.mock()` inside `describe`                              | Mock not applied, real module loaded                 | Move `vi.mock()` to top of file                     |
| No `beforeEach` recreating mocks                           | Stale mock state between tests                       | Recreate mocks inside `beforeEach`                  |
| `vi.clearAllMocks()` not called when mocks at module scope | Call counts leak between tests                       | Add `vi.clearAllMocks()` to `beforeEach`            |
| Testing only happy path                                    | Coverage < 90% on branches                           | Add exception path tests for every `throw`          |
| Real Prisma in controller spec                             | Slow test, hits database                             | Mock the service with `useValue`                    |

## Adding a new spec — the procedure

1. **Decide the type:** controller spec or service spec.
2. **Read the reference:** `topic.controller.spec.ts` or
   `topic.service.spec.ts`.
3. **Create the spec file** next to the source file:
   - `modules/<name>/<name>.controller.spec.ts`
   - `modules/<name>/<name>.service.spec.ts`
4. **For a controller spec:**
   - Mock guard class implementing `CanActivate`
   - Mock service object with `ReturnType<typeof vi.fn>` for each method
   - `Test.createTestingModule` with `useValue` for the service
   - `.overrideGuard(...).useClass(MockAuthGuard)` for both guards
   - Tests asserting `{ message, data }` for success, exception type for errors
5. **For a service spec:**
   - Hand-built Prisma mock shaped like the Prisma client
   - Logger mock with `'PinoLogger:ClassName'` token
   - `Test.createTestingModule` with `useValue` for PrismaService and logger
   - Tests asserting raw data for success, exception type for errors
   - One test per public method, plus one per thrown exception
6. **For a Mastra-powered service spec:**
   - `vi.mock('../../mastra/mastra.config.js', ...)` at top level
   - Mock `getAgent: () => ({ generate: mockGenerate })`
   - Set `mockGenerate.mockResolvedValue({ object: ..., text: ... })`
7. **Run the spec:** `pnpm vitest run modules/<name>/<name>.service.spec.ts`
8. **Check coverage:** `pnpm test:coverage` — confirm the file is above 90%
   on all four metrics.

## When in doubt

Read `topic.controller.spec.ts` and `topic.service.spec.ts`. Mirror
them exactly. If your spec looks different, you are probably doing it
wrong.
