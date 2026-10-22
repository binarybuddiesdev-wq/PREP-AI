# NestJS rules — full text and examples

Reference for the `nestjs-developer` skill. The twelve non-negotiable rules, each with a correct and a wrong example. Load when writing or reviewing code that one of the one-line rules in `SKILL.md` applies to.

## The non-negotiable rules

These are not guidelines. Code that violates them is wrong.

### 1. ESM / NodeNext imports — every relative import has `.js`

```ts
// CORRECT
import { TopicService } from './topic.service.js';
import { ApiTags } from '@/common/index.js';

// WRONG
import { TopicService } from './topic.service';
import { TopicService } from './topic.service.ts';
import { ApiTags } from '@/common';
```

Path alias imports starting with `@/` SHOULD also include the `.js` extension
(e.g., `import { ApiTags } from '@/common/index.js'`) for full ESM/NodeNext
compatibility across bundlers and node runtimes. Same for relative imports
and DTO barrels — `import { CreateXxxDto } from './dto/index.js'`, never
just `'./dto'`.

### 2. Fastify, not Express

We run on `@nestjs/platform-fastify`. If you reach for anything from
`express`, stop.

- For raw request access, import `FastifyRequest` / `FastifyReply` from
  `'fastify'`, never `Request` from `'express'`.
- The global exception filter, guards, and middleware are typed against
  Fastify. Use the Fastify types throughout.
- `app.getHttpAdapter().getInstance()` returns a Fastify instance, not
  Express.

### 3. Never `console.log` in services — use `@InjectPinoLogger`

```ts
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class TopicService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(TopicService.name)
    private readonly logger: PinoLogger
  ) {}

  async createTopic(dto: CreateTopicDto) {
    this.logger.info({ name: dto.name }, 'topic created');
    return this.prisma.topic.create({ data: dto });
  }
}
```

The `Logger` from `@nestjs/common` is acceptable in global infrastructure
(guards, filters, middleware) but never in services or controllers.

### 4. Throw NestJS exceptions, not raw `Error`

```ts
// CORRECT
throw new NotFoundException(TOPIC_NOT_FOUND);
throw new ConflictException(TOPIC_ALREADY_EXISTS);
throw new BadRequestException(CANNOT_DELETE_TOPIC_WITH_QUESTIONS);

// WRONG
throw new Error('Topic not found');
```

The global `GlobalExceptionFilter` reads `HttpException` subclasses and
formats the response correctly. Raw `Error` becomes a 500 with a generic
message.

### 5. The response envelope is fixed — never construct it

Every successful controller method returns `{ message, data }`:

```ts
return { message: CREATE_TOPIC_SUCCESS, data };
```

The global `TransformInterceptor` wraps this in
`{ success: true, message, data }`. You never construct the envelope
yourself in the controller.

### 6. DTOs use `class-validator`, not Zod (mostly)

For request/response shapes, use `class-validator` decorators:

```ts
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateTopicDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['practice', 'coding'])
  category!: string;
}
```

`ZodValidationPipe` is used in a few specific modules (typically when
schemas need to be reused client-side). The default is class-validator.

### 7. Use `PrismaService` (Mongo) or `PrismaPostgresqlService` — never raw PrismaClient

Inject the appropriate service, never instantiate `new PrismaClient()` in
your own code. The two services in `prisma/prisma.service.ts` are the
single point of access.

- **Mongo** (`PrismaService`): users, topics, questions, pdf metadata
- **Postgres** (`PrismaPostgresqlService`): sessions, answers, payments,
  jobs, idempotency keys, audit log, vectors. The Postgres client **no-ops
  gracefully** if `POSTGRESQL_URL` is unset — code that calls it must
  check for `undefined` (use `?.`)

Which database for what: see ADR-0001.

### 8. Never `process.env.X` directly — go through `ConfigService`

```ts
// CORRECT
constructor(private readonly config: ConfigService) {
  const key = this.config.get<string>('CLERK_SECRET_KEY');
}

// WRONG
const key = process.env.CLERK_SECRET_KEY;
```

The env schema in `server/src/config/env.validation.ts` validates and
types every env var at boot. Reading `process.env` directly bypasses this
and breaks the single source of truth.

**Where the rule applies, and where it does not.** `ConfigService` is
injected, so it only works where Nest builds the object. Two places read
`process.env` today for that reason:

- `src/mastra/providers.ts` constructs the LLM provider clients when the
  module is first imported, before any DI container exists.
- `src/config/**` and `src/prisma/**` run during bootstrap.

`ClerkAuthGuard` (`common/guards/clerk-auth.guard.ts`) also reads
`process.env.CLERK_SECRET_KEY` at request time. It is injectable, so it is
**backlog, not precedent**.

So: in any controller, service, guard, interceptor, pipe or middleware
**you add or change**, use `ConfigService`. In module-load-time code
(`providers.ts`) reading `process.env` is accepted, but the variable must
still be declared in `env.validation.ts`. Reviewers flag only `process.env`
reads **added by the diff** outside those locations, never the existing ones.

### 9. Add new constants to `api.constants.ts`, never hardcode strings

```ts
// CORRECT
throw new NotFoundException(TOPIC_NOT_FOUND);
// where TOPIC_NOT_FOUND is imported from '@/common/index.js'

// WRONG
throw new NotFoundException('Topic not found');
```

All success messages, error messages, `ApiTags`, `ApiRoutes`, and
`ApiOperation` enum values live in `server/src/common/constants/api.constants.ts`.
Add new ones there; never inline string literals in controllers or
services.

### 10. Spec tests for every controller and service

```ts
// topic.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { TopicController } from './topic.controller.js';
import { TopicService } from './topic.service.js';

describe('TopicController', () => {
  let controller: TopicController;
  let service: TopicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TopicController],
      providers: [
        { provide: TopicService, useValue: { createTopic: vi.fn(), ... } },
      ],
    }).compile();

    controller = module.get(TopicController);
    service = module.get(TopicService);
  });

  it('returns the success envelope on create', async () => {
    vi.mocked(service.createTopic).mockResolvedValue({ id: '1', name: 'React' });
    const result = await controller.createTopic({ name: 'React', category: 'practice', slug: 'react' });
    expect(result).toEqual({ message: expect.any(String), data: { id: '1', name: 'React' } });
  });
});
```

Controller specs mock the service. Service specs mock Prisma with
`vi.fn()`. See `topic.controller.spec.ts` and `topic.service.spec.ts` for
the canonical pattern.

### 11. Register the module in `app.module.ts`

Every new module goes into the `imports` array of `AppModule`. The order
doesn't matter functionally, but follow the existing order (config first,
Prisma, then feature modules alphabetically).

### 12. Never modify the global `TransformInterceptor` or `GlobalExceptionFilter`

The envelope shape (`{ success, message, data }`) and the error shape
(`{ success: false, message, statusCode, path, timestamp }`) are fixed. If
a new endpoint needs a different shape, the answer is to fix the endpoint,
not the global filter.
