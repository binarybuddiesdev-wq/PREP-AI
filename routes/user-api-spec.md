# User Module — API Specification

Base URL: `http://localhost:3000/api/v1/users`

All endpoints require Bearer token authentication (Clerk) unless marked `@Public()`.

---

## 1. Get Current User

Fetch the authenticated user's profile. Creates user via lazy sync if not found.

**Method:** `GET`
**Route:** `/users/me`
**Auth:** Bearer Token (any authenticated user)

### Response (200 OK)

```json
{
  "success": true,
  "message": "User profile fetched successfully",
  "data": {
    "id": "667f8a1b2c3d4e5f6a7b8c9d",
    "clerkUserId": "user_2xKp9mNqR3",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": "https://img.clerk.com/xxx",
    "role": "USER",
    "isNewUser": true,
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-25T00:00:00.000Z"
  }
}
```

---

## 2. Get User Settings

Get settings for the authenticated user.

**Method:** `GET`
**Route:** `/users/settings`
**Auth:** Bearer Token (any authenticated user)

### Response (200 OK)

```json
{
  "success": true,
  "message": "Settings fetched successfully",
  "data": {
    "id": "667f8a1b2c3d4e5f6a7b8c9e",
    "userId": "667f8a1b2c3d4e5f6a7b8c9d",
    "profile": { "title": "Software Engineer", "experience": "5 years" },
    "preferences": { "theme": "dark", "language": "en" },
    "notifications": { "email": true, "push": false }
  }
}
```

---

## 3. Update User Settings

Upsert settings for the authenticated user.

**Method:** `PATCH`
**Route:** `/users/settings`
**Auth:** Bearer Token (any authenticated user)

### Request Body

All fields optional:

```json
{
  "profile": { "title": "Senior Engineer" },
  "preferences": { "theme": "light" },
  "notifications": { "email": false }
}
```

### Response (200 OK)

```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "id": "667f8a1b2c3d4e5f6a7b8c9e",
    "userId": "667f8a1b2c3d4e5f6a7b8c9d",
    "profile": { "title": "Senior Engineer" },
    "preferences": { "theme": "light" },
    "notifications": { "email": false }
  }
}
```

---

## 4. Mark Setup Complete

Mark the onboarding wizard as complete (sets `isNewUser: false`).

**Method:** `PATCH`
**Route:** `/users/setup-complete`
**Auth:** Bearer Token (any authenticated user)

### Response (200 OK)

```json
{
  "success": true,
  "message": "Setup marked as complete",
  "data": {
    "id": "667f8a1b2c3d4e5f6a7b8c9d",
    "clerkUserId": "user_2xKp9mNqR3",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "isNewUser": false
  }
}
```

---

## 5. Get User by Clerk ID (Admin)

Fetch any user by their Clerk ID.

**Method:** `GET`
**Route:** `/users/:clerkUserId`
**Auth:** Bearer Token + ADMIN role

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `clerkUserId` | string | Clerk user ID (e.g. `user_2xKp9mNqR3`) |

### Response (200 OK)

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "id": "667f8a1b2c3d4e5f6a7b8c9d",
    "clerkUserId": "user_2xKp9mNqR3",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "isNewUser": false
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 404 | User not found |

---

## Summary

| # | Method | Route | Description | Auth | Role |
|---|--------|-------|-------------|------|------|
| 1 | `GET` | `/users/me` | Get current user profile | Bearer | Any |
| 2 | `GET` | `/users/settings` | Get user settings | Bearer | Any |
| 3 | `PATCH` | `/users/settings` | Update user settings | Bearer | Any |
| 4 | `PATCH` | `/users/setup-complete` | Mark setup wizard complete | Bearer | Any |
| 5 | `GET` | `/users/:clerkUserId` | Get user by Clerk ID | Bearer | ADMIN |

## Models (MongoDB)

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
