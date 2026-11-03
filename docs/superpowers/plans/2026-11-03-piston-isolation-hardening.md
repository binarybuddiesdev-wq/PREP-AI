# Piston Isolation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply explicit execution and container resource limits to the local Piston service, cap backend response reads, and document the remaining isolation risk.

**Architecture:** Preserve the existing Piston + Podman/WSL2 path and BullMQ worker contract. Configure Piston's documented sandbox limits and an outer container resource cap, constrain the Piston HTTP response stream, and record that the privileged local runner is not a production isolation boundary.

**Tech Stack:** TypeScript, NestJS, Fetch streams, Vitest, Node test runner, Podman, Markdown.

**Spec:** [Piston Isolation Hardening Design](../specs/2026-11-03-piston-isolation-design.md)

## Global Constraints

- Keep production execution disabled by default.
- Keep local Piston bound to `127.0.0.1:2000` and retain the WSL2 custom entrypoint.
- Do not claim the privileged Piston container is production-safe or host-isolated.
- Preserve the existing coding API response and BullMQ contract.

## Review Focus

- Piston output that exceeds the response-byte cap must be cancelled before JSON parsing.
- Malformed or absent Piston response bodies remain a generic 503, without leaking output or service details.
- Per-request CPU-time and memory limits must remain bounded and not be client-controlled.
- Podman arguments must retain the custom entrypoint, named runtime volume, local-only port, and required privileged mode while adding resource caps and sandbox environment.
- Documentation must not imply that the local runner is safe for public production code execution.

## Tasks

### Task 1: Bound Piston API response reads and pin CPU-time limits

**Files:**

- Modify: `server/src/modules/coding/piston.client.ts`
- Test: `server/src/modules/coding/piston.client.spec.ts`

- [x] Write tests that assert compile/run CPU-time values are sent and that an oversized streamed response is cancelled and mapped to `ServiceUnavailableException`.
- [x] Run the focused tests and confirm they fail for the missing request fields and unbounded JSON read.
- [x] Add a 512 KiB streaming response cap; parse JSON only after the complete body is within the cap.
- [x] Run the focused spec and confirm it passes, then run all coding module specs.

### Task 2: Configure the local Podman runner explicitly

**Files:**

- Create: `types/piston-container.ts`
- Test: `types/piston-container.spec.ts`
- Modify: `types/piston.ts`

- [x] Write a Node test for exact local bind, outer resource caps, Piston network/process/file/output/concurrency environment, required custom entrypoint, and persistent runtime volume.
- [x] Run it and confirm it fails because the argument builder is missing.
- [x] Extract a pure argument builder and make the launcher use it without changing existing stop/setup/status behavior.
- [x] Run the argument test and confirm it passes.

### Task 3: Document the local-only security boundary and operations

**Files:**

- Create: `docs/runbooks/piston.md`
- Modify: `docs/PISTON_SETUP.md`
- Modify: `docs/PISTON_WSL_SETUP_GUIDE.md`
- Modify: `docs/adr/0006-defer-firecracker-isolation.md`
- Modify: `docs/architecture/TODO.md`
- Modify: `docs/architecture/services.md`
- Modify: `docs/backend-status.md`
- Modify: `routes/coding-api-spec.md`
- Modify: `docs/WORKLOG.md`

- [x] Document exact effective limits, start/stop/setup/verification commands, loopback-only exposure, and the privileged-container residual risk.
- [x] Correct the old setup instructions that tell operators to run an unmodified Piston image and imply `--privileged` is a security feature.
- [x] Keep Piston hardening as Partial until a stronger production runtime boundary exists; mark the architecture checklist documentation done with that limitation.

### Task 4: Verify and deliver

- [x] Run the focused Piston client specs and the Podman argument-builder test.
- [x] Run `pnpm gate -- --stack server --level full` from the repository root (all checks passed).
- [x] Review the full diff, commit with a Conventional Commit message, and push to `main`.
