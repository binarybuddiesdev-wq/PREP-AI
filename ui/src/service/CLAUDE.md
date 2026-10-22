# service/

External I/O: the `ky` HTTP client, the endpoint functions and the Clerk adapter. May import `core` and `utils`.

- No business logic and no TanStack Query here; endpoint functions take the client as their first argument and return the parsed envelope.
- Only this layer imports `@clerk/clerk-react` or `ky`; the rest of the app sees `IAuthSession` and `ApiClient`.
- Never call `fetch` directly from `logic`, `components` or `pages`.

See `ui/CLAUDE.md` and `docs/adr/0009-frontend-layers.md`.
