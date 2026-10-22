# components/

Presentational components: props in, events out. May import `core` and `utils` only.

- No data fetching, no router hooks that read state, no Redux. Links to routes come in as props.
- Each component has `X.tsx` and `X.types.ts` (props interface `IXProps`); consumers import from the folder barrel.
- `components/ui/` holds shadcn primitives and is exempt from the barrel rule.

See `ui/CLAUDE.md` and `docs/adr/0009-frontend-layers.md`.
