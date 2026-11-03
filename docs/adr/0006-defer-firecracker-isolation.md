# ADR-0006: Keep the local Piston runner, defer production-grade isolation

## Status

Accepted, 2026-08-29; operational limits updated 2026-11-03

## Context

The Coding feature executes user-submitted code. The local developer setup
runs Piston in a rootless Podman container with `--privileged` so Piston's
Isolate sandbox can initialize cgroups. Rootless mode and Isolate provide
useful defense in depth, but the privileged runner still shares the host
kernel and must not be treated as a safe public multi-tenant boundary.

Production code-execution platforms use stronger isolation:

- **gVisor** (Google) intercepts syscalls.
- **Firecracker** (AWS) runs microVMs.
- **Kata Containers** uses lightweight virtual machines.

## Decision

For local development, retain the current Piston + rootless Podman/WSL2
architecture and make its limits explicit. The API remains disabled in
production by default. The supported local launcher binds only to loopback,
caps aggregate CPU/memory/process use, and configures Piston to disable network
access for submitted jobs and enforce process, file, output, time, CPU-time,
memory, and concurrency limits. The backend also caps the bytes read from a
Piston response.

These controls reduce resource-exhaustion and accidental exposure risk; they
do not remove the privileged container risk or prove host isolation. Before
public production execution, use a separately reviewed VM-backed or equivalent
isolation boundary. Explicitly setting `PISTON_EXECUTION_ENABLED=true` is not
an isolation mechanism.

## Consequences

**Easier:**

- Keeps the existing local development workflow and its WSL2 cgroup workaround.
- Makes execution bounds reproducible and verifiable.

**Harder:**

- A determined attacker may escape the local container and access resources
  available to the host user; container limits are not a VM boundary.
- The local Piston API is unauthenticated and must stay loopback-only.
- The local runner is not acceptable for public production or enterprise
  untrusted-code execution; a stronger runtime and security review are needed.

## Alternatives considered

- **Firecracker or gVisor now.** Deferred as a separate infrastructure
  project because it needs host and deployment compatibility work. This does
  not authorize public production use of the local runner.
- **Remove `--privileged` from the local launcher without replacing the
  cgroup/Isolate setup.** Rejected because Piston's upstream launcher uses
  privileged access and this project's WSL2 entrypoint writes delegated cgroup
  files. Removing it without a tested replacement would break sandbox setup.
- **Hosted Judge0 or Sphere Engine.** Rejected for now due vendor lock-in and
  per-execution pricing.

## When to revisit

- Before enabling public production code execution.
- Before pursuing SOC2 / ISO 27001 certification.
- If a user reports a container escape or near-escape.

## References

- [Piston security model](https://github.com/engineer-man/piston#security)
- [Piston configuration](https://github.com/engineer-man/piston/blob/master/docs/configuration.md)
- [gVisor](https://gvisor.dev/)
- [Firecracker](https://firecracker-microvm.github.io/)
- [Local Piston runbook](../runbooks/piston.md)
- `Decisions/DECISIONS-1.md`, Coding Feature
- [Coding API contract](../../routes/coding-api-spec.md)
- [SYSTEM_DESIGN_REVIEW.md](../../SYSTEM_DESIGN_REVIEW.md)
