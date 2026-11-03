# Piston Isolation Hardening Design

## Intent

Make the existing local Piston runner apply explicit per-job and aggregate
resource limits, constrain the API response consumed by the backend, and give
operators an accurate local runbook. This reduces resource-exhaustion and
network-access risks while preserving the current Podman, WSL2, BullMQ, and API
contracts.

## Goals

- Keep untrusted programs network-disabled with explicit process, file, output,
  timeout, CPU-time, and memory limits.
- Keep Piston reachable only through an IPv4 loopback published port and cap
  aggregate CPU, memory, and process usage for its container.
- Bound the response bytes the worker reads from Piston before parsing JSON.
- Document startup, configuration, verification, and the limits of this
  deployment.

## Non-goals

- Replace Piston/Isolate with gVisor, Firecracker, Kata, or a hosted provider.
- Change the coding API response or asynchronous execution contract.
- Claim that a privileged Piston container is safe for production or public
  multi-tenant execution.

## Approaches

1. **Request-only limits.** Continue passing per-execution limits from the API.
   This is low-change but leaves Piston defaults and aggregate runner resource
   use implicit.
2. **Explicit Piston and container limits (selected).** Set Piston's own
   supported isolation environment, pass CPU-time limits per request, cap the
   outer Podman container, bind the API to loopback, and enforce a bounded
   response reader. This fits the existing Piston + rootless Podman/WSL2
   architecture without changing clients.
3. **Replace the isolation runtime now.** Move to gVisor/Firecracker or another
   VM-backed service. This offers a stronger boundary but needs a separate
   infrastructure project and host compatibility work; it is outside the
   requested v1 hardening.

## Constraints and security boundary

Piston's upstream launcher uses `--privileged`, and this workspace's custom
entrypoint must write delegated cgroup files under WSL2. Keep that requirement
for the local developer runner; do not disguise it as a hardened production
boundary. Keep production execution disabled by default. Public production
execution requires a separately reviewed runtime boundary that does not rely
on this local privileged container.

The local Piston API has no authentication. Bind port 2000 to `127.0.0.1`, do
not publish it on all interfaces, and do not expose `/api/v2/execute` directly
to clients. Only the backend worker should submit programs in the application
flow. Job network access remains disabled inside Piston even though the API
container itself needs network access for package installation.

## Selected limits

- Per execution: compile/run wall time 10,000/3,000 ms; compile/run CPU time
  10,000/3,000 ms; compile/run memory 256 MiB; max 20 cases and 32,000 source
  characters remain application-side limits.
- Piston defaults made explicit: networking disabled, 32 processes, 64 open
  files, 1 MiB maximum file size, 16 KiB stdout/stderr limit, and five
  concurrent jobs to match the current worker concurrency.
- Podman aggregate cap: 4 CPUs, 2 GiB memory, and 512 processes.
- Backend Piston response read cap: 512 KiB, checked while reading the stream;
  cancel oversized bodies before JSON parsing.

## Verification

Use Vitest for Piston request construction and response-size behavior, and a
focused Node test for the Podman argument builder. Run the server full gate and
the Piston configuration test. A live Piston smoke test is conditional on the
local Podman service and installed runtimes being available; unit tests do not
prove kernel/cgroup isolation.

## Consequences and open work

The existing local Podman + WSL2 workflow remains supported. These controls
reduce accidental and resource-based abuse but do not remove the privileged
container risk or prove host isolation. gVisor/Firecracker or an equivalent
production boundary remains open before public production code execution.
