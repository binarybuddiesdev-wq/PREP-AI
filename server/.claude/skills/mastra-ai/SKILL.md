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

- **SDK:** `@mastra/core`; providers via `@ai-sdk/openai` (NVIDIA NIM and Groq are both OpenAI-compatible); schemas in Zod v4.
- **Files:** `server/src/mastra/mastra.config.ts` (the singleton and agents map), `providers.ts` (router), `agents/*.ts` (one agent per file).
- **Agents today:** `theory-evaluator-agent`, `tech-expert-agent`. They are deliberately minimal: `id`, `name`, `instructions`, `model`. No tools, no middleware.
- **Providers:** NVIDIA primary, Groq fallback (ADR-0007). `LLM_PROVIDER` forces one; otherwise whichever API key is present.
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
