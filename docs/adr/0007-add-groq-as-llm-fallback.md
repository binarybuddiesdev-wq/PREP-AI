# ADR-0007: Add Groq as LLM fallback provider (NVIDIA primary)

## Status

Accepted, 2026-08-29

## Context

Today the only LLM provider is NVIDIA NIM. NVIDIA works but:

- **Free credits run out.** The 1,000 credits on signup are enough for a few
  weeks of dev usage. Beyond that, every call costs money.
- **No second source of truth.** If NVIDIA has an outage, is rate-limited,
  or rotates the model, our AI features (theory answer evaluation, code
  review, chatbot) all go down. There is no failover.
- **Latency variance.** NVIDIA's hosted inference is fine but not the
  fastest. For code review where a user is waiting, faster = better UX.

We need a **second provider** that is:

- Free for the volume we use (solo project, ~10k AI calls/day max)
- OpenAI-compatible (so Mastra's existing code works unchanged)
- Reliable (production-grade SLA, not a hobby project)
- Different infra from NVIDIA (so a single provider outage doesn't take
  us down)

Options considered:

1. **Hugging Face Inference API** — free, many models, OpenAI-compatible.
   But free-tier is small (cold starts, low rate limits), and quality
   varies wildly across the open-source models.
2. **Google AI Studio (Gemini)** — generous free tier, 1M context, has
   embeddings. But uses its own SDK (not OpenAI-compatible), and the
   "low limits" reputation (outdated, from 2023) made us skip.
3. **Groq** — 2M tokens/day free on Qwen 3.8 27B, OpenAI-compatible
   (`https://api.groq.com/openai/v1`), fastest inference in the world
   (LPU hardware, hundreds of tokens/sec), production-grade reliability.
4. **Local Ollama** — free forever, zero latency, but stresses the
   developer's laptop and not viable for production.

## Decision

We will use **two providers**:

- **NVIDIA NIM** (primary) — `meta/llama-3.1-8b-instruct` (configurable via
  `NVIDIA_MODEL`). Already integrated, works today.
- **Groq** (fallback) — `qwen/qwen3.8-27b` (configurable via `GROQ_MODEL`).
  Free tier: 30 RPM, 1k RPD, 8k TPM, **2M TPD**. OpenAI-compatible.

The selection is controlled by the `LLM_PROVIDER` env var:

- `LLM_PROVIDER=groq` (or unset, with NVIDIA key present) → NVIDIA
- `LLM_PROVIDER=groq` → Groq
- `LLM_PROVIDER=nvidia` → NVIDIA only
- unset, no NVIDIA key → Groq
- unset, no NVIDIA key and no Groq key → fail with clear error

The Mastra agent code is **provider-agnostic**: it just calls
`getModel()` from `server/src/mastra/providers.ts`, which returns the
active model. Switching providers is a one-env-var change.

## Consequences

**Easier:**

- NVIDIA outages no longer take us down
- Devs can use Groq's generous free tier for iteration, save NVIDIA
  credits for the production-feel testing
- A/B testing is one env var away: compare answer quality between
  Llama-3.1-8B and Qwen-3.8-27B for the same prompt
- Same OpenAI surface — no new SDK, no new package, no new failure mode

**Harder:**

- Two providers to monitor (uptime, rate limits, model deprecations)
- Answer quality may differ between providers — `aiScore: 8.5` from
  NVIDIA may not be the same `8.5` from Groq for the same answer
- Switching mid-session would be jarring (conversation context is
  provider-bound) — current design always uses the same provider for
  one agent run
- Cost monitoring: Groq is free today, but if usage grows we may need
  to track token spend per provider (out of scope for v1)

## Alternatives considered

- **Hugging Face** — too many models of varying quality, harder to debug
  regressions. Revisit when we need a specific OSS model.
- **Google Gemini** — generous, but not OpenAI-compatible (would need a
  new SDK and a second client config). Worth adding as a third provider
  if NVIDIA + Groq both fail.
- **Ollama locally** — perfect for dev if you have GPU. Recommended as
  an _optional_ addition later, not a replacement.

## When to revisit

- When daily AI call volume exceeds 100k (Groq free tier becomes a constraint)
- When the project moves to production and SLAs matter (need paid tier
  with committed capacity, e.g. Groq Developer plan or AWS Bedrock)
- When we add embeddings (today not needed; Gemini or Hugging Face would
  be the natural picks)
- When we add vision / voice / multimodal (NVIDIA + Groq are text-only
  for the current models)

## References

- `server/src/mastra/providers.ts` — the provider abstraction
- `server/src/config/env.validation.ts` — env schema
- `server/src/mastra/agents/theory-evaluator-agent.ts` — uses `getModel()`
- `server/src/mastra/agents/tech-expert-agent.ts` — uses `getModel()`
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Groq models](https://console.groq.com/docs/models)
- [SYSTEM_DESIGN_REVIEW.md §B.6](../../SYSTEM_DESIGN_REVIEW.md)
