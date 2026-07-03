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
