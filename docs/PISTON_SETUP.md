# Piston local setup

Use the supported [Piston WSL & Podman setup guide](PISTON_WSL_SETUP_GUIDE.md)
for first-time setup and the [Piston runbook](runbooks/piston.md) for the
current launcher limits, verification, troubleshooting, and security boundary.

Start the local service from the repository root:

```bash
pnpm piston:start
pnpm piston:setup
```

The launcher binds the unauthenticated Piston API to `127.0.0.1:2000`, applies
explicit per-job and container resource limits, and mounts the WSL2-compatible
entrypoint and persistent `piston_data` volume. The local Piston container
still requires Podman's privileged mode for Isolate/cgroup setup. Treat it as a
developer-only runner; it is not an appropriate production isolation boundary.

See [the runbook](runbooks/piston.md) before enabling code execution in any
environment exposed to other users.
