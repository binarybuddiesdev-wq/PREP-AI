# Tech Expert API

Base path: `/api/v1/tech-expert`

Both routes are public and do not read or modify user-owned records. They use
the configured Mastra tech-expert agent and NVIDIA/Groq provider routing.

## Structured answer

`POST /api/v1/tech-expert`

Request:

```json
{
  "question": "Explain the difference between REST and GraphQL."
}
```

Returns the existing structured answer envelope with `topic`, `summary`,
`keyPoints`, `examples`, and `relatedTopics`.

## Streaming answer

`POST /api/v1/tech-expert/stream`

The request body is the same. The response uses
`Content-Type: text/event-stream; charset=utf-8`. The server sends `delta`
events containing text chunks and a final `done` event:

```text
event: delta
data: {"text":"REST exposes resources"}

event: done
data: {}
```

If generation fails after streaming starts, the server sends an `error` event
with a generic message and closes the stream. Errors before the first chunk
return HTTP 503 in the regular API error envelope. The server may fail over
from NVIDIA to Groq only before emitting the first chunk. A client disconnect
aborts the upstream Mastra generation.

Example browser request:

```ts
const response = await fetch('/api/v1/tech-expert/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'Explain the difference between REST and GraphQL.' }),
});

if (!response.ok || !response.body) throw new Error('Unable to start answer stream');

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

function handleFrame(frame: string) {
  const lines = frame.split('\n');
  const event = lines
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim();
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  if (!event || !data) return;
  const payload = JSON.parse(data);
  if (event === 'delta') appendToAnswer(payload.text);
  if (event === 'error') throw new Error(payload.error);
}

while (true) {
  const { value, done } = await reader.read();
  buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
  let separator = buffer.indexOf('\n\n');
  while (separator >= 0) {
    handleFrame(buffer.slice(0, separator));
    buffer = buffer.slice(separator + 2);
    separator = buffer.indexOf('\n\n');
  }
  if (done) break;
}
```

SSE event names are `delta`, `done`, and `error`; clients should handle each
event and cancel the reader when the user leaves the answer view. The example's
`appendToAnswer` should update the client UI with each text delta.
