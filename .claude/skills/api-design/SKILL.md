---
name: api-design
description: Use when creating, modifying, or reviewing any backend API endpoint in the PrepAI NestJS server. Triggers on any work inside server/src/modules/, server/src/common/, or routes/ that involves HTTP endpoints, controllers, services, or DTOs. Also use when the user asks about API design, error envelope format, or the response shape used by this project.
---

# PrepAI Backend API

> This skill encodes the conventions of the PrepAI NestJS backend so a new
> endpoint or module is built the same way every time, with the same file
> structure, response envelope, validation, logging, and Swagger docs.

## When to use this skill

Use this skill whenever you are:

- Creating a new module under `server/src/modules/<name>/`
- Adding a new endpoint (POST, GET, PATCH, DELETE) to an existing controller
- Creating a new DTO (request body, query params, path params)
- Adding a success/error message to `server/src/common/constants/api.constants.ts`
- Creating a Swagger response schema under `server/src/common/schemas/<name>/`
- Updating the route spec at `routes/<name>-api-spec.md`
- Reviewing or refactoring any of the above

If the task is purely about the Prisma schema, AI agents, queues, or the
frontend, **this skill does not apply** — pick a different one.

## The PrepAI backend at a glance

- **Framework:** NestJS 11 with Fastify adapter (NOT Express)
- **Module system:** ESM / NodeNext — every relative import MUST end with `.js`
  (even for `.ts` files)
- **Path alias:** `@/*` → `src/*` (configured in `tsconfig.json`)
- **Auth:** `ClerkAuthGuard` + `RolesGuard` at the controller level
- **Logging:** `nestjs-pino` via `@InjectPinoLogger(X.name)` — never `console.log`
- **Validation:** Both `class-validator` (DTOs) and `ZodValidationPipe` are used
- **API docs:** Swagger at `http://localhost:3000/docs`, decorated with
  `@nestjs/swagger`
- **Caching:** `CacheModule` is global, backed by Redis
- **ORM:** Prisma with two clients — `PrismaService` (Mongo) and
  `PrismaPostgresqlService` (Postgres). The Postgres client no-ops gracefully
  if `POSTGRESQL_URL` is unset or the client hasn't been generated yet.

## The response envelope — never deviate

Every successful controller method returns this shape:

```ts
return { message: SOME_SUCCESS_CONSTANT, data };
```

The `TransformInterceptor` (global) wraps this in:

```json
{ "success": true, "message": "...", "data": ... }
```

**Rules:**

- Never construct the envelope in the controller — return `{ message, data }`
- The `data` field can be `null`, an object, or an array
- Success messages are imported from `@/common/constants/api.constants.js`
- Error responses come from NestJS `HttpException` subclasses (the global
  `HttpExceptionFilter` formats them)

## HTTP status codes — the conventions

| Method                      | Success                                          | Common errors                    |
| --------------------------- | ------------------------------------------------ | -------------------------------- |
| `POST` (create)             | `201 Created`                                    | `400` validation, `409` conflict |
| `POST` (action, not create) | `200 OK` or `202 Accepted` (if async)            | `400`, `403`, `404`              |
| `GET`                       | `200 OK`                                         | `404`                            |
| `PATCH`                     | `200 OK`                                         | `400`, `404`, `409`              |
| `DELETE`                    | `200 OK` (with `data: null`) or `204 No Content` | `404`, `409`                     |

Always set the status with `@HttpCode(201)` (or whatever) at the handler
level — don't rely on the framework default. See `topic.controller.ts` for
the canonical pattern.

## The file structure for a new module

For a new module called `coding`, create exactly these files:

```
server/src/modules/coding/
├── coding.module.ts
├── coding.controller.ts
├── coding.service.ts
├── coding.controller.spec.ts
├── coding.service.spec.ts
└── dto/
    ├── index.ts                       # barrel: export * from each DTO
    ├── create-coding.dto.ts
    ├── update-coding.dto.ts
    └── get-coding.dto.ts              # query params
```

Plus the supporting files in `server/src/common/`:

