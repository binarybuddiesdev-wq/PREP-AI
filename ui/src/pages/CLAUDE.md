# pages/

Route shells that compose `logic` hooks and `components`. May import `core`, `logic`, `components` and `service/auth` widgets.

- Named exports only (`export const FooPage`).
- Own the loading, error and empty states; keep markup in components.
- No direct `service/api` calls: go through a Reader or Command.

See `ui/CLAUDE.md` and `docs/adr/0009-frontend-layers.md`.
