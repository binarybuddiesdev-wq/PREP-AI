# Project Rules and Customizations

## Local Development Containers

For the MongoDB, PostgreSQL, Redis, backend, and UI development containers, read [`docs/development-containers.md`](../docs/development-containers.md) before operating or changing the stack. Use Podman via `podman-compose` and the root `pnpm podman:*` scripts. The documented stop commands preserve volumes; do not remove them unless explicitly asked to reset local data.

## Piston Code Execution Engine Setup (Podman & WSL2)

When setting up or troubleshooting the Piston code execution engine in this workspace under Windows / WSL2 with rootless Podman:

1. **Do Not Use Default Entrypoint directly:** The standard Piston Docker image (`ghcr.io/engineer-man/piston`) fails due to cgroup controller delegation limits in WSL2 (specifically the missing `cpuset` controller).
2. **Use the Custom Entrypoint:** Always mount the local `piston-entrypoint.sh` file over `/piston_api/src/docker-entrypoint.sh`. It dynamically detects and enables only the cgroup controllers supported by the host.
3. **Data Volume:** Mount a named volume `piston_data` at `/piston` so that installed language packages persist.
4. **Port Binding:** Bind explicitly to IPv4 localhost using `-p 127.0.0.1:2000:2000` to avoid WSL loopback routing issues on Windows hosts.
5. **CLI / Package Installation:** Runtimes are installed using the utility CLI at `./piston-cli`. Do not download packages directly or manually construct container environments.

Use the following scripts defined in the root `package.json`:

- `pnpm piston:start` - Runs the container with the required volume and custom entrypoint.
- `pnpm piston:stop` - Stops the container but keeps it (restart with `piston:start`).
- `pnpm piston:remove` - Deletes the container entirely.
- `pnpm piston:setup` - Installs JavaScript, TypeScript, and Python runtimes.
- `pnpm piston:status` - Checks status of the container.
