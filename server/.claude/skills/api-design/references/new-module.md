# New module and new endpoint procedures

Reference for the `api-design` skill. The file layout for a module, the step-by-step to add one, and the step-by-step to add a single endpoint to an existing module. Load when creating a module or an endpoint.

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
