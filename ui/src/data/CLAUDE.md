# data/

Client-side state: the Redux store. May import `core` and `utils`; `logic` may read/write shared state here.

- Server state belongs in TanStack Query (`logic`), not Redux.
- Add a slice for genuinely client-owned shared state (UI preferences, drafts that must survive navigation).
- `RootState` and `AppDispatch` are exported from `data/store`.

See `ui/CLAUDE.md` and `docs/adr/0009-frontend-layers.md`.
