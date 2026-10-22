# Errors: status map, translation and logging

Reference for the `nestjs-developer` skill. The policy (the failure classes, one translation point, log once) is `server-developer` § Failure handling; this file is the NestJS mechanics and the status map. Load when writing error handling, a `catch`, or a new exception.

## How an error becomes a response

`GlobalExceptionFilter` (`common/filters/http-exception.filter.ts`) is the single translation point for request work:

- an `HttpException` keeps its own status and message;
- anything else becomes a 500 with the generic message `Internal server error`; the real error and stack are logged, never sent;
- a `statusCode: 429` object (the rate-limit plugin) becomes a 429;
- status 500 and above is logged at `error`, anything below at `warn`.

The body is always `{ success: false, message, statusCode, path, timestamp }`. **Nothing else survives**, so never rely on extra error fields, and never put internals (a stack, a SQL fragment, a provider key, another user's id) in an exception **message**: it is sent to the client.

## Status map

| Situation                                                                                                                   | Exception                                                        | Status |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| Validation failure, malformed input, impossible request                                                                     | `BadRequestException` (the global `ValidationPipe` raises these) | 400    |
| Missing or invalid token                                                                                                    | `UnauthorizedException` (from `ClerkAuthGuard`)                  | 401    |
| Authenticated but the **role** may not call the route; a business limit such as the daily quota                             | `ForbiddenException`                                             | 403    |
| Record missing, **or not visible to the caller** (another user's)                                                           | `NotFoundException`                                              | 404    |
| Duplicate, stale revision, state conflict                                                                                   | `ConflictException`                                              | 409    |
| Too many requests                                                                                                           | from the rate-limit plugin                                       | 429    |
| A bug or an unclassified fault                                                                                              | let it propagate                                                 | 500    |
| **Infrastructure the request needs is unavailable** (no Postgres client, the LLM provider is down and there is no fallback) | `ServiceUnavailableException`                                    | 503    |

Rules:

- **Throw an `HttpException` subclass, never a raw `Error`** from a service you expect the caller to see. A raw `Error` is a generic 500.
- **Messages are constants** from `api.constants.ts`, written in plain English.
- **A record you cannot see is a 404, not a 403** (`api-design` § contract). A 403 means "you may see this exists, but you may not do this".
- **"The database is not available" is a 503, not a 404.** A 404 tells the client the resource does not exist, which is false and misleads retries and monitoring.
- **Keep the cause when you wrap.** `throw new ServiceUnavailableException(DB_UNAVAILABLE, { cause: err })`. A plain `throw err` already preserves it.
- **Do not log and rethrow.** The filter logs. Logging in the service as well is two surfaces for one failure.

## Where each class is handled

| Class            | Where                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Expected (4xx)   | Thrown in the service or guard; the filter logs at `warn`                                                         |
| Unexpected (5xx) | Propagates to the filter; logged once at `error`                                                                  |
| Fatal            | `env.validation.ts` at boot, or a failing `onModuleInit`                                                          |
| Best-effort      | A `catch` that logs at `warn` with what it concerns and continues (a cache write after the result is built)       |
| Safe default     | Mastra `errorStrategy: 'fallback'` with a `fallbackValue`; log at `warn`. For security data the default is closed |
| Must not mask    | Shutdown hooks such as `onModuleDestroy`: log at `error`, continue the other steps                                |

## A handler that bypasses the interceptor

A handler that uses `@Res()` (a download, a stream) skips `TransformInterceptor`, and an error after headers are sent cannot reach the filter. If you add one: classify the failure yourself, log it once, and reply explicitly. No such handler exists today; prefer `{ message, data }`.

## Known backlog (do not copy, do not flag)

- `theory.service.ts` throws `NotFoundException('Database not available')` at eight call sites when the Postgres client is missing. New code throws `ServiceUnavailableException` with a constant.
- `ClerkAuthGuard` logs every failed verification at `error` and then throws `UnauthorizedException`, which the filter logs again at `warn`. A bad token is an expected failure; new guards log at most `warn`, once.
- `ClerkAuthGuard` also reads `process.env.CLERK_SECRET_KEY` and builds a Clerk client per request (`nestjs-developer` rule 8).
