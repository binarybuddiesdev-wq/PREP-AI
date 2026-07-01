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

## Remaining Discussion Topics
- [x] Notifications — real push or in-app only? → In-app + Email (Resend)
