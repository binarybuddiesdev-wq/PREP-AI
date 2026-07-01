# Piston WSL & Podman Setup Guide

This guide details how we successfully hosted and verified the **Piston Code Execution Engine** in a rootless **Podman** environment running on Windows (WSL2), and how you can manage, run, and interact with it.

---

## 1. Root Cause Analysis (Why it failed initially)

When running the standard Piston Docker image (`ghcr.io/engineer-man/piston`) under rootless Podman on WSL2/Windows, it failed and exited immediately due to the following reasons:

1. **Cgroups v2 Controller Delegation Limits:**
   The default entrypoint script (`docker-entrypoint.sh`) attempts to write `+cpuset +cpu +io +memory +pids` to the root cgroup's `cgroup.subtree_control`.
   * Under rootless WSL2, the `cpuset` controller is not delegated to the user namespace by default.
   * Attempting to enable `cpuset` when it's not present in `/sys/fs/cgroup/cgroup.controllers` causes the container startup to fail with:
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
   * Dynamically reads available controllers from `/sys/fs/cgroup/cgroup.controllers`.
   * Enables **only** the controllers that are supported (e.g. `cpu`, `io`, `memory`, `pids`), successfully filtering out unsupported ones like `cpuset`.
   * Mounts read-write cgroups and starts the application normally.

2. **Created a Named Volume:**
   We created a named volume `piston_data` in Podman to store runtimes/packages persistency across container restarts.

3. **Explicit IPv4 Port Binding:**
   We run the container with `-p 127.0.0.1:2000:2000` so that the port binds explicitly to IPv4 localhost, which routes perfectly from the Windows host.

---

## 3. How to Run and Manage Piston

We added a cross-platform TypeScript runner [piston.ts](file:///c:/antigravity-test/PrepAI/piston.ts) and utility scripts in the root [package.json](file:///c:/antigravity-test/PrepAI/package.json) to automate setup and management across Windows, macOS, and Linux shell environments.

### Commands Reference

| Script Command | Under the Hood | Description |
| :--- | :--- | :--- |
| **`pnpm piston:start`** | `tsx ../piston.ts start` | Boots up the Piston API container, automatically normalizing the workspace path, mounting the custom entrypoint, mapping the named volume, and binding port `127.0.0.1:2000`. |
| **`pnpm piston:stop`** | `tsx ../piston.ts stop` | Safely stops and removes the running `piston_api` container. |
| **`pnpm piston:status`** | `tsx ../piston.ts status` | Checks the container status (checking if running or exited). |
| **`pnpm piston:setup`** | `tsx ../piston.ts setup` | Installs CLI package dependencies, then downloads and registers the 3 required language runtimes (JavaScript, TypeScript, and Python). |

---

## 4. Detailed Manual Setup & Verification Steps

If you ever need to manually run or verify the setup, perform the following steps from the **root workspace directory** (`c:\antigravity-test\PrepAI`):

### Step 1: Start the container
Run the start command to boot up the container:
```bash
pnpm piston:start
```
*Note: Make sure your Podman machine/desktop is running.*

### Step 2: Check status and logs
Check if the container status shows as `Up`:
```bash
pnpm piston:status
```
Verify the logs to ensure the API server started successfully:
```bash
podman logs piston_api
```
*Expected Output:*
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
*Expected Output:*
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
*Expected Output:*
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
*Expected Output:*
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
