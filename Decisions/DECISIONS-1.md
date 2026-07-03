# PrepAI — Design Decisions

This document tracks all design decisions made during the planning phase.

---

## Authentication

### Providers
| # | Provider | Type |
|---|---|---|
| 1 | Email + Password | Primary |
| 2 | Google OAuth | Social SSO |
| 3 | GitHub OAuth | Social SSO |
| 4 | LinkedIn OAuth | Social SSO |

### Clerk Setup
- **SDK**: `@clerk/clerk-sdk-node` v5.1.6
- **Env vars**:
  - `CLERK_SECRET_KEY` — backend only (token verification)
  - `VITE_CLERK_PUBLISHABLE_KEY` — frontend only (Clerk SDK init)
- **Guard**: `ClerkAuthGuard` in `server/src/common/guards/clerk-auth.guard.ts`
- **Decorators**: `@Public()`, `@CurrentUser()`, `@Roles()`
- **Account Linking**: Handled automatically by Clerk (same email across providers = same account)

### Account Linking Rules
- Same email verified on both providers → auto-links
- Different emails → separate accounts
- User can connect/disconnect providers from profile settings

---

## Database Architecture

### Dual-DB Setup
| Database | Purpose | Models |
|---|---|---|
| **MongoDB** | Content & user data (flexible, document-like) | User, Topic, Question, ChatMessage, PdfSource |
| **PostgreSQL** | Transactional data (relational, needs joins) | PracticeSession, Answer |

### ORM
- Prisma v6.19.0
- Separate schemas: `schema.prisma` (MongoDB), `schema.postgresql.prisma` (PostgreSQL)

---

## PDF Feature

### Two Types of PDFs
1. **Pre-loaded PDFs** — shipped with the app, stored in codebase at `server/assets/pdfs/`
2. **User-uploaded PDFs** — uploaded by users, stored on Cloudinary

### Storage: Cloudinary
- **Free tier**: 25 GB storage, 25 GB bandwidth/month
- **Env vars**:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`

### PDF Isolation
- Each user sees only their own uploaded PDFs
- Filtered by `userId` in database queries
- Pre-loaded PDFs visible to all users

### PDF as Question Sources
- Each PDF has an `isActive` toggle
- Enabled PDFs are used by AI for question generation
- Disabled PDFs are ignored during generation

### PdfSource Model Fields
| Field | Type | Purpose |
|---|---|---|
| `id` | String | Unique identifier |
| `name` | String | Original filename |
| `fileUrl` | String | Cloudinary URL or local path |
| `fileSize` | Number | Size in bytes |
| `pageCount` | Number | Number of pages |
| `sourceType` | Enum | `PRELOADED` or `USER_UPLOADED` |
| `userId` | String? | Owner (null for pre-loaded) |
| `isActive` | Boolean | Toggle for question generation |
| `createdAt` | DateTime | Upload timestamp |
| `updatedAt` | DateTime | Last modified |

---

## Features (from UI reference)

### Core Features
1. **Landing Page** — Marketing, features, testimonials, CTA
2. **Authentication** — Email+Password, Google, GitHub, LinkedIn
3. **Dashboard** — KPIs, recent sessions, streak, score trend, weak areas
4. **Practice Session** — Topic/difficulty selection, timer, AI feedback (0-10 score)
5. **Question Bank** — Browse, filter, search, paginate questions
6. **Coding** — Monaco editor, JS/TS/Python, run/submit, test cases
7. **History** — Session history with expandable Q&A details, export CSV
8. **Settings** — Profile, notifications, practice preferences, AI sources, documents, danger zone
9. **Library** — PDF viewer with zoom, fullscreen, bulk delete
10. **Chatbot** — Floating AI chat bubble
11. **Notifications** — In-app notification dropdown
12. **Global Search** — Search across topics, questions, settings
13. **Theme Toggle** — Dark/Light mode

### Practice Session Flow
1. User picks topic (React, NestJS, TypeScript, System Design, DSA, Node.js)
2. User picks difficulty (Junior, Mid, Senior)
3. Session starts with timer
4. User answers questions one by one
5. AI evaluates each answer → score (0-10) + feedback
6. Session ends → results saved to history

### Settings Tabs
- **Profile**: Name, email, target role, experience level, target companies
- **Notifications**: Daily reminder, weekly report, new questions, streak alerts, email digest
- **Practice Preferences**: Default difficulty, session length, timer, preferred topics, hints, auto-advance
- **AI & Sources**: Model info, PDF source toggle, web search toggle
- **Documents**: Upload PDFs
- **Danger Zone**: Reset progress, delete account, export data

---

## Coding Feature

### Code Execution Engine
- **Engine**: Piston (self-hosted via Podman)
- **Why Piston**: Free, open-source, extensible (add more languages later without changing architecture)
- **Hosting**: Local Podman container on developer desktop
- **Languages**: JavaScript (Node.js 20.11.1), TypeScript (5.0.3), Python (3.12.0)
- **Endpoint**: `http://127.0.0.1:2000/api/v2/execute`
- **Container**: `piston_api` with custom entrypoint for Windows/Podman cgroup compatibility

