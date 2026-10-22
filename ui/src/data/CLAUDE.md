# data/

Client-side state: the Redux store. May import `core` and `utils`.

- Server state belongs in TanStack Query (`logic`), not Redux.
- Add a slice only for state that is genuinely client-owned (UI preferences, drafts that must survive navigation).
- `RootState` and `AppDispatch` are exported from `data/store`.

See `ui/CLAUDE.md` and `docs/adr/0009-frontend-layers.md`.
