# AI Provider Failover Metrics

## Context

PrepAI retries one-off AI calls against the Groq provider when the NVIDIA
provider fails. The current protected Prometheus endpoint reports HTTP metrics
only, so operators cannot see when fallback is masking a primary-provider
outage.

## Decision

Add `mastra_provider_failovers_total`, a Prometheus counter labelled only by
the bounded provider pair (`from`, `to`). Store it in shared Redis so successful
fallback calls from a separate worker process appear in the API's protected
`/metrics` scrape. Increment it once when a fallback provider succeeds after
an earlier provider failed. Do not include failure messages, prompts, user
identifiers, model names, or other unbounded values.

Wire the callback through the existing `chatWithFailover` helper and all
production call sites: theory evaluation, PDF question generation, and tech
expert answers. Preserve current helper behavior when no callback is supplied.
Expose the counter through the existing token-protected `/metrics` endpoint.

## Consequences

- A successful fallback is observable without changing the AI response flow.
- Failed calls that never reach a fallback success do not increment this
  counter; provider error tracking remains separate work.
- The local metrics collector must support Prometheus counters in addition to
  the existing histogram and gauge types.
- Redis counter updates are asynchronous and best-effort; metric failures must
  not delay or fail AI responses. If Redis cannot serve the scrape, return the
  other local metrics and omit provider failover samples.

## Open Questions

- Provider duration, error counters, and tracing remain separate observability
  work and are not part of this change.
