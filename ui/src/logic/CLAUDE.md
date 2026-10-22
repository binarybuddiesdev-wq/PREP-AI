# logic/

Reader (query) and Command (mutation) hooks over TanStack Query, plus query-key factories and form mapping. May import `core`, `utils`, `service`, `data`.

- Readers are `use<Thing>Reader`, commands are `use<Thing>Command`; each returns the TanStack result unchanged.
- Query keys come from a `<resource>.keys.ts` factory, never inline arrays.
- No JSX. Gate queries on the session (`enabled: isLoaded && isSignedIn`).

See `ui/CLAUDE.md` and `docs/adr/0009-frontend-layers.md`.
