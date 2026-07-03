# PrepAI — Design Decisions (Phase 2)

This document tracks all design decisions made during the authentication and user model implementation phase.

---

## Authentication — Provider Selection

### Decision

Support 4 login providers in PrepAI.

### Providers

| #   | Provider         | Type       | Source    |
| --- | ---------------- | ---------- | --------- |
| 1   | Email + Password | Primary    | Clerk SDK |
| 2   | Google OAuth     | Social SSO | Clerk SDK |
| 3   | GitHub OAuth     | Social SSO | Clerk SDK |
| 4   | LinkedIn OAuth   | Social SSO | Clerk SDK |

### Discussion

DECISIONS-1.md originally listed all 4 providers. However, the `prepai-ui.html` prototype only had Google and GitHub buttons in the auth screen — LinkedIn was documented but never implemented.

**Resolution:** LinkedIn button was added to the prototype to match the documented plan. All 4 providers will be enabled in the Clerk dashboard during backend implementation.

### Why These 4

- **Email + Password** — baseline, required for users without social accounts
- **Google** — largest OAuth provider, most common SSO choice
- **GitHub** — target audience is software engineers, most already have GitHub accounts
- **LinkedIn** — professional network, relevant for job-seekers using an interview prep tool

### Clerk Setup Requirements

Each provider requires:

1. Enable provider in Clerk Dashboard → Authentication → Social Connections
2. Configure OAuth app credentials (Client ID + Secret) with each provider
3. Set callback URLs in each OAuth app to point to Clerk

---

## User Model — Database Choice

### Decision

User model lives in **MongoDB**.

### Why MongoDB

1. **Architecture consistency** — DECISIONS-1.md already established: MongoDB for content & user data (flexible, document-like), PostgreSQL for transactional data (PracticeSession, Answer).

2. **Clerk is the auth boundary** — The User model never does auth checks. Clerk's JWT middleware verifies tokens. The User model is a profile store, not an auth model. MongoDB fits this role.

3. **Preferences are nested and variable** — The Settings page has profile, practice preferences, and notification toggles. In MongoDB this is a clean nested structure. In PostgreSQL it becomes nullable columns or a JSONB blob.

4. **Relationship with PracticeSession is one-way** — PracticeSession (PostgreSQL) stores `userId` as a string reference. It never needs to JOIN back to User. A string FK works fine.

5. **Flexible schema evolution** — As new settings are added (e.g., new notification types, new preference fields), MongoDB handles this without migrations.

---

## User Model — Single Document vs Multiple Collections

### Options Considered

#### Option A: Everything in One User Document

All fields (identity, profile, preferences, notifications) in a single document.

- **Pro:** Single query returns everything. No joins.
- **Con:** Document grows as settings are added. Sidebar reads carry unnecessary preference fields. Settings writes update the entire document.

#### Option B: Core User + Separate UserSettings Collection

Two collections with a reference (`UserSettings.userId → User`).

- **Pro:** Sidebar reads only `User` (fast, lean). Settings page reads only `UserSettings` (no noise). Each collection has a single responsibility. Settings evolve freely without touching core identity.
- **Con:** Two queries when both are needed. Reference integrity to manage.

#### Option C: Core User + Embedded Settings Sub-document

Single collection with a `settings` nested object.

- **Pro:** Single query. Logical grouping.
- **Con:** Settings writes update the entire User document. Document still grows.

### Decision

**Option B — Two separate collections (User + UserSettings)**

### Why Option B

1. **Different access patterns.** Sidebar and role checks need `clerkUserId + name + role` (3 fields). Settings page needs profile + preferences + notifications (15+ fields). These are fundamentally different reads.

2. **Clerk webhook creates the User record.** When someone signs up, the webhook fires with Clerk's payload (ID, email, name, avatar). We create the lean User doc. No settings yet — collected later. If settings were embedded, the document would have 12+ null fields.

3. **Settings are write-heavy.** Every notification toggle or practice preference change writes to settings. With a separate collection, only `UserSettings` is updated, not the entire User document.

4. **Clean separation of concerns.** Identity never mixes with preferences. Each collection does one thing.

---

## User Model — Field Definitions

### User Collection (MongoDB)

```
User
├── clerkUserId     String    (unique, indexed)    — auth bridge to Clerk
├── email           String    — cached from Clerk
├── name            String    — cached from Clerk
├── avatarUrl       String?   — cached from Clerk (Google/GitHub avatar)
├── role            Enum      — USER | PREMIUM | ADMIN (default: USER)
├── isNewUser       Boolean   — controls welcome banner + setup flow (default: true)
├── createdAt       DateTime
└── updatedAt       DateTime
```

### Why These Fields

