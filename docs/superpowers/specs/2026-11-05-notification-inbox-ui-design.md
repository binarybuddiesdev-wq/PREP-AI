# Notification inbox UI design

## Intent

Give signed-in users a compact, dependable place to review and manage their in-app notifications from the app header. The inbox should show the real unread count and operate only on the authenticated user's API data.

## Goals

- Add an accessible notification bell and popover to the shared authenticated header.
- Show a server-backed unread count, newest-first notifications, relative timestamps, and a clear unread state.
- Support cursor-based load-more pagination, mark-one-read, mark-all-read, and delete.
- Keep list and unread count in sync through TanStack Query keys and mutation invalidation.
- Render loading, empty, page-loading, retryable error, and mutation-error states.
- Preserve the compact dark/light app-shell design and remain usable on mobile.

## Non-goals

- Add email, push, realtime, or notification-preference controls.
- Add notification generation or change the existing server contract.
- Add a separate notifications route; the prototype uses a header dropdown.
- Promise unread-count updates from other tabs or sessions without refetching.

## Constraints

- Use the existing authenticated endpoints in `routes/notifications-api-spec.md`.
- Keep HTTP calls in `service/api`, readers and commands in `logic/notifications`, and presentation in `components/notifications`.
- Compose data hooks in the authenticated layout and pass a header slot into `AppShell`.
- Use Clerk identity only as the query-key scope; the API client remains responsible for the token.
- Validate server-provided links as local application paths before navigation.
- The project instruction to keep implementing without approval pauses applies to this feature; choose details from the backend contract and current UI conventions.

## Approaches

1. **Shared authenticated-header popover (selected):** follows the prototype's bell/dropdown and keeps the unread count available on every signed-in route. Use a cursor-paginated infinite query, a separate unread-count query, and mutations that invalidate both.
2. Dashboard-only bell: smaller integration surface, but hides notifications from other routes and diverges from the prototype's shared top bar.
3. Standalone inbox page: offers more space, but introduces a route and navigation model the prototype does not show and does not solve the shared unread count by itself.

## API contract

- `GET /notifications?cursor=<id>&limit=20` returns `{ data: { items, nextCursor, unreadCount } }`; `nextCursor` is null at the end.
- Each item has `id`, `category`, `title`, `body`, optional `link`, `readAt`, and `createdAt`.
- `GET /notifications/unread-count` returns `{ data: { count } }`.
- `PATCH /notifications/:id/read` marks one item read.
- `PATCH /notifications/read-all` marks all current-user items read.
- `DELETE /notifications/:id` deletes one item; deleting an absent item succeeds.
- List and unread-count require Clerk authentication. The server scopes all inbox operations to the authenticated user.

## Interaction behavior

- The bell button reports its unread count accessibly; counts above 99 render as `99+`.
- Opening the popover loads the first page. Clicking “Load more” requests the next cursor while retaining earlier pages.
- Each unread row offers “Mark read”; each row offers a delete action. A row with a safe local `link` can navigate to that path and becomes read first.
- “Mark all read” is disabled when the count is zero or while its request is pending.
- Failed reads show an inline retry action. Failed mutations keep the list intact and show a clear inline error.
- Empty state appears only after a successful first-page response with no items.

## Review focus

- A successful read, read-all, or delete invalidates both list pages and unread count.
- Loading the next page does not replace already visible rows.
- A list error, unread-count error, and mutation error are user-visible and recoverable.
- The menu remains keyboard reachable, closes with Escape and outside click, and does not clip at mobile widths.
- External, protocol-relative, or non-path notification links are never passed to React Router.
