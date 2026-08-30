# ADR-0006: Defer Firecracker/gVisor — accept Docker-level isolation in v1

## Status

Accepted, 2026-08-29

## Context

The Coding feature runs untrusted user code in a sandbox. Today we use
**Piston in a Docker container with `--privileged`**. This is "sandbox-ish"
but not a true security boundary — Docker shares the host kernel; a kernel
exploit escapes the container.

Production code-execution platforms use stronger isolation:

- **gVisor** (Google) — intercepts syscalls, ~2-5% overhead
- **Firecracker** (AWS Lambda) — microVM, ~125ms cold start, near-native perf
- **Kata Containers** — similar to gVisor

## Decision

For **v1**, we accept **Docker-level isolation** and document the residual
risk. Mitigations we WILL implement in v1:

- Container runs with `--network=none` (no egress)
- Resource limits per execution: 1 CPU, 256MB RAM, 5s wall, 32 processes, 1MB output
- Output cap and ANSI stripping
- Pool of 3-5 worker containers behind a queue
- No secrets in the container env
- Per-language configuration: Python and JavaScript run with `--network=none`
  by default; no opt-in for v1

**Re-evaluate** at the Scale phase (see `nfrs.md` §1) — when we have paying
customers, isolate to gVisor or Firecracker.

## Consequences

**Easier:**

- Ships fast; we already have Piston working
- No new infra (no gVisor/Firecracker daemon to operate)
- Acceptable for v1: all data is the user's own code running on the user's
  own session, not multi-tenant untrusted code from the public internet
- Educational: matches the bar for a coding interview prep product, not
  a public code-execution SaaS

**Harder:**

- **Real security risk:** a determined attacker can escape the container
  and read the host filesystem, including the Cloudinary creds, the
  Clerk webhook secret, and other users' PDF chunks on the host
- A user can write `while(true){}` and DoS the shared container for everyone
  (mitigated by wall-time limit + worker pool)
- Compliance posture: not acceptable for SOC2 or any "process untrusted
  external code" audit
- Will need to be redone before the product is "production-grade" for
  enterprise customers

## Alternatives considered

- **Firecracker from day 1.** Rejected: ~2-3 weeks of infra work for a
  v1 with <1000 users. The threat model doesn't justify the cost yet.
- **gVisor.** Rejected: similar infra cost as Firecracker, less isolation
  benefit.
- **Hosted Judge0 or Sphere Engine.** Rejected: vendor lock-in, per-execution
  pricing, loses the "self-hosted, no API key" angle in the README.

## When to revisit

- When daily coding submissions exceed 1,000/day
- Before pursuing SOC2 / ISO 27001 certification
- Before opening the platform to public/untrusted code submissions
- When ANY user reports a container escape or near-escape

## References

- [gVisor](https://gvisor.dev/)
- [Firecracker](https://firecracker-microvm.github.io/)
- `Decisions/DECISIONS-1.md` §"Coding Feature"
- `routes/coding-api-spec.md`
- [SYSTEM_DESIGN_REVIEW.md §B.8](../../SYSTEM_DESIGN_REVIEW.md)
