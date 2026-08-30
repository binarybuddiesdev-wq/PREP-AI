# Piston WSL & Podman Setup Guide

This guide details how we successfully hosted and verified the **Piston Code Execution Engine** in a rootless **Podman** environment running on Windows (WSL2), and how you can manage, run, and interact with it.

---

## 1. Root Cause Analysis (Why it failed initially)

When running the standard Piston Docker image (`ghcr.io/engineer-man/piston`) under rootless Podman on WSL2/Windows, it failed and exited immediately due to the following reasons:

1. **Cgroups v2 Controller Delegation Limits:**
   The default entrypoint script (`docker-entrypoint.sh`) attempts to write `+cpuset +cpu +io +memory +pids` to the root cgroup's `cgroup.subtree_control`.
   - Under rootless WSL2, the `cpuset` controller is not delegated to the user namespace by default.
   - Attempting to enable `cpuset` when it's not present in `/sys/fs/cgroup/cgroup.controllers` causes the container startup to fail with:
     ```
     docker-entrypoint.sh: line 22: echo: write error: No such file or directory
     ```

2. **Read-Only / Missing Path Mounting:**
   Attempts to pass `-v /sys/fs/cgroup:/sys/fs/cgroup:ro` made the cgroup directory tree read-only inside the container, preventing the container from setting up the `isolate/` directory structure for sandboxing.

3. **Missing `/piston` Data Volume:**
   Without mounting a persistent directory or volume to `/piston`, the container was unable to locate or write to the `/piston/packages` directory, failing config validations.

4. **IPv6 Localhost Port Forwarding Issue:**
   Binding to `-p 2000:2000` (which defaults to binding all interfaces, including IPv6) prevented the Windows host from forwarding `localhost:2000` or `127.0.0.1:2000` traffic correctly to WSL2.

---

## 2. The Solution Implemented

We resolved these issues without modifying any application code by doing the following:

1. **Created a Custom Entrypoint Script (`piston-entrypoint.sh`):**
   We placed [piston-entrypoint.sh](file:///c:/antigravity-test/PrepAI/piston-entrypoint.sh) in the root of the workspace. This script:
   - Dynamically reads available controllers from `/sys/fs/cgroup/cgroup.controllers`.
   - Enables **only** the controllers that are supported (e.g. `cpu`, `io`, `memory`, `pids`), successfully filtering out unsupported ones like `cpuset`.
   - Mounts read-write cgroups and starts the application normally.

2. **Created a Named Volume:**
   We created a named volume `piston_data` in Podman to store runtimes/packages persistency across container restarts.

3. **Explicit IPv4 Port Binding:**
   We run the container with `-p 127.0.0.1:2000:2000` so that the port binds explicitly to IPv4 localhost, which routes perfectly from the Windows host.

---

## 2b. Additional fixes needed on newer Podman / WSL2 (Podman 6.x, WSL 2.7+)

The setup above was written against an older Podman. On a fresh machine with
**Podman Desktop 6.x** and **WSL 2.7+** three more things were required before
`pnpm piston:start` + `pnpm piston:setup` worked end to end:

1. **`piston-entrypoint.sh` must be LF, not CRLF.**
   Git for Windows (`core.autocrlf=true`) rewrites it to CRLF on clone, which
   breaks the shebang and the container exits 127
   (`exec: /piston_api/src/docker-entrypoint.sh: not found`).
   Fixed permanently by `.gitattributes` (`*.sh text eol=lf`). If you still hit
   it: `dos2unix piston-entrypoint.sh` (or `perl -i -pe 's/\r\n$/\n/'`).

2. **WSL2 mirrored networking** — `%USERPROFILE%\.wslconfig`:

   ```ini
   [wsl2]
   networkingMode=mirrored
   [experimental]
   hostAddressLoopback=true
   ```

   Then `wsl --shutdown` and restart the Podman machine. Under the default NAT
   mode, Podman 6 forwards published ports through a userspace path that WSL's
   `localhost:2000` forwarding does not pick up — the container is healthy and
   reachable from _inside_ the VM but `curl http://127.0.0.1:2000` from Windows
   just hangs / refuses. Mirrored mode makes container ports appear on Windows
   `localhost` directly.

3. **Pin GitHub's release-asset CDN** (already done in `types/piston.ts` via
   `--add-host`). `ppman install` pulls runtimes from
   `release-assets.githubusercontent.com` / `objects.githubusercontent.com`.
   One of GitHub's anycast edges (`185.199.109.133`) was unroutable from this
   network; an unhandled fetch timeout then crashes the whole Piston process
   mid-install (symptom: `pnpm piston:setup` fails with
   `TypeError: Cannot read properties of undefined (reading 'data')` from the
   CLI, and `podman logs piston_api` shows `connect ETIMEDOUT 185.199.109.133:443`).
   Pinning those hosts to `185.199.108.133` fixes it.

