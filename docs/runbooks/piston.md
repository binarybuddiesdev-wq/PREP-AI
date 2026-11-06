# Piston runbook

## Scope and security boundary

This runbook covers PrepAI's **local developer** Piston service, managed by
rootless Podman on Windows/WSL2. The API has no authentication. The launcher
publishes port 2000 on IPv4 loopback only and connects Piston to the private
`prepai-dev_default` Podman network. The backend worker calls the `piston_api`
network alias. Do not publish this port on all host interfaces or expose
`/api/v2/execute` to browser clients.

Piston uses Isolate and the local container runs with Podman's `--privileged`
mode so it can initialize the delegated cgroups required by Isolate and the
WSL2 workaround. Rootless Podman reduces the host identity's authority, but
this is not a production-grade tenant boundary. Production code execution
remains disabled by default. Do not enable it against this local runner for
public or multi-tenant traffic; use a separately reviewed VM-backed or
equivalent isolation service first.

Piston disables network access **inside submitted jobs**. The API container
itself retains outbound access because the one-time runtime setup downloads
trusted language packages.

## Effective limits

| Boundary                     | Limit                                                     |
| ---------------------------- | --------------------------------------------------------- |
| Source code                  | 32,000 characters                                         |
| Examples per execution       | 20                                                        |
| Run wall time / CPU time     | 3,000 ms each                                             |
| Compile wall time / CPU time | 10,000 ms each                                            |
| Compile/run memory           | 256 MiB each                                              |
| Job processes                | 32                                                        |
| Open files per job           | 64                                                        |
| Maximum file size per job    | 1 MiB                                                     |
| Stdout/stderr per stream     | 16 KiB                                                    |
| Piston concurrent jobs       | 5, aligned with the coding worker                         |
| Podman container aggregate   | 4 CPUs, 2 GiB memory, 512 processes                       |
| Piston response read by API  | 512 KiB; larger streams are cancelled before JSON parsing |

The API also returns no more than 16 KiB for a surfaced output value. Server
request and response limits are independent of Piston's own limits, so a
misconfigured or unexpected Piston response cannot be read without bound by a
worker.

Piston values are passed by `types/piston-container.ts`; per-execution values
are set by `server/src/modules/coding/piston.client.ts`. Keep those values
aligned when changing limits. Upstream references:
[Piston security model](https://github.com/engineer-man/piston#security) and
[Piston configuration](https://github.com/engineer-man/piston/blob/master/docs/configuration.md).

## Start and stop

From the repository root:

```bash
pnpm piston:start
pnpm piston:setup
pnpm piston:status
podman logs piston_api
```

Start the PrepAI Podman stack before the first `pnpm piston:start` so its
private network exists. The start command attaches the runner to that network
without changing its loopback-only host port. `pnpm piston:setup` is a
first-time step. Runtime packages persist in the
`piston_data` named volume.

```bash
pnpm piston:stop
pnpm piston:start
```

When launcher arguments change, recreate the container so Podman applies them:

```bash
pnpm piston:remove
pnpm piston:start
```

Removing the container leaves the named runtime volume in place. Do not run
`podman volume rm piston_data` unless you intend to reinstall all runtimes.

To disable execution at the API, set `PISTON_EXECUTION_ENABLED=false` in the
environment and restart the API/worker. Production defaults to disabled;
setting it to `true` does not make this local container production-safe.

## Verify the boundary

Check Podman's effective container settings:

```bash
podman inspect --format '{{.HostConfig.PortBindings}}' piston_api
podman inspect --format '{{.HostConfig.NanoCpus}} {{.HostConfig.Memory}} {{.HostConfig.PidsLimit}}' piston_api
podman inspect --format '{{.Config.Env}}' piston_api
```

The published binding must contain `127.0.0.1:2000`; resource values should
represent 4 CPUs, 2 GiB, and 512 processes. The environment should include
`PISTON_DISABLE_NETWORKING=true`, the per-job limits above, and a maximum of 5
concurrent jobs. Do not paste environment inspection output into public issue
trackers if unrelated secrets were added to the container environment.

Check installed runtimes and the API response from the host:

```bash
curl --fail http://127.0.0.1:2000/api/v2/runtimes
```

The expected installed languages are JavaScript, TypeScript, and Python. The
backend is the only application component that should submit jobs. A live
smoke execution confirms basic operation; it does not prove isolation from the
host kernel.

## Troubleshooting

| Symptom                           | Check                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Container exits during startup    | Review `podman logs piston_api`; confirm WSL2 cgroup v2 and the mounted `piston-entrypoint.sh`.                        |
| Host cannot reach port 2000       | Confirm the Podman machine is running and port 2000 is not occupied; use `127.0.0.1`, not an IPv6 localhost binding.   |
| Piston rejects an execution limit | The request may exceed the configured server maximum. Keep API limits at or below the runbook values.                  |
| Language runtime is missing       | Run `pnpm piston:setup` and inspect `podman logs piston_api`.                                                          |
| Production execution is disabled  | Keep it disabled for the local runner. For production, configure an independently reviewed hardened execution service. |

## Operational limits

Unit specs prove request limits and response-byte handling. The argument-builder
test proves the Podman flags and Piston environment passed by the launcher.
Neither proves that the WSL2 kernel enforces cgroups or that a container escape
is impossible. A security review and live host-level isolation testing are
required before using a runner for public production code execution.

## Escalation

Escalate repeated container startup failures, unexpected resource use, or a
sandbox-boundary concern to the backend owner. Stop the local runner with
`pnpm piston:stop` if a possible escape or unauthorized network access is
suspected. Preserve container logs and the image identifier; do not expose the
runner publicly while investigating.
