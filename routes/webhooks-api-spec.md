# Webhooks — API Specification

Base URL: `http://localhost:3000/api/v1/webhooks`

Webhook endpoints are `@Public()` — no Bearer token required. Instead, they use Svix signature verification.

---

## Clerk Webhook

Receives Clerk user lifecycle events to keep the local MongoDB user in sync.

**Method:** `POST`
**Route:** `/webhooks/clerk`
**Auth:** Svix signature verification via `CLERK_WEBHOOK_SECRET`

### Required Headers

| Header | Description |
|--------|-------------|
| `svix-id` | Unique webhook ID |
| `svix-timestamp` | Unix timestamp of the event |
| `svix-signature` | HMAC-SHA256 signature for verification |

### Events

#### `user.created`

Create a new user in MongoDB.

```json
{
  "type": "user.created",
  "data": {
    "id": "user_2xKp9mNqR3",
    "email_addresses": [{ "email_address": "user@example.com" }],
    "first_name": "John",
    "last_name": "Doe",
    "image_url": "https://img.clerk.com/xxx"
  }
}
```

**Response:** `{ "received": true, "userId": "667f..." }`

#### `user.updated`

Update user email, name, and avatar.

```json
{
  "type": "user.updated",
  "data": {
    "id": "user_2xKp9mNqR3",
    "email_addresses": [{ "email_address": "new@example.com" }],
    "first_name": "John",
    "last_name": "Smith",
    "image_url": "https://img.clerk.com/yyy"
  }
}
```

**Response:** `{ "received": true, "userId": "667f..." }`

#### `user.deleted`

Delete user and their settings from MongoDB.

```json
{
  "type": "user.deleted",
  "data": {
    "id": "user_2xKp9mNqR3"
  }
}
```

**Response:** `{ "received": true }`

### Errors

| Status | Message |
|--------|---------|
| 400 | Webhook secret not configured |
| 400 | Missing webhook headers (svix-id, svix-timestamp, svix-signature) |
| 400 | Invalid webhook signature |

---

## Configuration

| Env Variable | Required | Description |
|-------------|----------|-------------|
| `CLERK_WEBHOOK_SECRET` | Yes | Signing secret from Clerk Dashboard → Webhooks |

---

## Summary

| # | Method | Route | Description |
|---|--------|-------|-------------|
| 1 | `POST` | `/webhooks/clerk` | Receive Clerk user.created/updated/deleted events |
