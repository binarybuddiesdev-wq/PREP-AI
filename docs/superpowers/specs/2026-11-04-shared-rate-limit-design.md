# Shared Redis Rate-Limit Design

## Goal

Share Fastify request-limit counters between server replicas without creating a
second Redis connection or changing existing limits.

## Decision

Pass the existing `RedisService` ioredis client into `@fastify/rate-limit`.
Keep the current policy of 10 requests per minute for `/api/v1/auth/*` and 100
for other routes. Keep `skipOnError: false`: if Redis is unavailable, the
limiter fails closed instead of bypassing the rate limit. Application features
that require Redis keep their existing independent failure behavior.

The shared client remains owned and closed by `RedisService`. No additional
environment variables, Redis connections, or dependencies are introduced.

## Verification

Test that the Fastify plugin receives the existing Redis client, retains the
route-specific maxima and one-minute window, and fails closed on storage errors.
Run the full server gate.
