# Study Chat UI Design

## Intent

Port the PrepAI Assistant launcher from `prepai-ui.html` into the authenticated
React shell and connect it to the persistent Study Chat API. Learners should be
able to continue previous conversations, start new ones, send messages, and
delete conversations without losing a retryable request or seeing simulated AI
responses.

## Goals

- Keep a floating launcher available across authenticated routes, with a
  compact popup and a larger fullscreen mode matching the reference's dark
  surfaces, amber accent, message alignment, and fixed bottom-right placement.
- Read the signed-in user's cursor-paginated conversations and saved transcript
  through the existing Clerk-aware API client and TanStack Query.
- Create a conversation from the first message; continue an existing
  conversation; switch conversations; and confirm before deleting one.
- Preserve the exact payload and idempotency key when the user retries a failed
  create/send operation. Never append an AI answer that the API has not
  returned.
- Render loading, empty, list/detail error and retry, sending, provider failure,
  quota, revision conflict, and maximum-turn states.
- Support keyboard and screen-reader use, reduced motion, narrow viewports, and
  both existing themes.

## Non-goals and constraints

- The API returns a completed assistant reply, not a token stream. Show a
  pending indicator while it runs; do not simulate streaming text.
- Do not put transcripts or auth tokens in Redux or browser storage. TanStack
  Query owns server data; transient popup, draft, and selection state stays
  local.
- Do not call Mastra from the browser. `POST /study-chat/conversations` and
  `POST /study-chat/conversations/:id/messages` already invoke the backend's
  Study Coach agent and provider failover.
- Do not render raw Markdown/HTML or add a Markdown dependency. Display returned
  message text as text with preserved line breaks.
- Respect backend limits: 1-4,000 trimmed input characters, 30 user turns per
  conversation, 20 conversations per list request by default (maximum 50), and
  the backend's safe 429/503 responses.
- Keep this feature in the existing seven-layer architecture and add no
  dependency.

## Approaches

1. **Single transcript only.** Closest to the prototype but fails to expose the
   persistent conversation list and switching API. Rejected.
2. **Permanent conversation sidebar.** Easy to discover but consumes most of
   the reference's 380px popup and leaves the transcript cramped. Rejected.
3. **Switchable conversation list in the same chat panel.** Keep the reference
   launcher, popup, and fullscreen transcript. A header control opens a list
   view with New conversation, saved conversations, cursor-based Load more, and
   delete actions. Selected because it preserves the compact reference while
   exposing every persistent conversation operation.

## Behavior

- The authenticated shell renders the launcher on all protected pages; public
  landing and Clerk auth pages do not render it.
- Opening the launcher shows the active transcript if one is selected, or a
  purposeful empty state explaining what the assistant can help with. The empty
  state is UI guidance, not a fabricated assistant message.
- A conversation-list button switches between the transcript and list. The list
  shows newest-updated conversations, a new-chat action, loading/empty/error
  states, pagination, and a delete action that requires an accessible
  confirmation dialog.
- Selecting a conversation loads its owner-authenticated transcript. Deleting
  the selected conversation clears the active transcript; deleting another
  conversation leaves the current transcript selected.
- The first send creates a conversation and returns the initial user/assistant
  messages. Later sends append only the API's returned transcript. Inputs are
  disabled while an operation is running, and the pending state is announced.
- Every distinct create/send action gets one idempotency key. A retry of the
  same text reuses that key; a new text action gets a new key. Failed text
  remains available for retry. A 409 explains the retry and refreshes the
  selected transcript; a 429 explains the daily AI token limit without
  inventing a reset time; a 503 explains that the assistant is temporarily
  unavailable.
- At 30 turns, the transcript remains readable and sending is disabled with a
  clear Start a new conversation action.
- Compact mode follows the reference dimensions where the viewport permits;
  mobile uses a near-full-screen panel. Fullscreen remains bounded by the
  viewport and has a working exit control. Closing the panel retains the
  selection and unsent draft for this shell session.

## Architecture

- `core`: typed conversation, list-page, transcript, message, and create/send
  request contracts.
- `service/api`: list, detail, create, send, and delete functions using the
  shared API client. Create/send set `Idempotency-Key`.
- `logic/studyChat`: user-scoped query keys/readers and commands. The reader
  uses `useInfiniteQuery` for `nextCursor`; commands invalidate the conversation
  list and relevant transcript keys, and place successful returned transcripts
  into the cache.
- `components/studyChat`: launcher, popup shell, transcript, message, composer,
  conversation list, and delete confirmation as presentational components.
- `pages/StudyChatWidget`: composes local view state, Study Chat readers and
  commands, and presentational components; `AuthenticatedLayoutPage` mounts it
  once outside the route outlet.
- Add contracts, query-key/reader/command, component, composition, and
  accessibility tests before implementation. Keep tests at each layer boundary.

## Error and retry policy

- List and detail errors keep the panel usable and show specific error copy with
  a retry action.
- Create/send failures retain the exact message and idempotency key. The retry
  action reruns that same operation. Do not auto-create a second operation for
  the same failed message.
- For a 409, refresh the active transcript before presenting retry; for a 404,
  report that the conversation is no longer available and return to the list.
- A 429 or 503 preserves the user's message and key so it can be retried when
  appropriate. Never expose provider internals or fabricate reset timing.
- Delete errors keep the conversation in the list and let the user retry.

## Approved direction inherited from the project owner

The project owner directed implementation to continue through the roadmap
without waiting between features, use `prepai-ui.html` as the UI reference,
follow the existing architecture, and use TDD. Therefore the builder may
resolve implementation details using the decisions above without an additional
approval pause.