| Field         | Purpose                                                                 | Source                              |
| ------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `clerkUserId` | Links to Clerk auth record. Used in all API calls to identify the user. | Clerk webhook payload               |
| `email`       | Display in UI, avoid Clerk API calls for common reads.                  | Clerk webhook payload               |
| `name`        | Display in sidebar, dashboard greeting.                                 | Clerk webhook payload               |
| `avatarUrl`   | Profile picture in sidebar and user menu.                               | Clerk webhook payload               |
| `role`        | Determines daily limits (sessions, coding problems, AI reviews).        | Default USER, updated on payment    |
| `isNewUser`   | Shows setup flow on first login, welcome banner on dashboard.           | true on creation, false after setup |

### Fields NOT on User (and Why)

| Field                              | Where It Lives                                                          | Reason                                      |
| ---------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| Target role, experience, companies | `UserSettings.profile`                                                  | Settings API module, collected after signup |
| Practice preferences               | `UserSettings.preferences`                                              | Settings API module, collected after signup |
| Notification toggles               | `UserSettings.notifications`                                            | Settings API module, collected after signup |
| Solved coding problems             | localStorage (prototype) → separate `SolvedProblem` collection (future) | Grows indefinitely, needs per-day queries   |
| Weak areas                         | Computed from PracticeSession scores                                    | Never stored, always derived                |
| Preferred topics                   | `UserSettings.preferences.preferredTopics`                              | Part of settings, not core identity         |

### UserSettings Collection (MongoDB)

```
UserSettings
├── userId            String    (unique, ref → User)
├── profile
│   ├── targetRole       Enum?   — Frontend | FullStack | Backend | DevOps | EngManager
│   ├── experienceLevel  Enum?   — Junior | Mid | Senior
│   └── targetCompanies  String[]
├── preferences
│   ├── defaultDifficulty  Enum   — Junior | Mid | Senior | Mixed (default: Mixed)
│   ├── sessionLength      Number — (default: 10)
│   ├── timerPerQuestion   Number — seconds, 0 = no timer (default: 300)
│   ├── preferredTopics    String[]
│   ├── showHintsOnSkip    Boolean — (default: true)
│   └── autoAdvance        Boolean — (default: false)
├── notifications
│   ├── dailyReminder      Boolean — (default: true)
│   ├── weeklyReport       Boolean — (default: true)
│   ├── newQuestionsAlert   Boolean — (default: false)
│   ├── streakAlerts       Boolean — (default: true)
│   └── emailDigest        Boolean — (default: false)
├── createdAt            DateTime
└── updatedAt            DateTime
```

---

## Post-Signup Data Collection Flow

### Decision

Use a 3-step setup wizard shown after first login, with a "Skip for now" option.

### Flow

```
User signs up via Clerk (Google/GitHub/LinkedIn/Email)
        │
        ▼
Clerk fires webhook: user.created
        │
        ▼
Backend creates User document (clerkUserId, email, name, avatarUrl, role=USER, isNewUser=true)
        │
        ▼
User logs in for the first time
        │
        ▼
doAuth() checks isNewUser === true
        │
        ├──→ Setup Screen (3 steps)
        │     Step 1: Target Role + Experience Level (required)
        │     Step 2: Target Companies (optional)
        │     Step 3: Preferred Topics + Default Difficulty
        │     Each step has "Skip for now" link
        │
        ▼
setupFinish() saves to localStorage('prepai_setup')
Sets isNewUser = false
        │
        ▼
Dashboard (with welcome banner if isNewUser was true)
```

### Why localStorage in Prototype

In the prototype, setup data goes to `localStorage('prepai_setup')` and `isNewUser` persists via `localStorage('prepai_new_user')`. This is temporary — in production:

- `isNewUser` lives on the User document in MongoDB
- Setup data goes to `UserSettings` via `POST /api/v1/user/settings`
- Clerk webhook creates the User, first API call creates UserSettings

### Setup Wizard Design

- **3 steps** with progress dots and connecting lines
- **Step 1 (required):** Target Role dropdown + Experience Level dropdown — validates both are selected before proceeding
- **Step 2 (optional):** Target Companies text input — can be left blank
- **Step 3 (optional):** Preferred Topics as clickable pills (9 topics) + Default Difficulty dropdown
- **"Skip for now"** link on every step — skips entire setup, defaults apply
- **"Start Practicing"** button on Step 3 — saves data and enters app
- **Back button** on Steps 2 and 3 — returns to previous step

### HTML Changes Made

A new `<div id="scr-setup">` screen was added to `prepai-ui.html` between the auth screen and the app screen. This includes:

1. Setup card with brand, title, subtitle
2. Progress indicator (3 dots + lines)
3. Step 1: Role + Experience form
4. Step 2: Companies input
5. Step 3: Topics pills + Difficulty dropdown

### CSS Changes Made

New `.setup-*` styles added after existing auth styles:

- `#scr-setup` — full-screen flex centering with background glow
- `.setup-card` — card container matching auth card dimensions
- `.setup-progress` / `.setup-step-dot` / `.setup-step-line` — progress indicator
- `.setup-step` — step container with active/hidden states
- `.setup-field` — form fields matching auth field styles
- `.setup-topics` / `.setup-topic` — clickable topic pills
- `.setup-actions` / `.setup-skip` — navigation buttons

