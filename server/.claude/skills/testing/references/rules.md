# Testing rules — full text and examples

Reference for the `testing` skill. The ten non-negotiable rules for server specs with correct and wrong examples. Load when writing or reviewing a spec.

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

### 5. Override guards on the builder, before `.compile()`

```ts
// CORRECT — chained on the TestingModuleBuilder, then compile
class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true;
  }
}

const module: TestingModule = await Test.createTestingModule({
  controllers: [TopicController],
  providers: [{ provide: TopicService, useValue: topicService }],
})
  .overrideGuard(ClerkAuthGuard)
  .useClass(MockAuthGuard)
  .overrideGuard(RolesGuard)
  .useClass(MockAuthGuard)
  .compile();

// WRONG — overrideGuard does not exist on a compiled TestingModule
const compiled = await Test.createTestingModule({ ... }).compile();
compiled.overrideGuard(ClerkAuthGuard).useClass(MockAuthGuard);
```

`overrideGuard` is a method of the builder returned by
`Test.createTestingModule(...)`; it must run before `.compile()`. This repo
overrides with `.useClass(MockAuthGuard)` (see `topic.controller.spec.ts`,
`question.controller.spec.ts`, `theory.controller.spec.ts`,
`user.controller.spec.ts`) — follow that. Nest also accepts
`.useValue({ canActivate: () => true })`; use it only if a spec needs to
assert the guard was called, and keep one style per file.

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
