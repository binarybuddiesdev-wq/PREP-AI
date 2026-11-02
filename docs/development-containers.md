# Local Development Containers

This is the setup guide for running PrepAI's local services with **Podman**. It covers both supported modes:

1. Database containers with the backend and UI running directly on the host.
2. The complete five-service development stack, including backend and UI containers.

Read this before changing `docker-compose.yml`, starting the stack, or asking an AI assistant to operate it. The compose file is named `docker-compose.yml` for compatibility, but use the `podman-compose` command and the `pnpm podman:*` scripts. Do not use Docker for this setup.

## What runs in each mode

| Service        | Database-only (`pnpm podman:up`) | Full stack (`pnpm podman:full`) | Host port |
| -------------- | -------------------------------- | ------------------------------- | --------: |
| MongoDB        | Container                        | Container                       |   `27017` |
| PostgreSQL     | Container                        | Container                       |    `5432` |
| Redis          | Container                        | Container                       |    `6379` |
| NestJS backend | Run in a host terminal           | Container                       |    `3000` |
| React/Vite UI  | Run in a host terminal           | Container                       |    `5173` |

PostgreSQL and Redis are published on their standard host ports, `5432` and `6379`. Stop any host-installed PostgreSQL or Redis services that occupy those ports before starting the Podman stack. MongoDB runs as a single-node replica set named `rs0`; Prisma requires this for MongoDB writes. The Compose health check initializes the replica set and waits for it to elect its primary. A separate `mongo_config` volume stores MongoDB's internal key file; the existing `mongo_data` volume continues to hold application data. Inside the Podman network, the backend uses service names and standard container ports: `mongo:27017`, `postgres:5432`, and `redis:6379`.

Piston is a separate code-execution service managed by `pnpm piston:*`; it is not part of either Compose mode. Follow [the Piston WSL setup guide](PISTON_WSL_SETUP_GUIDE.md) for that service. A host-run backend uses `PISTON_URL=http://127.0.0.1:2000`; the full Podman server is configured to reach the host service at `http://host.containers.internal:2000`.

## Prerequisites