Runtimes persist in the `piston_data` named volume, so `pnpm piston:setup` is a
one-time step — after that just `pnpm piston:start` / `pnpm piston:stop`.
`piston:stop` keeps the container (so it stays in the Podman Desktop list and
`piston:start` just restarts it); `piston:remove` deletes it.

## 3. How to Run and Manage Piston

We added a cross-platform TypeScript runner [piston.ts](file:///c:/antigravity-test/PrepAI/piston.ts) and utility scripts in the root [package.json](file:///c:/antigravity-test/PrepAI/package.json) to automate setup and management across Windows, macOS, and Linux shell environments.

### Commands Reference

| Script Command           | Under the Hood                  | Description                                                                                                                                                                                     |
| :----------------------- | :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`pnpm piston:start`**  | `tsx ../piston.ts start`        | Boots up the Piston API container, automatically normalizing the workspace path, mounting the custom entrypoint, mapping the named volume, and binding port `127.0.0.1:2000`.                   |
| **`pnpm piston:stop`**   | `tsx ../types/piston.ts stop`   | `podman stop` — stops the container but **keeps** it (shows as "Exited" in Podman Desktop). Restart with `piston:start`.                                                                        |
| **`pnpm piston:remove`** | `tsx ../types/piston.ts remove` | `podman rm -f` — deletes the `piston_api` container entirely. Use to recreate it with changed `podman run` flags.                                                                               |
| **`pnpm piston:status`** | `tsx ../types/piston.ts status` | Checks the container status (running or exited).                                                                                                                                                |
| **`pnpm piston:setup`**  | `tsx ../types/piston.ts setup`  | Installs CLI package dependencies, then downloads and registers the 3 required language runtimes (JavaScript, TypeScript, and Python). One-time — runtimes persist in the `piston_data` volume. |

---

## 4. Detailed Manual Setup & Verification Steps

If you ever need to manually run or verify the setup, perform the following steps from the **root workspace directory** (`c:\antigravity-test\PrepAI`):

### Step 1: Start the container

Run the start command to boot up the container:

```bash
pnpm piston:start
```

_Note: Make sure your Podman machine/desktop is running._

### Step 2: Check status and logs

Check if the container status shows as `Up`:

```bash
pnpm piston:status
```

Verify the logs to ensure the API server started successfully:

```bash
podman logs piston_api
```

_Expected Output:_

```
Available cgroup controllers: cpu io memory pids
Initialized cgroup with controllers:  +cpu +io +memory +pids
...
[INFO]  index: API server started on 0.0.0.0:2000
```

### Step 3: Install language runtimes

Run the setup command to install the required languages:

```bash
pnpm piston:setup
```

Verify they were installed correctly by querying the runtimes endpoint:

```bash
curl http://127.0.0.1:2000/api/v2/runtimes
```

_Expected Output:_

```json
[
  {
    "language": "javascript",
    "version": "20.11.1",
    "aliases": ["node-javascript", "node-js", "javascript", "js"],
    "runtime": "node"
  },
  {
    "language": "typescript",
    "version": "5.0.3",
    "aliases": ["ts", "node-ts", "tsc", "typescript5", "ts5"]
  },
  {
    "language": "python",
    "version": "3.12.0",
    "aliases": ["py", "py3", "python3", "python3.12"]
  }
]
```

---

## 5. How to Test Code Execution

You can test executing code against the local API.

### JavaScript Execution

Create a payload JSON or call directly:

```bash
curl -X POST http://127.0.0.1:2000/api/v2/execute -H "Content-Type: application/json" -d "{\"language\":\"js\",\"version\":\"*\",\"files\":[{\"content\":\"console.log('Piston is working!')\"}]}"
```

_Expected Output:_

```json
{
  "run": {
    "signal": null,
    "stdout": "Piston is working!\n",
    "stderr": "",
    "code": 0,
    "output": "Piston is working!\n",
    "cpu_time": 77,
    "wall_time": 102
  },
  "language": "javascript",
  "version": "20.11.1"
}
```

### Python Execution

```bash
curl -X POST http://127.0.0.1:2000/api/v2/execute -H "Content-Type: application/json" -d "{\"language\":\"py\",\"version\":\"*\",\"files\":[{\"content\":\"print('Python Piston is working!')\"}]}"
```

_Expected Output:_

```json
{
  "run": {
    "signal": null,
    "stdout": "Python Piston is working!\n",
    "stderr": "",
    "code": 0,
    "output": "Python Piston is working!\n",
    "cpu_time": 30,
    "wall_time": 51
  },
  "language": "python",
  "version": "3.12.0"
}
```