### JavaScript Changes Made

1. **`go()` function** — added `'setup'` view handling (shows/hides `#scr-setup`)
2. **`doAuth()` function** — checks `isNewUser`, routes to setup screen instead of app for new users
3. **New functions added:**
   - `resetSetup()` — resets all form fields and progress indicators
   - `setupNext(from)` — validates Step 1, advances to next step
   - `setupBack(from)` — returns to previous step
   - `showSetupStep(n)` — updates active step, progress dots, and lines
   - `setupFinish()` — saves data to localStorage, sets isNewUser=false, enters app
   - `setupSkip()` — sets isNewUser=false, enters app without saving
4. **`isNewUser` initialization** — changed from `true` to `localStorage.getItem('prepai_new_user')!=='false'` for persistence across reloads
5. **`dismissBanner()`** — updated to also persist isNewUser=false to localStorage

### No Existing Code Removed

All changes were additive. The only modifications to existing code were:

- `go()` — one line added for setup screen
- `doAuth()` — wrapped the `go('app')` call in an if/else for isNewUser check
- `isNewUser` initialization — changed to read from localStorage
- `dismissBanner()` — added localStorage persistence

---

## Clerk Role Management

### Decision

Keep `role` in MongoDB only. Do NOT sync to Clerk's publicMetadata.

### Why

Clerk has a `publicMetadata` field that travels in the JWT. Storing role there would mean the frontend can check role without a DB call. However:

- **Dual source of truth** — role in Clerk metadata + MongoDB creates sync headaches (what if one updates and the other doesn't?)
- **Simpler to keep one source** — MongoDB is authoritative for role. The backend reads it on protected requests via middleware.
- **Role changes are infrequent** — only changes on payment (USER → PREMIUM) or admin action. Not worth the sync complexity.

### Role-Based Limits (from DECISIONS-1.md, unchanged)

|                         | Free (USER) | Premium / Admin |
| ----------------------- | ----------- | --------------- |
| Daily practice sessions | 3           | Unlimited       |
| Questions per session   | 10          | 30              |
| Problems solved per day | 5           | Unlimited       |
| AI Review calls per day | 3           | Unlimited       |

---

## Clerk Webhook Strategy

### Decision

Use Clerk webhooks (`user.created`, `user.updated`, `user.deleted`) to keep MongoDB in sync.

### Why Not Lazy Create

- **Lazy create** (check on first API call) means the first request is slower and every protected endpoint needs a "user not found → create" fallback path.
- **Webhook** ensures the User document exists before any API call needs it. Clerk handles retries. It's the standard pattern.

### Webhook Endpoint

- Route: `POST /api/v1/webhooks/clerk`
- Verifies Clerk's webhook signature (svix)
- Handles events: `user.created`, `user.updated`, `user.deleted`
- Creates/updates/deletes the MongoDB User document

### What Comes From the Webhook

| Clerk Event    | MongoDB Action                                                                      |
| -------------- | ----------------------------------------------------------------------------------- |
| `user.created` | Create User doc with clerkUserId, email, name, avatarUrl, role=USER, isNewUser=true |
| `user.updated` | Update email, name, avatarUrl if changed                                            |
| `user.deleted` | Delete User doc and associated UserSettings                                         |

---

## Discussion: Solved Problems Storage

### Status: Deferred to future implementation

In the prototype, solved coding problems are stored in `localStorage('prepai_solved')` as an array of problem indices. For production, two options were discussed:

#### Option A: On User Document

Add `solvedProblems: Number[]` to the User document.

- **Pro:** Simple, fast reads
- **Con:** Array grows indefinitely, bloats the User document

#### Option B: Separate Collection

Each solved problem is a document: `{ userId, problemIndex, solvedAt }`.

- **Pro:** Clean queries ("problems solved per day"), scalable, supports analytics
- **Con:** Separate query needed

**Leaning toward Option B** for scalability and analytics capability, but implementation is deferred until the Coding module backend is built.

---

## Summary of Changes Made

| File                       | Change                                                    |
| -------------------------- | --------------------------------------------------------- |
| `prepai-ui.html`           | Added LinkedIn button to auth screen                      |
| `prepai-ui.html`           | Added setup screen CSS (`.setup-*` styles)                |
| `prepai-ui.html`           | Added setup screen HTML (`#scr-setup` with 3-step wizard) |
| `prepai-ui.html`           | Modified `go()` to handle setup view                      |
| `prepai-ui.html`           | Modified `doAuth()` to route new users to setup           |
| `prepai-ui.html`           | Added setup navigation functions                          |
| `prepai-ui.html`           | Changed `isNewUser` to persist via localStorage           |
| `Decisions/DECISIONS-1.md` | Moved from root to Decisions folder                       |
| `Decisions/DECISIONS-2.md` | Created with Phase 2 design decisions                     |
