---
name: mastra-ai
description: Use when adding, changing or debugging a Mastra AI agent, the LLM provider router (NVIDIA primary, Groq fallback), structured-output Zod schemas, or any agent.generate call in the PrepAI server. Triggers on work in server/src/mastra or in a service that calls mastra.getAgent.
---

# Mastra AI

Conventions for the agents, the provider router and the services that call them. Framework wiring is `nestjs-developer`; the endpoint in front of an agent is `api-design`; mocking an agent in a spec is `testing`.

## When to use

- Adding or editing an agent (`server/src/mastra/agents/`)
- Changing the provider router or adding a provider (`providers.ts`)
- Writing or changing a structured-output Zod schema
- Calling an agent from a service, or debugging a failed generation (timeout, schema mismatch, provider error)

A plain controller or service with no LLM call is not this skill.

## At a glance

- **Pinned SDK:** `@mastra/core` `1.81.0`; providers via `@ai-sdk/openai` (NVIDIA NIM and Groq are both OpenAI-compatible); schemas in Zod v4.
- **Files:** `server/src/mastra/mastra.config.ts` (the singleton and agents map), `providers.ts` (router), `agents/*.ts` (one agent per file).
- **Agents today:** `theory-evaluator-agent`, `tech-expert-agent`. They are deliberately minimal: `id`, `name`, `instructions`, `model`. No tools, no middleware.
- **Providers:** NVIDIA primary, Groq fallback (ADR-0007). `LLM_PROVIDER` forces one; otherwise whichever API key is present.

Mastra 1.81.0's bundled reference is `node_modules/@mastra/core/dist/docs/SKILL.md`. Check that version's reference and type definitions before using an API from the live docs; Mastra evolves quickly and examples on the website may target a newer release.

## Choose the right Mastra feature

Mastra offers agents, tools, processors/guardrails, workflows, memory, durable agents, background tasks, scorers/datasets/experiments, observability, storage, vectors/RAG, and integrations such as MCP. Use the smallest feature that fits the job. Mastra does not replace PrepAI's API, database, authentication, or BullMQ architecture.

| Need                                                                                   | PrepAI choice                                             | Use when                                                                                                                                     |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| One model call with instructions and typed output                                      | Registered Mastra `Agent` + `generate()` and a Zod schema | Current theory evaluation and other bounded one-shot generation                                                                              |
| A repeatable sequence with branching, parallel steps, or typed hand-offs               | Mastra workflow                                           | The AI operation has multiple meaningful stages; keep the API's persisted business state in PostgreSQL                                       |
| A queued job that must survive API/worker restarts and expose status to PrepAI clients | Existing BullMQ + PostgreSQL lifecycle                    | Current coding execution and theory evaluation. PostgreSQL is the source of truth; BullMQ performs delivery/retry                            |
| A long agent turn that must resume after a client disconnect or process restart        | Mastra durable agent/background task                      | Only after configuring and operating a shared persistent Mastra storage/runtime; do not layer it over BullMQ without a clear ownership split |
| Conversation continuity across turns                                                   | Mastra Memory                                             | Only when a feature is conversational; choose stable, user-scoped resource/thread IDs and isolate tenants                                    |
| Controlled app actions or external capabilities                                        | Mastra tools; MCP for a remote tool server                | Only when the agent needs the capability. Keep authorization and final side-effect checks in server services                                 |
| Regression measurement for prompts/models                                              | Mastra scorers, datasets, and experiments                 | Offline/CI comparison against reviewed examples. This is separate from the runtime score the theory evaluator gives a learner                |
| Production traces, latency, token/cost usage, and feedback                             | Mastra observability + a configured exporter/store        | When the team has selected retention, access, and privacy policy; do not send user answers to logs by default                                |
| Retrieval from indexed documents                                                       | Mastra vector/RAG interfaces plus the chosen vector store | When a feature needs source-backed context; keep document ownership filters in the retrieval query                                           |
| Input/output normalization, injection detection, PII handling, or moderation           | Mastra processors/guardrails                              | Evaluate model-backed processor cost, false positives, failure policy, and whether redaction changes the feature's meaning before enabling   |

