# Study Chat API

Base URL: `http://localhost:3000/api/v1`

All routes require `Authorization: Bearer <clerk-session-token>`. Conversation
ownership is derived from the token and checked against the internal user ID on
every database operation.

## Start a conversation

```http
POST /study-chat/conversations
Content-Type: application/json

{"message":"Explain binary search and give me a practice question."}
```

The first reply and conversation are returned together. The title is based on
the first message and truncated to 80 characters.

```json
{
  "message": "Conversation created",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Explain binary search and give me a practice question.",
    "messages": [
      {
        "role": "user",
        "content": "Explain binary search and give me a practice question.",
        "createdAt": "2026-11-03T10:00:00.000Z"
      },
      {
        "role": "assistant",
        "content": "Binary search...",
        "createdAt": "2026-11-03T10:00:01.000Z"
      }
    ],
    "turnCount": 1,
    "createdAt": "2026-11-03T10:00:00.000Z",
    "updatedAt": "2026-11-03T10:00:01.000Z"
  }
}
```

## List, read, continue, and delete

| Method   | Route                                                | Behavior                                                                     |
| -------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET`    | `/study-chat/conversations?cursor=<id>&limit=20`     | Newest-updated conversations, default 20 per page, maximum 50.               |
| `GET`    | `/study-chat/conversations/:conversationId`          | Owned transcript and conversation metadata.                                  |
| `POST`   | `/study-chat/conversations/:conversationId/messages` | Body `{ "message": "..." }`; returns updated transcript and assistant reply. |
| `DELETE` | `/study-chat/conversations/:conversationId`          | Deletes the owned conversation.                                              |

Message text is trimmed and must contain 1 to 4,000 characters. Each
conversation allows 30 user turns. The stored transcript holds up to 60
messages; at most the latest 20 messages are included in the next Mastra call.
Start a new conversation after the turn limit. Concurrent updates use a
revision check; a request that loses the race receives 409 and must be retried.

Invalid body, cursor, or Mongo ObjectId returns 400. Missing and foreign
conversation IDs both return 404. If both AI providers fail, the API returns a
safe 503 response; provider details remain in server logs. Users may delete
conversations at any time, and account deletion removes that user's stored
conversations. Each model call reserves against the same role-based daily AI
token quota used by theory evaluation (`AI_DAILY_TOKENS_FREE` and
`AI_DAILY_TOKENS_PREMIUM`). Requests over quota return 429; successful calls
settle the reservation using provider-reported token usage when available.

## Storage rollout

The Mongo schema creates the conversation collection and owner/update-time
index. Apply it to the intended database before deploying the API:

```bash
pnpm --filter server prisma:push:mongodb
```

Set `DATABASE_URL` to the target MongoDB database when running the command.

The Study Chat module uses the registered Mastra study-coach agent and the
existing NVIDIA/Groq provider failover path. It stores bounded application
conversation history in Mongo; it does not enable Mastra's optional semantic or
observational memory features.