### Coding Problems
- **Source**: Pre-seeded with extensive problem bank (we will provide as many as possible)
- **Categories**: Arrays, Strings, Trees, Graphs, Dynamic Programming, Two Pointers
- **Difficulty levels**: Easy, Medium, Hard
- **Test cases**: Each problem has predefined test cases for validation
- **Execution flow**: User writes code → runs against test cases → AI reviews submission

### Code Execution Flow
1. User selects a coding problem
2. User writes solution in chosen language (JS/TS/Python)
3. Code is sent to Piston API for execution
4. Results compared against predefined test cases
5. Pass/fail status shown to user
6. AI provides review: time/space complexity, edge cases, code quality, suggestions

### Piston Management
- `pnpm piston:start` — boot container
- `pnpm piston:setup` — install runtimes
- `pnpm piston:status` — check container status
- `pnpm piston:stop` — remove container
- Custom entrypoint (`piston-entrypoint.sh`) handles Windows/Podman cgroup compatibility
- Named volume `piston_data` persists installed runtimes

---

## Chatbot

### Approach
- **Memory**: Session-based (no persistent chat history)
- **Why**: Simpler, cheaper (smaller prompts to NVIDIA NIM), privacy-friendly, no stale context issues
- **Each chat open = fresh start**, no reference to previous conversations
- **Context-aware**: Can still pull user's current weak areas and recent session data from database

### Capabilities
- Answer coding/interview questions on the fly
- Explain concepts (closures, hooks, system design patterns, etc.)
- Platform navigation help
- Post-answer follow-up (elaborate on AI feedback from practice sessions)

### AI Agent
- **Agent**: `techExpertAgent` (Mastra framework)
- **Model**: `nvidia/llama-3.3-nemotron-super-49b-v1.5` via NVIDIA NIM
- **System prompt**: Covers programming languages, frameworks, cloud, databases, AI/ML, architecture, security, mobile, Web3

### Schema
- `ChatMessage` model exists in Prisma schema but will NOT be used for chatbot
- Kept for potential future use or removed — decision deferred

---

## Mastra Core Concepts in PrepAI

All 5 Mastra pillars must be represented in the project:

| Concept | Implementation in PrepAI |
|---------|------------------------|
| **Agents** | `techExpertAgent` — chatbot AI agent |
| **Tools** | Piston (code execution), PDF parser, web search toggle |
| **Workflow** | Practice session flow: generate Q → user answers → AI evaluates → save to history |
| **Memory** | Adaptive learning — AI tracks weak areas across sessions to personalize future questions |
| **RAG** | PDF-based question generation — retrieve content from uploaded PDFs to generate contextual questions |

