# API Routes

Base URL: `http://localhost:3000/api/v1`

---

## Spec Files

Each module has its own detailed spec file in the `routes/` directory:

| Module | File | Description |
|--------|------|-------------|
| **Health** | [`routes/health-api-spec.md`](routes/health-api-spec.md) | Health check endpoint |
| **User** | [`routes/user-api-spec.md`](routes/user-api-spec.md) | User profile, settings, setup |
| **Webhooks** | [`routes/webhooks-api-spec.md`](routes/webhooks-api-spec.md) | Clerk webhook event handling |
| **Topics** | [`routes/topics-api-spec.md`](routes/topics-api-spec.md) | Topic CRUD |
| **Questions** | [`routes/questions-api-spec.md`](routes/questions-api-spec.md) | Question CRUD (MongoDB) |
| **Theory** | [`routes/theory-api-spec.md`](routes/theory-api-spec.md) | Theory practice sessions, answers, AI scoring, weak areas |
| **Coding** | [`routes/coding-api-spec.md`](routes/coding-api-spec.md) | Coding problems, sessions, code execution, AI review, daily stats |

---

## Testing in Swagger

### Authentication

1. Open Swagger at `http://localhost:3000/docs`
2. Click **Authorize** at the top right
3. Paste your Bearer token and click **Authorize**

### Getting the Bearer Token

1. Open the frontend at `http://localhost:5173`
2. Log in normally
3. Open browser **DevTools** (F12) → **Application** tab → **Cookies**
4. Copy the value of `__session` cookie (starts with `eyJ...`)
5. Paste it into Swagger's Authorize field

### Important: Clerk Token Expiry

Clerk access tokens expire in **~60 seconds**. If you get a `401 Invalid session token` error:

1. Go back to the frontend
2. Refresh the page (F5)
3. Copy the new `__session` cookie value
4. Paste it into Swagger's Authorize again
5. Test the endpoint

This is normal Clerk behavior — short-lived tokens for security. For testing, you'll need to refresh the token frequently.
