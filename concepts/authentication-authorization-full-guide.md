# Authentication & Authorization — Complete Guide (Zero to Hero)

## Table of Contents
1. [Authentication vs Authorization](#1-authentication-vs-authorization)
2. [How HTTP Works (The Problem)](#2-how-http-works-the-problem)
3. [Sessions vs Tokens](#3-sessions-vs-tokens)
4. [JWT (JSON Web Token)](#4-jwt-json-web-token)
5. [Passport.js](#5-passportjs)
6. [JWT vs Passport.js — Same or Different?](#6-jwt-vs-passportjs--same-or-different)
7. [Clerk — How It Fits](#7-clerk--how-it-fits)
8. [How PrepAI Uses All of This](#8-how-prepai-uses-all-of-this)

---

## 1. Authentication vs Authorization

### Authentication (Who are you?)

**Definition:** The process of verifying **who** a user is.

**Examples:**
- Entering email + password to log in
- Scanning fingerprint
- Entering OTP sent to phone

**After authentication:** The system knows you are "John" (user ID: 123).

---

### Authorization (What can you do?)

**Definition:** The process of verifying **what** a user is allowed to do.

**Examples:**
- Admin can delete users, regular user cannot
- Free user can see 5 questions, pro user can see unlimited
- User A can edit their own profile, but not User B's

**After authorization:** The system allows or denies the action.

---

### Simple Analogy

```
┌─────────────────────────────────────────────────────────────┐
│                    HOTEL ANALOGY                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Authentication = Showing your ID at the front desk         │
│  "Yes, I am John. Here is my passport."                     │
│                                                             │
│  Authorization  = What your keycard opens                   │
│  "Your keycard opens Room 101, not Room 102."               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow Diagram

```
User tries to access /api/admin/users
           │
           ▼
    ┌──────────────┐
    │ Is user      │──── No ────▶ 401 Unauthorized
    │ logged in?   │              (Who are you?)
    │ (AuthN)      │
    └──────┬───────┘
           │ Yes
           ▼
    ┌──────────────┐
    │ Is user      │──── No ────▶ 403 Forbidden
    │ admin?       │              (You can't do this)
    │ (AuthZ)      │
    └──────┬───────┘
           │ Yes
           ▼
    ┌──────────────┐
    │ Return       │
    │ admin data   │
    └──────────────┘
```

---

## 2. How HTTP Works (The Problem)

HTTP is **stateless** — every request is independent. The server doesn't remember you between requests.

```
Request 1: GET /api/questions
Request 2: GET /api/profile
Request 3: POST /api/save-answer
```

Each request is like a stranger walking in. The server has no idea Requests 1, 2, 3 are from the same person.

**The Problem:** How does the server know who is making each request?

**The Solution:** Authentication mechanisms (Sessions or Tokens).

---

## 3. Sessions vs Tokens

### Session-Based Auth (Traditional)

```
┌──────────┐                    ┌──────────┐
│  Browser  │                   │  Server   │
└─────┬────┘                   └─────┬────┘
      │                              │
      │  1. POST /login              │
      │     {email, password}        │
      │─────────────────────────────>│
      │                              │
      │                              │  2. Verify credentials
      │                              │     Store session in memory/DB
      │                              │     Session ID: abc123
      │                              │
      │  3. Set-Cookie: session=abc123│
      │<─────────────────────────────│
      │                              │
      │  4. GET /api/questions        │
      │     Cookie: session=abc123   │
      │─────────────────────────────>│
      │                              │
      │                              │  5. Look up session abc123
      │                              │     → User is John (ID: 123)
      │                              │
      │  6. Return data              │
      │<─────────────────────────────│
```

**Pros:**
- Simple to understand
- Server controls everything

**Cons:**
- Server must store sessions (memory/database)
- Doesn't scale well (multiple servers = session sync issues)
- Doesn't work well with mobile apps

---

### Token-Based Auth (Modern — JWT)

```
┌──────────┐                    ┌──────────┐
│  Browser  │                   │  Server   │
└─────┬────┘                   └─────┬────┘
      │                              │
      │  1. POST /login              │
      │     {email, password}        │
      │─────────────────────────────>│
      │                              │
      │                              │  2. Verify credentials
      │                              │     Generate JWT token
      │                              │     (contains user info)
      │                              │
      │  3. Return JWT token         │
      │<─────────────────────────────│
      │                              │
      │  4. GET /api/questions        │
      │     Authorization: Bearer <JWT>│
      │─────────────────────────────>│
      │                              │
      │                              │  5. Verify JWT signature
      │                              │     Decode user info from token
      │                              │     (no DB lookup needed!)
      │                              │
      │  6. Return data              │
      │<─────────────────────────────│
```

**Pros:**
- Server is stateless (no session storage)
- Scales easily (multiple servers, no sync needed)
- Works great with mobile apps
- Token contains user info (less DB lookups)

**Cons:**
- Token can be larger than session ID
- Harder to revoke (can't just delete from server)

---

## 4. JWT (JSON Web Token)

### What is JWT?

A JWT is a **signed string** that contains user information. It's like a digital ID card that the server can verify without checking a database.

### JWT Structure

A JWT looks like this (three parts separated by dots):

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTYiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**Three parts:**

```
┌─────────────────────────────────────────────────────────────┐
│  Header (Algorithm + Type)                                  │
│  {"alg": "HS256", "typ": "JWT"}                             │
├─────────────────────────────────────────────────────────────┤
│  Payload (User Data)                                        │
│  {"userId": "123456", "email": "john@example.com",         │
│   "role": "USER", "iat": 1719628800, "exp": 1719715200}    │
├─────────────────────────────────────────────────────────────┤
│  Signature (Security)                                       │
│  HMACSHA256(base64(header) + "." + base64(payload), secret)│
└─────────────────────────────────────────────────────────────┘
```

---

### JWT Payload Fields

```json
{
  "userId": "123456",        // Who you are
  "email": "john@example.com",
  "role": "USER",            // What you can do
  "iat": 1719628800,         // Issued At (when token was created)
  "exp": 1719715200          // Expiration (when token expires)
}
```

**Important:** Payload is **encoded, NOT encrypted**. Anyone can read it. That's why you never put sensitive data (passwords, credit cards) in the payload.

---

### How JWT Verification Works

```
┌─────────────────────────────────────────────────────────────┐
│                    JWT VERIFICATION                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Server receives: Authorization: Bearer eyJhbGci...        │
│                                                             │
│  Step 1: Split the token                                   │
│          header.payload.signature                           │
│                                                             │
│  Step 2: Verify signature                                   │
│          - Take header + payload                           │
│          - Use SECRET_KEY to re-calculate signature         │
│          - Compare with received signature                  │
│          - If match → token is valid                        │
│          - If no match → token is fake/modified             │
│                                                             │
│  Step 3: Check expiration                                   │
│          - Is current time < exp?                           │
│          - Yes → token is still valid                       │
│          - No → token is expired                            │
│                                                             │
│  Step 4: Extract user info from payload                     │
│          - userId, email, role                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### JWT in Code (Without Clerk)

```typescript
import jwt from 'jsonwebtoken';

const SECRET = 'my-super-secret-key';

// Creating a token
const token = jwt.sign(
  { userId: '123', email: 'john@example.com', role: 'USER' },
  SECRET,
  { expiresIn: '24h' }
);
// Returns: "eyJhbGciOiJIUzI1NiIs..."

// Verifying a token
try {
  const decoded = jwt.verify(token, SECRET);
  console.log(decoded); // { userId: '123', email: 'john@example.com', ... }
} catch (error) {
  console.log('Invalid token!');
}
```

---

## 5. Passport.js

### What is Passport.js?

Passport.js is a **middleware for Node.js/Express/NestJS** that makes authentication modular. It's NOT a authentication provider — it's a **framework** that lets you plug in different authentication strategies.

### What is a Strategy?

A strategy is a **plugin** that handles a specific authentication method:

```
┌─────────────────────────────────────────────────────────────┐
│                    PASSPORT STRATEGIES                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  passport-local     → Email + Password (your own DB)       │
│  passport-jwt       → JWT token verification               │
│  passport-google    → "Sign in with Google"                │
│  passport-github    → "Sign in with GitHub"                │
│  passport-facebook  → "Sign in with Facebook"              │
│  passport-clerk     → Clerk tokens (what PrepAI uses)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### How Passport Works (Flow Diagram)

```
┌──────────┐                    ┌──────────┐
│  Request  │                   │  Passport  │
└─────┬────┘                   └─────┬────┘
      │                              │
      │  1. Request comes in         │
      │     Authorization: Bearer <token>
      │─────────────────────────────>│
      │                              │
      │                              │  2. Which strategy?
      │                              │     (JWT? Local? Google?)
      │                              │
      │                              │  3. Run strategy's verify function
      │                              │     - Extract token from header
      │                              │     - Verify token validity
      │                              │     - Return user info
      │                              │
      │                              │  4. Attach user to request
      │                              │     request.user = { id, email, ... }
      │                              │
      │  5. Continue to route handler │
      │<─────────────────────────────│
```

---

### Passport vs Direct JWT Verification

**Without Passport (direct):**
```typescript
// You manually verify
const token = request.headers.authorization.split(' ')[1];
const decoded = jwt.verify(token, SECRET);
request.user = decoded;
```

**With Passport:**
```typescript
// Passport handles it via strategy
passport.authenticate('jwt', { session: false });
// Passport extracts token, verifies, attaches user to request
```

**Same result, Passport is just more organized and modular.**

---

## 6. JWT vs Passport.js — Same or Different?

### They Solve Different Problems

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  JWT = A token format (like a ID card)                     │
│        "Here is a signed string containing user info"       │
│                                                             │
│  Passport = A middleware framework (like a security guard)  │
│             "I will check the ID card using various methods"│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Analogy

```
JWT  = The actual ID card (format, structure, signing)
Passport = The security guard system (who checks ID cards, and how)
```

You can have:
- **JWT without Passport** — You manually verify the token
- **Passport without JWT** — You use Passport with password-based auth
- **JWT + Passport** — Passport uses JWT strategy to verify tokens

---

### Comparison Table

```
┌──────────────────────┬─────────────────────┬─────────────────────┐
│  Feature             │  JWT                │  Passport.js        │
├──────────────────────┼─────────────────────┼─────────────────────┤
│  What is it?         │  Token format       │  Auth middleware    │
│  Purpose             │  Carry user info    │  Plug in strategies │
│  Storage             │  Client-side        │  Server-side        │
│  Can use alone?      │  Yes                │  Yes (with strategy)│
│  Handles sign-up?    │  No                 │  No (via strategy)  │
│  Handles sign-in?    │  No                 │  Yes (via strategy) │
│  Pluggable?          │  No (it's a format) │  Yes (strategies)   │
└──────────────────────┴─────────────────────┴─────────────────────┘
```

---

## 7. Clerk — How It Fits

### Where Clerk Fits in the Picture

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION OPTIONS                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Option 1: Build it yourself                               │
│  ├── Use Passport.js + JWT                                 │
│  ├── Build sign-up/sign-in forms                           │
│  ├── Store passwords in your DB                            │
│  ├── Handle email verification                             │
│  └── LOT OF WORK, security risks                          │
│                                                             │
│  Option 2: Use Clerk (What PrepAI does)                    │
│  ├── Clerk handles everything                              │
│  ├── Clerk provides sign-up/sign-in UI                     │
│  ├── Clerk stores passwords                                │
│  ├── Clerk handles email verification                      │
│  ├── Your backend just verifies Clerk's JWT                │
│  └── EASY, SECURE, FAST                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Clerk vs Passport.js + JWT

```
┌──────────────────────┬─────────────────────┬─────────────────────┐
│  Feature             │  Passport + JWT     │  Clerk              │
├──────────────────────┼─────────────────────┼─────────────────────┤
│  Build login forms?  │  Yes (you build)    │  No (Clerk provides)│
│  Store passwords?    │  Yes (your DB)      │  No (Clerk stores)  │
│  Email verification? │  Yes (you build)    │  No (Clerk handles) │
│  OAuth (Google etc)? │  Yes (via strategy) │  Yes (built-in)     │
│  User management?    │  Yes (your code)    │  Yes (Clerk dashboard│
│  JWT verification?   │  Yes (your code)    │  Yes (your code)    │
│  Setup time          │  Days/weeks         │  Minutes            │
│  Security            │  Your responsibility│  Clerk's responsib. │
└──────────────────────┴─────────────────────┴─────────────────────┘
```

---

### The Complete Picture with Clerk

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│  User    │         │  Clerk   │         │  Frontend│         │  Backend │
│          │         │  (Auth)  │         │  (React) │         │  (NestJS)│
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │  1. Click "Sign In"│                    │                    │
     │───────────────────>│                    │                    │
     │                    │                    │                    │
     │  2. Enter email + password              │                    │
     │───────────────────>│                    │                    │
     │                    │                    │                    │
     │                    │  3. Verify         │                    │
     │                    │     credentials    │                    │
     │                    │                    │                    │
     │                    │  4. Return JWT     │                    │
     │<───────────────────│                    │                    │
     │                    │                    │                    │
     │                    │  5. Store JWT      │                    │
     │                    │     in frontend    │                    │
     │                    │                    │                    │
     │                    │                    │  6. API call + JWT │
     │                    │                    │───────────────────>│
     │                    │                    │                    │
     │                    │                    │  7. Verify JWT     │
     │                    │                    │     with Clerk API │
     │                    │<───────────────────────────────────────│
     │                    │                    │                    │
     │                    │  8. Return valid   │                    │
     │                    │                    │                    │
     │                    │                    │  9. Process request│
     │                    │                    │     Return data    │
     │                    │                    │<───────────────────│
     │                    │                    │                    │
```

---

## 8. How PrepAI Uses All of This

### Current Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                    PrepAI Auth Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FRONTEND (ui/src/main.tsx)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ClerkProvider wraps the app                        │   │
│  │  - Reads VITE_CLERK_PUBLISHABLE_KEY from env       │   │
│  │  - Only renders if key is valid (pk_test/pk_live)  │   │
│  │  - Provides Clerk hooks: useUser, useAuth, etc.    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  BACKEND (server/src/common/guards/clerk-auth.guard.ts)    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ClerkAuthGuard:                                    │   │
│  │  1. Check for Authorization header                 │   │
│  │  2. Extract Bearer token                           │   │
│  │  3. Call Clerk API to verify token                 │   │
│  │  4. Extract user info (id, email, role)            │   │
│  │  5. Attach to request.user                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  DATABASE (server/prisma/schema.prisma)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  User model:                                        │   │
│  │  - clerkId (links to Clerk's user ID)              │   │
│  │  - email, name, role                               │   │
│  │  - isActive, createdAt, updatedAt                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### What Each File Does

```
FILE                                    PURPOSE
─────────────────────────────────────────────────────────────
ui/src/main.tsx                         Wraps app with ClerkProvider
                                        (frontend talks to Clerk)

server/src/common/guards/
  clerk-auth.guard.ts                   Verifies JWT tokens
                                        (backend talks to Clerk)

server/prisma/schema.prisma             User model with clerkId
                                        (links Clerk to your DB)

.env                                    Stores keys (never committed)
  VITE_CLERK_PUBLISHABLE_KEY            Frontend key (pk_test_...)
  CLERK_SECRET_KEY                      Backend key (sk_test_...)
```

---

### The Full Authentication Journey in PrepAI

```
Step 1: User visits PrepAI
        └── ClerkProvider loads (if valid key)

Step 2: User clicks "Sign In"
        └── Clerk's sign-in form appears (hosted by Clerk)

Step 3: User enters email + password
        └── Clerk verifies with its servers
        └── Returns JWT token to frontend

Step 4: Frontend stores JWT
        └── Available for all API calls

Step 5: User clicks "Start Practice"
        └── Frontend: GET /api/questions
        └── Header: Authorization: Bearer <JWT>

Step 6: Backend receives request
        └── ClerkAuthGuard intercepts
        └── Verifies JWT with Clerk API
        └── Extracts user info
        └── Attaches to request.user

Step 7: Route handler executes
        └── Uses request.user.id to fetch user-specific data
        └── Returns questions to frontend
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│  CONCEPT           │  WHAT IT IS                           │
├─────────────────────────────────────────────────────────────┤
│  Authentication    │  Proving who you are (login)          │
│  Authorization     │  Proving what you can do (permissions)│
│  Session           │  Server stores user state             │
│  JWT               │  Token with user info (stateless)     │
│  Passport.js       │  Middleware to plug in auth strategies │
│  Clerk             │  Full auth service (handles everything)│
└─────────────────────────────────────────────────────────────┘
```

**In PrepAI:**
- Clerk handles authentication (sign-up, sign-in, tokens)
- ClerkAuthGuard handles authorization (verifying tokens, protecting routes)
- Database stores user info linked by `clerkId`