### Memory (Adaptive Learning System)
- **NOT used in chatbot** — used in practice/learning system instead
- Tracks user's weak areas across sessions (e.g., "struggles with useEffect/useMemo")
- AI generates more questions on weak topics or adjusts difficulty gradually
- Powers the "Weak Areas" section on dashboard (DSA 45%, System Design 62%, etc.)
- Builds a learner profile over time for personalized question generation

### RAG (PDF-based Question Generation)
- User uploads PDFs (e.g., React fundamentals)
- RAG retrieves relevant content from PDFs
- AI generates questions based on specific PDF content
- `isActive` toggle on PdfSource controls which PDFs are used for generation

---

## Notifications

### Channels
| Channel | Use Case |
|---------|----------|
| **In-app** | Session complete, streak milestones, new questions added |
| **Email** | Daily practice reminders, weekly progress reports, email digest |

### Why NOT Browser Push
- Users often dismiss or block push notifications
- Adds service worker complexity
- Feels intrusive for a study tool
- Email is more professional and less spammy

### Email Service
- **Provider**: Resend
- **Why**: Simple integration with NestJS, modern API, generous free tier
- **Free tier**: 100 emails/day
- **Integration**: NestJS module using Resend SDK

### Notification Types
| Type | Channel | Timing |
|------|---------|--------|
| Session complete | In-app | Immediate |
| Streak milestone | In-app | Immediate (7, 14, 30 days) |
| New questions added | In-app | When new questions arrive |
| Daily practice reminder | Email | 7 PM daily (configurable) |
| Weekly progress report | Email | Sunday evening |
| Email digest | Email | Weekly |

### Settings (from UI)
- Daily Practice Reminder — toggle on/off
- Weekly Progress Report — toggle on/off
- New Questions Alert — toggle on/off
- Streak Milestone Alerts — toggle on/off
- Email Digest — toggle on/off

---

## User Roles

### Decision
Add a simple `role` field to the User model now with `USER` as default and `ADMIN` as the only other option. No over-engineering.

### Why
Not needed for the current feature set (no admin panel, no gated features), but costs nothing to add and avoids a future migration. The field becomes useful when any of these scenarios emerge:

| Future Scenario | How Role Helps |
|-----------------|---------------|
| **Admin Panel** | `role === "ADMIN"` guard on admin routes for managing questions, topics, PDFs |
| **Premium Tier** | `role === "PREMIUM"` to bypass session limits or unlock features for free users |
| **Content Moderation** | Moderator role for reviewing community-submitted content |
| **Beta Access** | `role === "BETA"` to gate new features to select users before public rollout |

### Enum Values (3 roles)
```
enum UserRole {
  USER     // default for all new signups
  PREMIUM  // paid users + beta testers (elevated access)
  ADMIN    // full backend access for managing content
}
```

### Why PREMIUM covers both beta and paid
Beta (temporary testing) and Premium (permanent paid) are conceptually different, but at the DB level they serve the same purpose — this user gets more than a free USER. The actual differentiation (which beta features vs which premium features) is handled by **feature flags** on the backend, not by roles. If we ever need to distinguish beta testers from paying customers, a separate `betaTester` Boolean can be added later.

### What NOT to do
- No 5+ roles (SUPER_ADMIN, MODERATOR, etc.) — premature
- No admin UI until actually needed
- No Clerk role system integration yet — just a DB field

---

## Practice Session Flow

### Decision
3 practice modes — no "Full Mix" mode. All 3 implemented in v1.

### Topics (Practice Section)
9 topics for theory-based practice questions:
1. React
2. TypeScript
3. HTML
4. CSS
5. Node.js
6. ExpressJS
7. NestJS
8. MongoDB
9. System Design

DSA is NOT in Practice — it lives in the Coding section (requires code editor, not text answers). More topics can be added later.

### Pre-Seeded Question Target
9 topics × 3 difficulty levels × ~60 questions each = **~540 questions**
Hits the "500+" promise on the landing page.

### Modes

