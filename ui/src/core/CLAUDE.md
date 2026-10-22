# core/

Types, constants, route names and env. Nothing here imports from another layer.

- No React, no I/O, no side effects.
- `ROUTES`, `API_BASE_URL` and shared interfaces live here; pages never hard-code a path.
- Group by domain (`core/user`, `core/api`), each with an `index.ts` barrel.

See `ui/CLAUDE.md` and `docs/adr/0009-frontend-layers.md`.
