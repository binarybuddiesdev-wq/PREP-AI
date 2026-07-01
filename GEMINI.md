# PrepAI Project Guidelines

## Tech Stack & Project Structure
- **Frontend:** React (located in `ui/`)
- **Backend:** NestJS (located in `server/`)
- **Package Manager:** `pnpm`

---

## Piston Code Execution Engine

PrepAI uses Piston as its code execution and sandboxing engine. Due to Windows, WSL2, and rootless Podman environment constraints, a custom setup is required:

### Setup and Startup
1. Run **`pnpm piston:start`** to spin up the Piston container.
   * This uses a custom entrypoint [piston-entrypoint.sh](file:///c:/antigravity-test/PrepAI/piston-entrypoint.sh) to handle cgroup v2 controller limits in rootless WSL2/Podman (such as the missing `cpuset` controller).
   * It maps a named volume `piston_data` at `/piston` to persist installed languages.
   * It maps the container port explicitly to IPv4 loopback `127.0.0.1:2000` to prevent Windows port forwarding issues.
2. Run **`pnpm piston:setup`** to download and install the required runtimes:
   * JavaScript
   * TypeScript
   * Python
3. Verify status:
   * Check container status: `pnpm piston:status`
   * Check logs: `podman logs piston_api`

For details, troubleshooting, or manual steps, refer to [PISTON_WSL_SETUP_GUIDE.md](file:///c:/antigravity-test/PrepAI/docs/PISTON_WSL_SETUP_GUIDE.md).