| # | Mode | What it does | User selects |
|---|------|-------------|-------------|
| 1 | **Topic Practice** | Pick topic(s), get questions from pre-seeded bank | Topic(s), difficulty |
| 2 | **Weak Areas** | AI picks topics where user scores lowest | Difficulty, confirm weak areas |
| 3 | **PDF Study** | Questions generated from uploaded PDFs via RAG | Which PDFs, difficulty |

### Flow (all modes)

1. **Mode Selection** — 3 cards at top of Practice screen (single pick)
2. **Configuration** — depends on mode (see table above)
3. **Session Config** — timer per question, hints on skip (question count is role-based, not user-selected)
4. **Start** — summary card showing all selections before starting

### Why NOT "Full Mix"
- Overlaps with Weak Areas (both use AI to decide topics)
- Confusing UX — user doesn't know what they're practicing or why
- User can achieve a "mix" by multi-selecting topics in Topic Practice mode

### PDF Source Selection
- PDF selection lives ONLY in PDF Study mode
- NOT available in Topic Practice — keeps it clean (pre-seeded questions only)
- NOT available in Weak Areas — AI decides topics based on scores, not PDFs

### AI Roles Across Modes

AI has two jobs in PrepAI: **question generation** and **answer evaluation**.

| Mode | Question Source | AI Generates Questions? | AI Evaluates Answers? |
|------|----------------|------------------------|----------------------|
| **Topic Practice** | Pre-seeded question bank (hardcoded in DB) | No | Yes |
| **Weak Areas** | AI generates based on user's weak topics | Yes | Yes |
| **PDF Study** | AI generates via RAG from uploaded PDFs | Yes | Yes |

**Topic Practice** — Questions come from the pre-seeded bank. User picks topic + difficulty → questions are pulled from the bank. No AI generation. AI only evaluates the user's answer (score 0-10 + feedback). Why: pre-seeded questions load instantly, guaranteed quality, no waiting.

**Weak Areas** — System analyzes user's past session scores, identifies topics below 70%, then AI generates questions targeting those weak spots. Questions can be new (not in the pre-seeded bank). AI both generates and evaluates.

**PDF Study** — User selects uploaded PDFs. System retrieves relevant content via RAG. AI generates questions based on that PDF content. Questions are tied to the user's specific material. AI both generates (RAG) and evaluates.

### Role-Based Limits

#### Practice Section
| | Free (USER) | Premium / Admin |
|--|-------------|-----------------|
| **Daily practice sessions** | 3 per day | Unlimited |
| **Questions per session** | 10 | 30 |
| **Pre-seeded (Topic Practice)** | All available | All available |
| **AI-generated (Weak Areas / PDF Study)** | 10 max | 30 max |

Pre-seeded questions have no limit — they're already in the DB, zero cost to serve. AI-generated questions are capped because each question costs NVIDIA NIM API calls. Free users get a taste, premium users get the full experience. Hitting the cap mid-session is a natural upgrade prompt.

#### Coding Section
| | Free (USER) | Premium / Admin |
|--|-------------|-----------------|
| **Problems solved per day** | 5 | Unlimited |
| **AI Review calls per day** | 3 | Unlimited |
| **Submissions per day** | Unlimited | Unlimited |

AI Review calls cost NVIDIA NIM API credits. Capping at 3/day for free users creates upgrade incentive. Submissions are unlimited — the value is in solving, not the submission count.

### Dev-Only Role Selector (NOT in production)
- Login screen has a role dropdown (Normal User / Premium / Admin) for development testing
- In production, role is determined by the logged-in user's Clerk permissions
- Stored in localStorage as `prepai_role` for prototype testing
- Dashboard shows remaining sessions based on role
- Session limit enforced: free users get "Daily Session Limit Reached" overlay after 3 sessions

