# Clerk Authentication — How It Works in PrepAI

## What is Clerk?

Clerk is a **third-party authentication service**. It handles:
- Sign-up / Sign-in forms
- Password management
- Email verification
- JWT token generation

You don't build any of this — your app just "talks to Clerk" when needed.

---

## Publishable Keys

Clerk gives you two types of keys:

- **`pk_test_...`** — Development environment. Use this while building. Connects to Clerk's test servers with dummy users.
- **`pk_live_...`** — Production environment. Real users, real data. Never expose in dev repos.

The frontend validates the key format before wrapping the app:
```typescript
const isClerkValid = clerkPubKey && /^pk_(test|live)_/.test(clerkPubKey)
```

---

## Complete Authentication Flow

### Step 1: User Signs In (Frontend → Clerk)

User enters credentials on Clerk's hosted sign-in form. Clerk verifies and returns a JWT token.

```
User → Clerk's servers → Clerk verifies credentials → Clerk returns JWT token
```

**Your backend is NOT involved at this point.**

### Step 2: Frontend Stores the Token

After sign-in, Clerk gives the frontend a JWT token. The frontend stores it and attaches it to every API call:

```
Authorization: Bearer <clerk_token_here>
```

### Step 3: Frontend Calls Backend

When React makes an API call (e.g., fetch questions), it sends the token:

```
GET /api/questions
Headers: Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### Step 4: Backend Verifies the Token (ClerkAuthGuard)

Your `ClerkAuthGuard` (`server/src/common/guards/clerk-auth.guard.ts`) does this:

```typescript
const client = createClerkClient({ secretKey });
const payload = await client.verifyToken(token);  // Clerk verifies it
request.user = { id: payload.sub, email: ... };   // You get user info
```

The guard calls **Clerk's API** to verify the token is real and not forged. If valid, it extracts user info (`id`, `email`, `role`) and attaches it to the request.

### Step 5: Backend Uses the User Info

Now any route handler can access `request.user.id` to know who's making the request.

---

## Flow Diagram

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Frontend   │         │   Clerk     │         │   Backend   │
│  (React)     │         │  (3rd party)│         │  (NestJS)   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  1. User signs in     │                       │
       │──────────────────────>│                       │
       │                       │                       │
       │  2. Clerk returns JWT │                       │
       │<──────────────────────│                       │
       │                       │                       │
       │  3. Frontend sends API call + JWT             │
       │──────────────────────────────────────────────>│
       │                       │                       │
       │                       │  4. Backend verifies  │
       │                       │     JWT with Clerk    │
       │                       │<─────────────────────>│
       │                       │                       │
       │                       │  5. Backend gets      │
       │                       │     user info,        │
       │                       │     processes request │
       │  6. Response          │                       │
       │<──────────────────────────────────────────────│
```

---

## Why Use Clerk?

- You don't build login forms — Clerk provides them
- You don't store passwords — Clerk does
- You don't handle email verification — Clerk does
- You only care about user identity — your backend just verifies the token and gets user info

---

## What's in PrepAI Currently

### Done:
1. **Database Schema** — `User` model has `clerkId` field (unique) in `server/prisma/schema.prisma`
2. **Backend Guard** — `ClerkAuthGuard` verifies Bearer tokens via `@clerk/clerk-sdk-node`
3. **Frontend Provider** — `ClerkProvider` wraps the app (with valid key check)
4. **Dependencies** — `@clerk/clerk-react` (frontend), `@clerk/clerk-sdk-node` (backend)

### Not Done Yet:
- No Clerk UI components (`<SignIn />`, `<SignedIn>`, `<SignedOut>`)
- No user sync logic (creating `User` record in DB after Clerk sign-up)
- Routes not wired with `@UseGuards(ClerkAuthGuard)` yet
