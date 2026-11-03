# Backend Operations and Security Documentation Plan

## Goal

Complete the high-priority, repository-buildable operations documentation
without changing runtime behavior or touching any database.

## Tasks

### Task 1: Add database and worker runbooks

Files: `docs/runbooks/worker.md`, `mongo.md`, `postgres.md`, `redis.md`.

- [x] Document actual health checks, Podman logs/status commands, dependency impact,
      safe recovery, and data-preservation rules.
- [x] State clearly that managed backup setup and production RLS rollout are not
      verified by these local procedures.
- [x] Verify commands and links against Compose, the health service, and the RLS
      rollout guide.

### Task 2: Add API and web runbooks

Files: `docs/runbooks/api.md`, `web.md`.

- [x] Document local and full-container operations, health endpoints, expected
      dependency behavior, configuration diagnosis, and safe rollback.
- [x] Distinguish local steps from provider-specific production actions.

### Task 3: Add disaster recovery and STRIDE threat model

Files: `docs/runbooks/disaster-recovery.md`,
`docs/architecture/threat-model.md`.

- [x] Record target RPO/RTO as unmeasured targets and define backup/restore
      verification prerequisites per store.
- [x] Cover SPA, API/auth/webhooks, MongoDB, PostgreSQL/RLS, Redis/queues, Piston,
      external AI/storage providers, and container infrastructure.
- [x] Give each risk a current control, residual state, and verification action.

### Task 4: Link and update status

Files: `docs/architecture/services.md`, `docs/architecture/README.md`,
`docs/architecture/TODO.md`, `docs/backend-status.md`.

- [x] Replace missing runbook markers with links.
- [x] Mark documentation completion separately from unconfigured production
      operations and the pending staging rollout.

### Task 5: Verify

- [x] Run Markdown formatting and architecture viewer/doc consistency checks.
- [x] Check every new relative Markdown link resolves.
- [x] Review the diff for claims that imply unconfigured production controls are
      active.
