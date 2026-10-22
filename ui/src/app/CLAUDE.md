# app/

Composition root: providers, routes and route guards. The only layer that may import every other layer.

- `AppProviders` wires auth, Redux, TanStack Query and the router; `AppRoutes` maps `ROUTES` to pages.
- Guards (`ProtectedRoute`, `PublicRoute`) live in `RouteGuards.tsx`.
- `main.tsx` only renders `<App />`.

See `ui/CLAUDE.md` and `docs/adr/0009-frontend-layers.md`.