```
server/src/common/constants/api.constants.ts
  ↳ Add ApiTags.CODING, ApiRoutes.CODING, ApiOperation.CODING_*, success messages

server/src/common/schemas/coding/coding.response.schema.ts
  ↳ Add response schemas (one per endpoint)
```

Plus registration in `server/src/app.module.ts`:

```ts
imports: [..., CodingModule, ...]
```

Plus the spec doc at `routes/coding-api-spec.md` (mirrors the spec pattern
of `routes/topics-api-spec.md`).

## Step-by-step: how to add a new module

1. **Read the spec first.** Open `routes/<name>-api-spec.md`. If it doesn't
   exist, the user hasn't designed the endpoints yet — STOP and ask them to
   write the spec, or write it together with them before writing code.

2. **Read the reference module.** Open `server/src/modules/topic/` end-to-end
   (controller, service, DTOs, spec, response schema). It is the canonical
   reference for how every CRUD module should look. Mirror its structure.

3. **Read the constants file.** `server/src/common/constants/api.constants.ts`
   has `ApiTags`, `ApiRoutes`, `ApiOperation`, and all success/error messages.
   You will add to it, not edit existing entries.

4. **Create the DTOs** in `dto/`. Use `class-validator` decorators
   (`@IsString`, `@IsNotEmpty`, `@IsOptional`, `@IsIn`, etc.) and
   `@ApiProperty` / `@ApiPropertyOptional` for Swagger docs. **Never** use
   `any` in a DTO field.

5. **Create the barrel** at `dto/index.ts`:

   ```ts
   export * from './create-coding.dto.js';
   export * from './update-coding.dto.js';
   export * from './get-coding.dto.js';
   ```

6. **Create the service** with `@Injectable()`. Constructor takes
   `PrismaService` (or `PrismaPostgresqlService` for Postgres-only modules) and
   `@InjectPinoLogger(X.name)`. Each method:
   - Validates preconditions (throw `NotFoundException`, `ConflictException`,
     `BadRequestException` as appropriate)
   - Calls Prisma
   - Logs success with `@InjectPinoLogger` (`this.logger.info({...}, 'msg')`)
   - Returns the entity

7. **Create the controller** with:
   - `@ApiTags(ApiTagsEnum.<NAME>)` and `@Controller(ApiRoutes.<NAME>)`
   - `@UseGuards(ClerkAuthGuard, RolesGuard)` at the class level
   - `@ApiBearerAuth()` on every handler that needs auth
   - `@Public()` on handlers that should skip auth (rare)
   - `@Roles('ADMIN')` on admin-only handlers
   - `@HttpCode(201)` on `POST` create, `@HttpCode(200)` on everything else
   - `@ApiOperation({ summary: ApiOperationEnum.X })` on every handler
   - `@ApiResponse(XxxResponse)` on every handler (imports from
     `common/schemas/<name>/`)
   - Return `{ message: SOME_SUCCESS, data }` — never the bare data

8. **Create the response schemas** in
   `server/src/common/schemas/<name>/<name>.response.schema.ts`. One
   `const` per response (e.g., `CreateXxxResponse`, `GetAllXxxResponse`).
   Each uses `successResponseSchema(dataSchema, message)` from
   `common/constants/api.constants.js`. **No business logic in schema files.**

9. **Create the module** in `<name>.module.ts`:

   ```ts
   @Module({
     providers: [XService],
     controllers: [XController],
   })
   export class XModule {}
   ```

10. **Register the module** in `app.module.ts` imports.

11. **Write the spec** tests:
    - `controller.spec.ts` — mock the service, test that the right message
      and status come back
    - `service.spec.ts` — mock Prisma, test business logic
    - See `topic.controller.spec.ts` and `topic.service.spec.ts` for the
      pattern (they use `vi.fn()` mocks)

12. **Update the route spec** at `routes/<name>-api-spec.md` with the
    request/response examples. Keep it in sync with the code.

## Step-by-step: how to add a single endpoint to an existing module

If the module already exists and you're just adding one endpoint:

