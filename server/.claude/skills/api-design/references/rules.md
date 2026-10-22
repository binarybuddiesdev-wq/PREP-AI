# API rules — full text and examples

Reference for the `api-design` skill. The non-negotiable API rules with examples, including the Fastify request typing and the ESM barrel-import rule. Load when writing or reviewing a controller.

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

9. **Never modify the global `TransformInterceptor` or `GlobalExceptionFilter`**
   to accommodate a new endpoint shape. The envelope is fixed.

10. **Never use `process.env.X` directly in a controller or service.** Go
    through `ConfigService` from `@nestjs/config` instead. (Module-load-time
    code such as `mastra/providers.ts` is the accepted exception — see
    `nestjs-developer` Rule #8.)

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
