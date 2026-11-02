# Podman App Container Support Plan

## Goal and approach

Make the existing optional `full` Compose profile runnable with Podman while preserving the default database-only workflow. Each app installs from its own package directory and lockfile, and Podman named volumes hold container dependencies and generated Prisma clients. The user can choose host-run apps or start both apps with the databases.

## Alternatives considered

- Add a pnpm workspace and merge the separate package lockfiles. Rejected because the repository intentionally keeps independent root, server, and UI installs and lockfiles.
- Keep app containers disabled and document host terminals only. Rejected because the user asked to run frontend and backend as containers too.
- Repair the existing optional profile using the package-local manifests and persistent volumes. Chosen because it follows the current monorepo setup with the smallest change.

## Scope and constraints

- Keep `pnpm podman:up` / `pnpm podman:down` database-only.
- Add explicit full-stack start/stop commands; stopping must preserve named data volumes.
- Use Compose service DNS names for backend-to-database traffic and browser-reachable localhost for frontend-to-backend traffic.
- Do not change application code, secrets, or Piston setup.

## Implementation and verification

1. Run the backend and UI containers from `server/` and `ui/`, using each package's lockfile and a named `node_modules` volume; persist generated Prisma clients in Podman. Gate UI startup on backend health and make container shutdown signal-safe.
2. Add explicit Podman scripts and document both host-run and container-run workflows.
3. Validate the resolved Compose profile and scripts, then start the full profile on available ports if host-run apps are already occupying the defaults.