For theory evaluation, use the registered `theoryEvaluatorAgent` through `mastra.getAgent()`, the existing `chatWithFailover()`/`getModel()` provider router, and validated structured output. Keep each answer stateless; do not attach conversation memory or tools. BullMQ owns retries and dispatch, and the answer row in PostgreSQL owns queued/running/completed/failed state and the client polling result. Mastra workflows or durable agents would duplicate lifecycle machinery for this single model call.

The current Mastra singleton has no storage, memory, workflow, vector, scorer, or observability configuration. Do not assume those features persist data just because the package supports them. In particular, Mastra storage is a separate adapter and is not automatically backed by PrepAI's Prisma PostgreSQL client.

- **Relative imports end in `.js`**, as everywhere on the server.

## Non-negotiable rules

One line each; the full rule with correct and wrong examples is in [`references/rules.md`](references/rules.md).

1. **`model: getModel()`.** Never call a provider directly: `getModel()` owns provider choice, model overrides and failover.
2. **Register every agent in `mastra.config.ts`.** An unregistered agent makes `mastra.getAgent('id')` return `undefined`.
3. **Reach agents through `mastra.getAgent('id')`**, never a direct import of the agent const.
4. **`id`, the exported const name and the `getAgent` argument are the same camelCase string.**
5. **Always pass `fallbackValue`** with `errorStrategy: 'fallback'` and `jsonPromptInjection: true`, so a failed generation degrades instead of throwing.
6. **The Zod schema and `fallbackValue` have the same shape**; the fallback must pass `schema.parse()`.
7. **`.js` extensions on every import.**
8. **User text is data, never instructions.** Anything a user typed that reaches a prompt (an answer, a question) is attacker-controlled. Keep your instructions in the agent's `instructions`; put the user text in a clearly delimited data block, and say in `instructions` that text inside the delimiters is content to evaluate and never a command. Bound its length in the DTO (`@MaxLength`). Treat the structured output as untrusted until the schema validates it, and clamp numeric fields (a score) to their range in code. `theory.service.ts` interpolates the answer straight into the prompt today; that is backlog, not a pattern to copy.
9. **No secrets in prompts, logs or responses.** API keys come from the environment and stay on the server.

## Provider calls and cost

Every `agent.generate` is a billed, rate-limited external call that can take seconds and can fail. A new LLM-backed endpoint must (a) have a per-user quota (the daily-limit pattern in `theory`, ADR-0005), (b) bound its input, and (c) return something sensible when the provider is down (rule 5). Say in your report which of the three it relies on.

## Task → reference

| When you are…                                                          | Read                                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Changing the provider, adding one, or asking "which model ran?"        | [`references/provider-router.md`](references/provider-router.md)                             |
| Adding or changing an agent, the singleton, or a `generate` call       | [`references/agents-and-structured-output.md`](references/agents-and-structured-output.md)   |
| Writing the types, controller and spec for a module that uses an agent | [`references/module-wiring-and-tests.md`](references/module-wiring-and-tests.md)             |
| Unsure how a rule reads, or reviewing an agent change                  | [`references/rules.md`](references/rules.md)                                                 |
| Adding a whole new agent end to end, or debugging a failure            | [`references/procedure-and-troubleshooting.md`](references/procedure-and-troubleshooting.md) |

## Common mistakes

| Mistake                                                           | Fix                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `getAgent('x')` returns `undefined`                               | Register the agent in `mastra.config.ts` and match the `id` |
| `response.object` is `undefined`                                  | Add `jsonPromptInjection: true`; check the schema           |
| Calling `nvidiaProvider.chat(...)` in an agent                    | `getModel()`                                                |
| `vi.mock` of `mastra.config.js` inside `describe`                 | Move it to the top level of the spec                        |
| A prompt built by pasting the user's text beside the instructions | Delimit it and bound it (rule 8)                            |

## When in doubt

Read `tech-expert-agent.ts` and `theory-evaluator-agent.ts` and mirror them. If you are adding something they do not have (tools, middleware, a second model), say why in the PR description or an ADR.
