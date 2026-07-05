# API Routes

Base URL: `http://localhost:3000/api/v1`

---

## User

| Method | Endpoint | Description | Auth | Role | Request Body | Response |
|--------|----------|-------------|------|------|--------------|----------|
| `GET` | `/user/me` | Get current user profile | Bearer Token | Any | — | `{ success, message, data: User }` |
| `GET` | `/user/:clerkUserId` | Get user by Clerk ID | Bearer Token | ADMIN | — | `{ success, message, data: User }` |

---

## User Settings

| Method | Endpoint | Description | Auth | Role | Request Body | Response |
|--------|----------|-------------|------|------|--------------|----------|
| `GET` | `/user/settings` | Get current user settings | Bearer Token | Any | — | `{ success, message, data: UserSettings }` |
| `PATCH` | `/user/settings` | Update current user settings | Bearer Token | Any | `{ profile?, preferences?, notifications? }` | `{ success, message, data: UserSettings }` |

---

## User Setup

| Method | Endpoint | Description | Auth | Role | Request Body | Response |
|--------|----------|-------------|------|------|--------------|----------|
| `PATCH` | `/user/setup-complete` | Mark setup wizard as complete | Bearer Token | Any | — | `{ success, message, data: User }` |

---

## Webhooks (Clerk)

| Method | Endpoint | Description | Auth | Headers |
|--------|----------|-------------|------|---------|
| `POST` | `/webhooks/clerk` | Receive Clerk webhook events | Svix Signature | `svix-id`, `svix-timestamp`, `svix-signature` |

### Webhook Events

| Event | Action |
|-------|--------|
| `user.created` | Create User in MongoDB |
| `user.updated` | Update email, name, avatarUrl |
| `user.deleted` | Delete User and UserSettings |

---

## Topics

| Method | Endpoint | Description | Auth | Role | Request Body | Response |
|--------|----------|-------------|------|------|--------------|----------|
| `POST` | `/topics` | Create a new topic | Bearer Token | ADMIN | `{ name, slug, category, icon? }` | `{ message, data: Topic }` |
| `GET` | `/topics` | Get all topics (optional `?category=` filter) | Bearer Token | Any | — | `{ message, data: Topic[] }` |
| `GET` | `/topics/:slug` | Get topic by slug | Bearer Token | Any | — | `{ message, data: Topic }` |
| `PATCH` | `/topics/:id` | Update a topic | Bearer Token | ADMIN | `{ name?, slug?, category?, icon? }` | `{ message, data: Topic }` |
| `DELETE` | `/topics/:id` | Delete a topic | Bearer Token | ADMIN | — | `{ message }` |

---

## User Model

```
User {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  clerkUserId   String    @unique
  email         String    @unique
  name          String
  avatarUrl     String?
  role          String    @default("USER")
  isNewUser     Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

## UserSettings Model

```
UserSettings {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  userId        String    @unique
  profile       Json?
  preferences   Json?
  notifications Json?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

## Topic Model

```
Topic {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  slug        String    @unique
  category    String
  icon        String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

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
