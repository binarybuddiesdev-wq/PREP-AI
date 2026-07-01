# Piston Setup for PrepAI — Code Execution Engine

## Option A: Direct Image Pull (Recommended — Faster)

### Step 1: Pull the Piston API image

```bash
podman pull ghcr.io/engineer-man/piston
```

### Step 2: Run the Piston container

```bash
podman run -d --name piston_api -p 2000:2000 --privileged ghcr.io/engineer-man/piston
```

### Step 3: Verify it's running

```bash
podman ps
```

You should see `piston_api` running on port `2000`.

### Step 4: Test the API

```bash
curl http://localhost:2000/api/v2/runtimes
```

### Step 5: Install language runtimes

Clone the repo just for the CLI tool:

```bash
git clone https://github.com/engineer-man/piston
cd piston/cli && npm i && cd ..
```

Install our 3 languages:

```bash
cli/index.js ppman install node
cli/index.js ppman install typescript
cli/index.js ppman install python
```

### Step 6: Test code execution

```bash
curl -X POST http://localhost:2000/api/v2/execute -H "Content-Type: application/json" -d "{\"language\":\"js\",\"version\":\"*\",\"files\":[{\"content\":\"console.log(\\\"Piston is working!\\\")\"}]}"
```

Expected output should contain `"stdout":"Piston is working!\n"`

---

## Option B: Full Clone + Docker Compose

### Step 1: Clone the repo

```bash
git clone https://github.com/engineer-man/piston
cd piston
```

### Step 2: Start with docker-compose

```bash
docker-compose up -d api
```

### Step 3: Install CLI dependencies

```bash
cd cli && npm i && cd ..
```

### Step 4: Install language runtimes

```bash
cli/index.js ppman install node
cli/index.js ppman install typescript
cli/index.js ppman install python
```

### Step 5: Verify

```bash
curl http://localhost:2000/api/v2/runtimes
```

---

## Useful Commands

```bash
# Check running containers
podman ps

# View Piston logs
podman logs piston_api

# Stop Piston
podman stop piston_api

# Restart Piston
podman restart piston_api

# Remove Piston container
podman rm -f piston_api

# List installed runtimes
curl http://localhost:2000/api/v2/runtimes | python -m json.tool

# Install more languages later
cli/index.js ppman install java
cli/index.js ppman install go
cli/index.js ppman install rust
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/runtimes` | GET | List installed language runtimes |
| `/api/v2/execute` | POST | Execute code |
| `/api/v2/connect` | WebSocket | Interactive execution |

### Execute Request Body

```json
{
  "language": "js",
  "version": "*",
  "files": [
    {
      "name": "solution.js",
      "content": "function twoSum(nums, target) { ... }"
    }
  ],
  "stdin": "",
  "args": [],
  "run_timeout": 5000
}
```

### Execute Response

```json
{
  "run": {
    "stdout": "output here",
    "stderr": "",
    "code": 0,
    "signal": null,
    "cpu_time": 8,
    "wall_time": 154,
    "memory": 1160000
  }
}
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `podman` command not found | Make sure Podman Desktop is running and podman CLI is in PATH |
| Container fails to start | Ensure `--privileged` flag is used (required for sandboxing) |
| Port 2000 already in use | Change port: `-p 2001:2000` and update API URL accordingly |
| `ppman` install fails | Check container is running: `podman ps` |
| Windows line ending issues | Use Git Bash or set `core.autocrlf=false` in git config |
