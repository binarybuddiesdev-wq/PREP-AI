# Mocking reference, mock shapes and coverage

Reference for the `testing` skill. What to mock and how, the Prisma and Postgres mock shapes, and the coverage thresholds.

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