1. Read the existing `controller.ts` and `service.ts` end-to-end
2. Add the success message to `api.constants.ts` (in the right `*_SUCCESS` group)
3. Add the operation enum value to `ApiOperation` in `api.constants.ts`
4. Add the response schema in `common/schemas/<name>/`
5. Add the handler method in the controller (mirror the style of the others)
6. Add the service method (with the same logging + exception style)
7. Add DTOs in `dto/` if it's a new request shape
8. Update `routes/<name>-api-spec.md`

## The non-negotiable rules

These are not guidelines. Code that violates them is wrong.

1. **Never `console.log`.** Always `@InjectPinoLogger(X.name)` and
   `this.logger.info({...}, 'message')`.

2. **Never return bare data from a controller.** Always
   `return { message: X_SUCCESS, data }` (or `return { message: X_SUCCESS }`
   for delete with no body).

3. **Never skip the `@HttpCode` decorator** on a handler.

4. **Never use `any` in a DTO field type.** Use `string`, `number`, or a
   specific union/interface.

5. **Never put business logic in the controller.** Controller methods
   should be 2-3 lines: call service, return `{message, data}`. Validation,
   DB queries, side effects — all in the service.

6. **Never import without the `.js` extension** in relative imports (ESM
   requirement). The path alias `@/...` is fine without `.js`.

7. **Never use Express.** The framework is Fastify. If you find yourself
   importing from `express`, stop.

8. **Never hardcode success/error messages** as string literals in
   controllers or services. Add to `api.constants.ts` and import.

9. **Never modify the global `TransformInterceptor` or `HttpExceptionFilter`**
   to accommodate a new endpoint shape. The envelope is fixed.

10. **Never use `process.env.X` directly in a service.** Go through
    `ConfigService` from `@nestjs/config` instead.

11. **Never import the DTO barrel without the `.js` extension.** ESM
    / NodeNext requires the explicit extension even for barrel files. In
    a controller or service:

    ```ts
    // CORRECT
    import { CreateCodingDto } from './dto/index.js';
    // WRONG — silently resolves to nothing in some bundlers
    import { CreateCodingDto } from './dto';
    ```

    Same rule applies to `common/index.ts` re-exports — always
    `from '@/common/index.js'`, never just `from '@/common'`.

12. **Never use `Request` from `express` (or `@nestjs/common`).** We run
    on Fastify. If an endpoint needs the raw request (for headers,
    client IP, cookies), inject the Fastify request explicitly:
    ```ts
    import { FastifyRequest } from 'fastify';

    @Post()
    async create(
      @Body() dto: CreateCodingDto,
      @Req() req: FastifyRequest,
    ) {
      const ip = req.ip;
      // ...
    }
    ```
    Never `@Req() req: Request` from `@nestjs/common` or `import { Request } from 'express'`. The framework
    adapter is Fastify; the types must match.

## The skills/lessons baked into this project

- **Two-database pattern** is documented in ADR-0001. New modules that need
  sessions/answers/vectors go in Postgres (via `PrismaPostgresqlService`).
  New modules that need content/users/questions go in Mongo (via
  `PrismaService`).

- **Clerk webhook creates the User** — see `modules/user/webhook.controller.ts`
  and ADR-0002. Never create a User in any other place.

- **Redis quota counters** — see ADR-0005. The pattern for daily limits is
  `INCR` + `EXPIRE` on first hit. Add quota logic in the service, never
  in the controller.

- **Idempotency on mutating endpoints** — see `TODO.md` item #7. When you
  add an endpoint that creates a session, charges a user, or has any
  irreversible side effect, accept an `Idempotency-Key` header.

## Read these before you start any backend API work

1. `server/src/modules/topic/` — the canonical reference module
2. `server/src/common/constants/api.constants.ts` — all messages
3. `server/src/common/schemas/topics/topics.response.schema.ts` — schema pattern
4. `routes/topics-api-spec.md` — the spec pattern
5. `docs/adr/0001-polyglot-persistence.md` — which DB to use
6. `docs/adr/0002-clerk-webhook-vs-lazy-create.md` — how Users are created
7. `docs/adr/0005-redis-quota-counters.md` — how to enforce daily limits
8. `docs/architecture/TODO.md` — what's still missing in the system design

## When in doubt

Mirror the `topic` module. Every convention in this codebase is
demonstrated there. If your new code looks different, it's probably wrong.
