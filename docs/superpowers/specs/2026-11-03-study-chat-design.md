# Study Chat Design

## Intent

Provide signed-in PrepAI users a persistent text conversation for interview preparation. The assistant should explain concepts, help plan practice, and answer follow-ups using recent turns from the same conversation.

## Goals

- Create, list, read, continue, and delete user-owned conversations.
- Use a dedicated Mastra study-coach agent with the existing provider failover and metrics.
- Persist a bounded transcript in MongoDB; only recent turns are sent back to the model.
- Enforce Clerk ownership on every operation and remove a user's conversations during account deletion.
- Bound user message size and conversation length.

## Non-goals

- Streaming, tools that mutate data, RAG/notes retrieval, voice, frontend UI, semantic memory, conversation sharing, and provider-specific storage adapters.
- Replacing the existing public one-shot Tech Expert endpoint.

## Approaches

1. **Dedicated study-chat module, Mongo-owned transcript, Mastra agent (selected):** follows current NestJS module boundaries, uses the existing Mongo Prisma ownership model, and stores only the conversation history this API needs. It avoids adding a separate Mastra storage dependency while still using Mastra for every model call.
2. Extend Tech Expert: less code, but mixes a public one-shot endpoint with private conversation lifecycle and ownership rules.
3. Mastra Memory adapter with PostgreSQL storage: uses Mastra's memory abstraction but adds a new storage adapter/dependency and a new RLS/tenant rollout surface. The current repository has no configured Mastra memory storage.

## Behavior and limits

- `POST /study-chat/conversations` accepts `{ message }`, creates a conversation, and returns the first assistant reply.
- `GET /study-chat/conversations?cursor=&limit=` lists the current user's conversations, newest first; default 20, max 50.
- `GET /study-chat/conversations/:id` returns the owned transcript.
- `POST /study-chat/conversations/:id/messages` accepts `{ message }` and returns the appended user/assistant pair.
- `DELETE /study-chat/conversations/:id` deletes only the owned conversation.
- User messages are trimmed, 1–4000 characters; a conversation is capped at 30 user turns. The stored transcript is bounded to 60 messages, and only the most recent 20 messages are passed to Mastra.
- The first user message becomes the title, truncated to 80 characters. Messages are plain text.
- During continuation, the service reads the owner-scoped conversation and uses optimistic revision matching to reject concurrent turns with 409 rather than overwrite a newer transcript.
- A failed provider call does not persist a partial turn. Chat requests use existing Mastra provider failover and record failover metrics.
- Each model call reserves from the existing role-based daily AI token budget and settles against provider usage when available; exhausted users receive 429.

## Data and privacy

Use a Mongo `StudyChatConversation` collection with `userId`, title, JSON message list, turn count, revision, created/updated timestamps, and indexes for owner/update time. User deletion removes conversations. Users can explicitly delete conversations; no automatic transcript expiry is introduced until a product retention requirement exists.

Mastra's official memory documentation recommends message history for multi-turn threads and persistent storage when history must survive restarts. This design keeps transcript storage in the existing Mongo owner boundary and passes the bounded recent message list to the Mastra agent; it does not add a separate Mastra storage adapter. See [Mastra memory](https://mastra.ai/docs/memory/overview) and [Mastra storage](https://mastra.ai/docs/storage).

## Implementation decisions

- Add a safe system instruction focused on interview preparation and treat user-provided text as untrusted content.
- Return 503 with a safe message if both configured AI providers fail; log internal details without returning them.
- Keep API response content as `{ id, title, messages, turnCount, createdAt, updatedAt }`; never expose internal `userId` or revision.
- Reuse `TheoryAiTokenBudgetService` and its `AI_DAILY_TOKENS_FREE` / `AI_DAILY_TOKENS_PREMIUM` limits instead of creating a separate chat quota.

## Acceptance

Unit tests cover validation, Mastra failover invocation, history window, turn limit, conflict detection, and owner-scoped CRUD. The real Mongo two-user isolation suite proves conversations cannot be read, continued, or deleted across users. Full server gate and architecture viewer check pass; API and trackers are updated.
