# utils/

Pure helpers (`cn`, `formatDate`). May import only from `core`.

- No React hooks, no I/O, no state.
- One concern per file. Never create a folder named like a file beside it (`@/utils` must stay unambiguous).
- Every helper needs a unit test.

See `ui/CLAUDE.md` and `docs/adr/0009-frontend-layers.md`.
