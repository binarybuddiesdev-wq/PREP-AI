# HTTP Correlation ID Design

## Intent

Give every API request a stable identifier that appears in Pino logs and the
response, so a client can include it when reporting an API failure.

## Approaches

1. **Fastify request ID generation (selected):** configure Fastify's `genReqId`
   before requests reach Nest or Pino. Reuse a valid UUID v4 from
   `X-Request-Id`; generate one when the header is missing or invalid. An
   `onRequest` hook echoes the ID in the response.
2. **Nest middleware:** easier to write, but runs too late to establish the ID
   Fastify/Pino already assigned to the request.
3. **Interceptor:** can decorate successful responses, but does not cover all
   early errors or the request logger's ID.

## Behavior

- Accept only a single lowercase canonical UUID v4 value from `X-Request-Id`; otherwise
  generate a UUID v4.
- Fastify's `request.id` is the source used by `nestjs-pino`, keeping log and
  response IDs aligned. The Fastify generator stores that same value on the raw
  request, which is what the Pino HTTP middleware receives.
- Echo the identifier as `X-Request-Id` on responses and expose that response
  header through CORS.
- Do not add request IDs to Prometheus labels or queue payloads in this change.

## Non-goals

- Distributed tracing, job correlation propagation, or changes to logging
  payloads beyond using Fastify's existing request ID.
- Accept arbitrary caller-provided strings as IDs.

## Verification

Tests cover valid and invalid incoming IDs and response echo behavior. The full
server gate and database-isolation suite verify repository integration.
