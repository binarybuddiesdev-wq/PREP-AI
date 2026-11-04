# Rate-limit metrics design

Add a dedicated Prometheus counter for requests rejected by Fastify's shared Redis rate limiter. Use only the bounded route classes `auth` and `general`; do not label by client IP, limiter key, or raw URL. Increment the counter through `@fastify/rate-limit`'s `onExceeded` callback and preserve existing 429 behavior. The existing HTTP request histogram remains the source for status, method, route, and latency detail.

Approaches considered: keep using the 429 HTTP histogram (no code, but weak direct alert queries); label a counter with route or key (more detail, but high-cardinality or sensitive); use a fixed route class (selected, with bounded labels and actionable auth/general split). This is a small observability improvement and does not change enforcement policy.
