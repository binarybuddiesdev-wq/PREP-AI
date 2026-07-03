# Webhooks — What They Are and How PrepAI Uses Them

## Table of Contents
1. [What is a Webhook?](#1-what-is-a-webhook)
2. [Webhook vs API Call](#2-webhook-vs-api-call)
3. [How Clerk Webhooks Work](#3-how-clerk-webhooks-work)
4. [What Events Does Clerk Send?](#4-what-events-does-clerk-send)
5. [The Problem Webhooks Solve in PrepAI](#5-the-problem-webhooks-solve-in-prepai)
6. [Flow Diagram](#6-flow-diagram)
7. [Webhook Signature Verification](#7-webhook-signature-verification)
8. [PrepAI Implementation Plan](#8-prepai-implementation-plan)

---

## 1. What is a Webhook?

A webhook is a **push notification from one server to another**. Instead of your server asking "any updates?", the other server says "hey, something happened!" automatically.

### Simple Analogy

```
┌─────────────────────────────────────────────────────────────┐
│                    WEBHOOK ANALOGY                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WITHOUT Webhook (Polling):                                 │
│  ─────────────────────────                                  │
│  You: "Any new orders?"  → Restaurant: "No"                 │
│  You: "Any new orders?"  → Restaurant: "No"                 │
│  You: "Any new orders?"  → Restaurant: "Yes! Order #42"     │
│  (Wasteful — you keep asking)                               │
│                                                             │
│  WITH Webhook:                                              │
│  ─────────────                                              │
│  You: "Call me when order is ready"                         │
│  Restaurant: (calls you) "Order #42 is ready!"              │
│  (Efficient — they tell you when something happens)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Webhook vs API Call

They're opposites:

```
┌──────────────────┬──────────────────────┬──────────────────────┐
│  Feature         │  API Call            │  Webhook             │
├──────────────────┼──────────────────────┼──────────────────────┤
│  Who initiates?  │  YOUR server         │  THEIR server        │
│  Direction       │  You → Them          │  They → You          │
│  When?           │  When you need data  │  When something      │
│                  │                      │  happens             │
│  Pattern         │  Request / Response  │  Push notification   │
│  Example         │  GET /api/users      │  POST /webhook       │
│                  │                      │  { event: "created" }│
└──────────────────┴──────────────────────┴──────────────────────┘
```

### API Call (Your server asks)
```
Your Backend                    Clerk
     │                            │
     │  GET /api/users/123        │
     │───────────────────────────>│
     │                            │
     │  { id: 123, name: "John" } │
     │<───────────────────────────│
```

### Webhook (Clerk tells your server)
```
Clerk                          Your Backend
  │                                │
  │  User signs up on Clerk        │
  │                                │
  │  POST /webhooks/clerk          │
  │  { event: "user.created",      │
  │    data: { id: 123, ... } }    │
  │───────────────────────────────>│
  │                                │
  │  Your backend creates          │
  │  User record in MongoDB        │
```

---

## 3. How Clerk Webhooks Work

### The Setup

You tell Clerk: "When something happens to a user, send a POST request to my server."

In Clerk Dashboard:
```
Webhooks → Add Endpoint
URL: https://your-app.com/api/v1/webhooks/clerk
Events: user.created, user.updated, user.deleted
```

### What Happens at Runtime

```
Step 1: User signs up on PrepAI (via Clerk's UI)
           │
Step 2: Clerk creates the user in Clerk's database
           │
Step 3: Clerk sends a webhook to YOUR server
           │
           POST https://prepai.com/api/v1/webhooks/clerk
           Body: {
             "type": "user.created",
             "data": {
               "id": "user_abc123",
               "email_addresses": [{ "email_address": "john@gmail.com" }],
               "first_name": "John",
               "last_name": "Doe",
               "image_url": "https://..."
             }
           }
           │
Step 4: Your server receives the webhook
           │
Step 5: Your server creates a User document in MongoDB
           │
           { clerkUserId: "user_abc123",
             email: "john@gmail.com",
             name: "John Doe",
             avatarUrl: "https://...",
             role: "USER",
             isNewUser: true }
```

---

## 4. What Events Does Clerk Send?

### User Events (what PrepAI cares about)

| Event | When It Fires | What PrepAI Does |
|-------|---------------|------------------|
| `user.created` | New user signs up | Create User doc in MongoDB |
| `user.updated` | User changes name/email/avatar | Update User doc in MongoDB |
| `user.deleted` | User deletes account | Delete User + UserSettings from MongoDB |

### Other Events (not relevant to PrepAI now)

- `session.created` — User starts a new session
- `session.ended` — User logs out
- `email.created` — Verification email sent
- `permission.created` — Role changed

---

## 5. The Problem Webhooks Solve in PrepAI

### Without Webhooks (the bad way)

```
User signs up on Clerk
        │
        ▼
User's first API call to PrepAI backend
        │
        ▼
Backend checks: "Does this user exist in MongoDB?"
        │
        ├── No → Create user (slow first request)
        │
        └── Yes → Continue
```

**Problems:**
- First API call is slow (needs to create user)
- Every protected endpoint needs "user not found → create" fallback logic
- Race condition: what if two requests come at the same time?

### With Webhooks (the right way)

```
User signs up on Clerk
        │
        ├──> Clerk sends webhook to your backend
        │         │
        │         ▼
        │    Backend creates User in MongoDB
        │    (happens immediately, in background)
        │
        ▼
User's first API call to PrepAI backend
        │
        ▼
Backend: "User exists in MongoDB" ✓
        │
        ▼
Fast response, no fallback needed
```

**Benefits:**
- User record exists before any API call needs it
- No "lazy create" logic in every endpoint
- Clerk handles retries if your server is down
- Clean separation: Clerk does auth, your server does business logic

---

## 6. Flow Diagram

### Complete Signup Flow with Webhook

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│  User    │         │  Clerk   │         │  Clerk   │         │  Your    │
│          │         │  Frontend│         │  Server  │         │  Backend │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │                    │
     │  1. Click "Sign Up"│                    │                    │
     │───────────────────>│                    │                    │
     │                    │                    │                    │
     │  2. Enter details  │                    │                    │
     │───────────────────>│                    │                    │
     │                    │                    │                    │
     │                    │  3. Create user    │                    │
     │                    │───────────────────>│                    │
     │                    │                    │                    │
     │                    │                    │  4. Webhook:       │
     │                    │                    │     user.created   │
     │                    │                    │───────────────────>│
     │                    │                    │                    │
     │                    │                    │                    │  5. Create
     │                    │                    │                    │     User in
     │                    │                    │                    │     MongoDB
     │                    │                    │                    │
     │                    │                    │  6. 200 OK         │
     │                    │                    │<───────────────────│
     │                    │                    │                    │
     │  7. Return JWT     │                    │                    │
     │<───────────────────│                    │                    │
     │                    │                    │                    │
     │  8. API call + JWT │                    │                    │
     │───────────────────────────────────────────────────────────>│
     │                    │                    │                    │
     │                    │                    │                    │  9. Verify
     │                    │                    │                    │     JWT,
     │                    │                    │                    │     find User
     │                    │                    │                    │
     │  10. Response      │                    │                    │
     │<───────────────────────────────────────────────────────────│
```

---

## 7. Webhook Signature Verification

### Why Verify?

Anyone can send a POST request to your webhook endpoint. You need to verify it's actually Clerk sending it, not a hacker.

### How It Works

Clerk signs every webhook with a **secret key**. Your server uses the same key to verify the signature.

```
Clerk sends:
  POST /webhooks/clerk
  Headers: {
    "svix-id": "msg_xxx",
    "svix-timestamp": "1719628800",
    "svix-signature": "v1,abc123..."
  }
  Body: { "type": "user.created", "data": {...} }

Your server:
  1. Takes the raw body
  2. Takes svix-id + svix-timestamp + body
  3. Computes HMAC-SHA256 with your webhook secret
  4. Compares with svix-signature
  5. Match = valid Clerk webhook
  6. No match = reject (someone is faking it)
```

### In Code (NestJS)

```typescript
import { Webhook } from 'svix';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
const wh = new Webhook(webhookSecret);

try {
  const verified = wh.verify(rawBody, {
    'svix-id': headers['svix-id'],
    'svix-timestamp': headers['svix-timestamp'],
    'svix-signature': headers['svix-signature'],
  });
  // verified is the event data — safe to process
} catch (err) {
  // Invalid signature — reject the request
  throw new UnauthorizedException('Invalid webhook signature');
}
```

---

## 8. PrepAI Implementation Plan

### Webhook Endpoint

```
POST /api/v1/webhooks/clerk
```

### What It Handles

| Event | MongoDB Action |
|-------|----------------|
| `user.created` | Create User doc (clerkUserId, email, name, avatarUrl, role=USER, isNewUser=true) |
| `user.updated` | Update email, name, avatarUrl if changed |
| `user.deleted` | Delete User doc + UserSettings doc |

### What Comes in the Payload

```json
{
  "type": "user.created",
  "data": {
    "id": "user_abc123",
    "email_addresses": [
      { "email_address": "john@gmail.com", "id": "email_123" }
    ],
    "first_name": "John",
    "last_name": "Doe",
    "image_url": "https://lh3.googleusercontent.com/..."
  }
}
```

### What We Extract

| Clerk Field | MongoDB Field |
|-------------|---------------|
| `data.id` | `clerkUserId` |
| `data.email_addresses[0].email_address` | `email` |
| `data.first_name + data.last_name` | `name` |
| `data.image_url` | `avatarUrl` |

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│  CONCEPT           │  WHAT IT IS                           │
├─────────────────────────────────────────────────────────────┤
│  Webhook           │  Push notification from one server    │
│                    │  to another when something happens    │
│                                                             │
│  Clerk Webhook     │  Clerk tells your backend when users  │
│                    │  sign up, update profile, or delete   │
│                    │  accounts                             │
│                                                             │
│  Why use it?       │  User record exists before any API    │
│                    │  call needs it. No lazy-create logic. │
│                                                             │
│  Security          │  Verify webhook signature (svix) to   │
│                    │  ensure it's really Clerk sending it  │
└─────────────────────────────────────────────────────────────┘
```
