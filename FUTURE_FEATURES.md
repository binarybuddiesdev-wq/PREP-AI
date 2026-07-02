# PrepAI — Future Features

Features that are **planned but not implemented in the initial build**. These are stored here so we can revisit them later without cluttering the core design.

---

## Company-Specific Question Generation

**Status**: Not in v1
**Where**: AI question generation pipeline

### What
Use `targetCompanies` from the user's profile to tailor questions to specific companies' known interview patterns.

### How it would work
- User sets target companies (e.g., Google, Meta, Stripe) in Profile
- AI receives this context in its prompt
- Questions are biased toward what those companies are known to ask:
  - **Google** → Heavy DSA, system design, algorithms
  - **Meta** → React deep dives, system design at scale
  - **Stripe** → Payment systems, API design, reliability
  - **Startups** → Practical full-stack, shipping speed questions

### Current behavior
- `targetCompanies` is stored in the User profile
- AI does NOT use it for question generation yet
- Just a metadata field for future use

### When to enable
When the question bank grows large enough to support company-specific filtering, or when we add a "Company" filter to the Question Bank screen.

---

## Bookmarks / Saved Questions

**Status**: Not in v1
**Where**: Practice + Coding sections, dedicated Bookmarks page

### What
Users can save specific questions they want to revisit — got wrong, found tricky, want to retry later.

### How it would work
- Bookmark button on each question (Practice feedback card + Coding problem cards)
- Dedicated Bookmarks page in sidebar to view all saved questions
- Filter by topic, difficulty, solved/unsolved
- Remove bookmarks when no longer needed

### Current behavior
- No bookmark functionality yet
- Questions are gone after session ends — no way to revisit specific ones

### When to enable
When the question bank grows large enough that users need a way to curate their own study list.

---

## Premium / Paid Tier

**Status**: Not in v1
**Where**: Billing, feature gating

### What
Restrict certain features behind a paywall:
- Unlimited practice sessions (free tier: X per day)
- Advanced AI feedback (detailed complexity analysis)
- Priority access to new topics
- Company-specific question generation

### Current behavior
- `role` field exists on User (USER / PREMIUM / ADMIN)
- Mock Razorpay checkout flow implemented (UPI, Card, Netbanking, Wallet)
- Role changes to PREMIUM on successful mock payment
- Real Razorpay integration needed for production (server-side order creation, webhook handling, signature verification)

---

## Beta Feature Flags

**Status**: Not in v1
**Where**: Backend feature gating

### What
Roll out new features to select users before public launch.

### How it would work
- `role === "PREMIUM"` users can be marked as beta testers
- A separate `betaTester` Boolean field on User if needed
- Backend checks this flag before enabling experimental features

### Current behavior
- No beta flag on User model yet
- Add when we have features worth testing with a subset of users