### Session Flow (Active Session)
- When session starts: config UI (mode cards, topic pills, difficulty, session config) is hidden
- Only question card and feedback card are visible during active session
- Remaining sessions bar shown before session starts, hidden during session
- Question counter shows "Q3 of 10" (role-based limit, not total questions in bank)
- When question limit hit: session ends automatically, shows Session Complete card
- Session Complete card shows: questions answered, average score, time taken
- "Back to Practice" returns to config view, "Go to Dashboard" exits

### Session Complete Card
- Shows after all questions answered OR when role-based limit is hit
- Displays: total questions answered, average score (0-10), time taken (minutes)
- Two actions: Back to Practice (reset to config), Go to Dashboard (exit)

---

## Remaining Discussion Topics
- [x] Notifications — real push or in-app only? → In-app + Email (Resend)
- [x] Question Bank section — Removed. Both Question Bank and Practice led to the same Practice screen, creating confusion about which to use. Practice mode already has topic/difficulty selection built in. A separate Question Bank was redundant.

## Coding Section Improvements

### Problem Bank
- Expanded from 10 to 50 problems across 11 topics
- Topics: Arrays, Stacks, Hash Maps, Binary Search, Linked Lists, Trees, Graphs, Dynamic Programming, Two Pointers, Backtracking, Sliding Window
- Difficulty mix: Easy, Medium, Hard

### UI Changes
- Added difficulty filter (Easy/Medium/Hard) alongside topic filter
- Added coding stats bar (Solved, Today x/5, AI Reviews x/3, Day Streak)
- Solved problems show green left border and checkmark badge
- Editor now has 3 buttons: Run (execute), Submit (mark solved), AI Review (show analysis)

### Tracking
- Solved problems stored in localStorage
- Coding streak tracked separately from practice streak
- Daily solved count and AI Review calls tracked in localStorage
- Coding sessions appear in History with purple "Coding" pill
- Dashboard KPI shows "Problems Solved" count

### Daily Limits
- Free users: 5 problems solved/day, 3 AI Review calls/day
- Premium/Admin: unlimited
- Submissions unlimited for all roles
- Stats bar updates immediately after submit or AI review

### AI Review (Mock UI)
- Shows time/space complexity analysis
- Shows code quality feedback
- Shows improvement suggestions
- Verdict: "Already Solved" or "Needs Work"
- Note: This is a mock UI for the prototype. Real AI review will use NVIDIA NIM in production.

---

## Payment & Upgrade Flow

### Payment Provider
- **Razorpay** — India's leading payment gateway
- Supports UPI, Cards (Credit/Debit), Netbanking, Wallets
- Free tier: No transaction fees for first ₹5 lakhs/month

### Pricing
| Plan | Price | What they get |
|------|-------|---------------|
| **Free** | ₹0 | 3 practice sessions/day, 5 coding problems/day, 3 AI Reviews/day |
| **Premium** | ₹299/month or ₹1,999/year | Unlimited everything |
| Yearly discount | ~44% savings | Strong incentive to choose yearly |

### Upgrade Entry Points
- Sidebar "Upgrade to Premium" button (visible for free users)
- Session limit overlay ("Upgrade" CTA when limit hit)
- Settings > Plan tab (shows current plan + upgrade options)
- Coding stats bar (when daily limit reached)

### Payment Flow (per method)
- **UPI**: Select app (GPay/PhonePe/Paytm/BHIM) → QR code + UPI ID input → Pay
- **Card**: Enter card details → 6-digit OTP → Verify → Success
- **Netbanking**: Select bank → Redirect to bank page → Approve → Success
- **Wallet**: Select wallet → Redirect to wallet page → Approve → Success

### Backend Models (PostgreSQL)
- `Payment` model: id, userId, razorpayOrderId, razorpayPaymentId, amount, currency, plan, status, expiresAt, createdAt
- Status flow: PENDING → COMPLETED / REFUNDED

### Env Variables
```
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
```

### Production Implementation
- Razorpay checkout.js for frontend
- Server-side order creation + signature verification
- Webhook for payment events (refund, subscription renewal)
- Role update (USER → PREMIUM) after successful payment verification