- **Windows:** Podman Desktop with its WSL machine initialized. Install it from [podman-desktop.io](https://podman-desktop.io/). On other operating systems, install Podman and initialize a machine if required by that platform.
- **Podman CLI:** `podman --version` must work.
- **`podman-compose`:** install it with `uv tool install podman-compose` or `pip install podman-compose`. Confirm `podman-compose --version` works. Use `podman-compose` directly: on some machines `podman compose` can select a different external provider.
- **Node.js 20+ and pnpm 9+:** required to run the root `pnpm podman:*` scripts. Containers use Node.js 22 internally.
- **A root `.env` file:** Compose reads it as an env file and mounts it for the server. If one does not exist, copy `.env.example` to `.env` without overwriting an existing file that may contain real credentials.
- **Available host ports:** `27017`, `5432`, `6379`, `3000`, and `5173` for the services you plan to start. The app ports can be changed as described below.

Start the existing Podman machine before using the scripts:

```powershell
podman machine list
podman machine start
podman info
```

If `podman machine list` has no machine, initialize one with Podman Desktop or `podman machine init`, then start it. A machine that is already running may report that it is already started; that is fine.

## Environment setup

Copy `.env.example` to `.env` only when `.env` does not already exist. In PowerShell, this preserves an existing file:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Keep real credentials in `.env`; it is git-ignored. The app services need this file. The database-only containers do not consume application credentials.

For sign-in and authenticated API requests, configure a matching Clerk development key pair:

- `VITE_CLERK_PUBLISHABLE_KEY`: valid Clerk **React** publishable key beginning with `pk_test_` or `pk_live_`.
- `CLERK_SECRET_KEY`: matching Clerk secret key for backend authentication.

Those values are not needed to create or start the database containers. Without valid Clerk keys, the UI can show its Clerk configuration error and authenticated features will not work.

AI calls need a configured provider key (`NVIDIA_API_KEY` or `GROQ_API_KEY`). This is only needed when using AI-backed features. `CLERK_WEBHOOK_SECRET` is needed to verify Clerk webhooks; other integration credentials are needed only when using their related feature.

### Backend running on the host

The backend connects to published host ports. Set these values in `.env`:

```dotenv
DATABASE_URL=mongodb://prepai:prepai@localhost:27017/prepai?authSource=admin&replicaSet=rs0&directConnection=true
POSTGRESQL_URL=postgresql://postgres:postgres@localhost:5432/prepai
PISTON_URL=http://127.0.0.1:2000
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGIN=http://localhost:5173
```

The database usernames/passwords shown here are local Compose development defaults only. Do not use them outside local development.

### Backend running in Podman

The Compose service overrides the backend database settings to use Podman DNS names and internal ports:

```text
DATABASE_URL=mongodb://prepai:prepai@mongo:27017/prepai?authSource=admin&replicaSet=rs0
POSTGRESQL_URL=postgresql://postgres:postgres@postgres:5432/prepai
REDIS_HOST=redis
REDIS_PORT=6379
PISTON_URL=http://host.containers.internal:2000
```

Do not change these to `localhost` inside the server container: there, `localhost` means the server container itself. `directConnection=true` is used only for a host-run backend because the replica-set member is advertised by the Compose service name. The UI runs in a browser on the host, so its `VITE_API_BASE_URL` remains `http://localhost:3000` by default.

## Start the database containers only

Use this mode when the backend and UI are run from separate host terminals:

```powershell
pnpm podman:up
podman ps
```

Then install/run each package from its own directory if needed:

```powershell
Set-Location server
pnpm install --frozen-lockfile
pnpm start:dev
```

In a second terminal:

```powershell
Set-Location ui
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173`. Stop only the database containers with `pnpm podman:down`; their named data volumes are preserved.

## Start all five services in Podman

Use these commands from the repository root to manage the full stack:

| Action                       | Command                   | Effect                                                                                            |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| Start or attach to the stack | `pnpm podman:full`        | Starts MongoDB, PostgreSQL, Redis, backend, and UI; keeps the terminal attached and streams logs. |
| Stop the stack               | `pnpm podman:full:down`   | Stops the containers; they remain listed in Podman. Volumes are preserved.                        |
| Remove the stack containers  | `pnpm podman:full:remove` | Removes the containers and Compose network. Named volumes and database data are preserved.        |

Do not run the host backend or UI at the same time: they use the same default app ports. Stop them with `Ctrl+C` in their terminals first, then from the repository root run:

```powershell
pnpm podman:full
```

Keep this terminal open to watch service logs. Press `Ctrl+C` to stop the attached stack; its named volumes are preserved. To check container status separately, run `podman ps` in another terminal. The startup order is databases, backend health check, then UI. The backend and UI install from their own lockfiles (`server/pnpm-lock.yaml` and `ui/pnpm-lock.yaml`); dependency directories and generated Prisma clients persist in named Podman volumes. The root is **not** a pnpm workspace, so do not add a `pnpm-workspace.yaml` or try to install the app packages from the root.

Open the UI at `http://localhost:5173`. The backend is available at `http://localhost:3000`; its liveness health endpoint is `http://localhost:3000/health`.

Stop all five containers while preserving databases, dependency caches, and generated clients:

```powershell
pnpm podman:full:down
```

To remove all five stack containers and the Compose network while preserving the named volumes, run:

```powershell
pnpm podman:full:remove
```

Use `pnpm podman:full:down` for the full profile. `pnpm podman:down` stops only the three database services.

### Running host apps and app containers side by side

If you need both modes at once, keep the host app processes on `3000` and `5173`, and set these values in `.env` before starting the full stack:

```dotenv
SERVER_HOST_PORT=3001
UI_HOST_PORT=5174
VITE_API_BASE_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:5174
```

The UI will then be available at `http://localhost:5174`. Restore the default values after stopping the full stack if you want to use the default container ports again. The Compose database host ports remain `27017`, `5432`, and `6379`.

## Logs and status

```powershell
podman ps
podman-compose logs -f mongo
podman-compose logs -f postgres
podman-compose logs -f redis
podman-compose --profile full logs -f server
podman-compose --profile full logs -f ui
```

The app containers are optional-profile services and may appear as stopped containers after `pnpm podman:full:down`; that is expected. `piston_api` is separate and may also appear as a stopped container.

## Data and reset behavior

MongoDB, PostgreSQL, Redis, installed package dependencies, and generated PostgreSQL Prisma code use named Podman volumes. The `pnpm podman:down` and `pnpm podman:full:down` scripts use `stop`, so containers remain listed as stopped. `pnpm podman:full:remove` removes the full stack's containers and Compose network, but keeps named volumes. Enabling the MongoDB replica set reuses the existing MongoDB data volume; it does not reset the database. Do not run `podman-compose down -v` unless you intentionally want to permanently delete the local databases and cached container dependencies.

## Troubleshooting

| Symptom                                           | Check                                                                                                                                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `podman-compose` is not recognized                | Install it, reopen the terminal if PATH changed, then run `podman-compose --version`.                                                                                                              |
| Podman cannot connect to its socket               | Start the machine with `podman machine start`, then verify `podman info`.                                                                                                                          |
| Port is already allocated                         | Stop the process using the host port or change `SERVER_HOST_PORT` / `UI_HOST_PORT` and update `VITE_API_BASE_URL` / `CORS_ORIGIN` together. Database ports are configured in `docker-compose.yml`. |
| Backend container exits during startup            | Check `podman-compose --profile full logs server`; verify `.env` exists and the three database containers report healthy.                                                                          |
| UI container waits for the backend                | Check the backend health at `/health` and inspect server logs. The UI deliberately waits for this health check.                                                                                    |
| UI reports a Clerk configuration error            | Put a real Clerk publishable key in `.env`; the example placeholder is not valid. Check that the secret key belongs to the same Clerk application.                                                 |
| Backend host process cannot connect to a database | Use the host ports and URLs in the host-mode section. Inside a container, use service names and internal ports instead.                                                                            |
