# Coding Backend MVP

## Intent

Implement the first usable coding-practice API on the existing PostgreSQL coding models and the project's self-hosted Piston service. Users can browse problems, create a session, run and submit code, retrieve their session, complete it, and browse their own session history.

## Goals

- Keep the existing NestJS module/layer pattern and `{ success, message, data }` envelope.
- Support JavaScript, TypeScript, and Python with a shared `solution(...args)` entrypoint.
- Execute only against the problem's structured public examples, with server-owned harness code and execution limits.
- Enforce session ownership and problem membership on every run and submit request; return 404 for inaccessible sessions.
- Save every submitted result, and enforce the documented daily limit on newly solved problems.
- Make Piston/database unavailability a clear 503 response.

## Non-goals

- AI code review, coding stats/streaks, hidden test cases, arbitrary stdin programs, PDF/RAG, a coding UI, and production multi-tenant code-execution deployment.
- Changing the existing Piston container isolation strategy in this feature. Piston's local container currently uses `--privileged`; this remains a local-development limitation and must be reviewed before exposing execution to public users.

## Approaches

1. Execute the request body as a whole program and pipe example strings to stdin. Rejected because the existing templates are function-shaped and display examples are not executable input.
2. Build trusted per-problem test harnesses using arbitrary function names and extra schema fields. Rejected for the MVP because it adds avoidable data-model and seed migration complexity.
3. Standardize challenge templates on `solution(...args)` and represent each public example as `{ input: unknown[], output: unknown, explanation?: string }`; append the harness on the server. Selected because it works with the existing JSON `examples` column and makes the executable contract explicit.

## API scope

Implement the existing spec's problem list/detail, session start, run, submit, session detail, complete, and paginated history routes. Defer AI review and stats/streak endpoints until their own design and tests exist. Sessions store their assigned problem IDs in an additive PostgreSQL string-array field with an empty default.

## Execution limits

- Fixed runtime language allowlist: JavaScript, TypeScript, Python.
- Fixed server-side source and test-case count limits.
- A per-user Redis-backed execution throttle shared by run and submit endpoints.
- Piston request timeout, compile/runtime timeout, and memory limits are constants owned by the server; clients cannot override them.
- Validate Piston responses and cap output sent back to clients. Do not expose Piston URLs, stack traces, or service credentials.
- No client-supplied Piston URL, runtime version, filename, arguments, or harness.

## Failure behavior

- Invalid DTO/input: 400; missing problem/session: 404; already completed or daily quota exhausted: 409; Piston or PostgreSQL unavailable: 503.
- A `run` call never writes a coding answer or consumes the solved-problem quota.
- A `submit` call records accepted, wrong-answer, and runtime-error results. Only a first accepted solution reserves the daily solved quota; failed/non-accepted work releases the reservation.
- If persistence fails after reserving quota, release the quota reservation best-effort and log release failures.

## Constraints and decisions

- Keep coding persistence in PostgreSQL; users remain identified by the Clerk `userId` string, with no cross-database relation.
- Use `@CurrentUser('id')`, never a request-supplied user ID.
- Add only `CodingSession.problemIds String[] @default([])`; no new table or dependency.
- The API contract and route docs must mark AI review and stats as deferred rather than implemented.
- Unit specs mock PostgreSQL, Redis, and Piston. They do not prove a live Piston sandbox or PostgreSQL schema push; report those limits.

## Success criteria

- All scoped routes work with the global auth guards and response envelope.
- Cross-user session access is indistinguishable from missing session.
- Server-created harnesses correctly evaluate each public example in each supported language.
- User-supplied code cannot choose resource limits or execute another session's problem.
- Tests cover validation, ownership, quota, Piston failures/timeouts, persistence, and session state transitions.
