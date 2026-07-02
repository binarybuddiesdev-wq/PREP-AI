# PrepAI

**AI-powered interview preparation platform** that generates adaptive questions, provides real-time feedback, and tracks your progress across sessions.

![Dashboard Preview](./public/dashboard.png)

---

## Overview

PrepAI is a full-stack web application designed to help software engineers prepare for technical interviews. Unlike generic question banks, PrepAI uses AI to generate questions tailored to your specific role, tech stack, and experience level — then scores your answers and maps your weaknesses over time.

The platform covers system design, coding, and domain-specific topics (React, TypeScript, HTML, CSS, Node.js, ExpressJS, NestJS, MongoDB, and more). It includes a built-in code editor, PDF document viewer, performance analytics dashboard, and an AI chat assistant.

---

## Table of Contents

- [Screens](#screens)
- [Features In Detail](#features-in-detail)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Backend API](#backend-api)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [UI Prototype](#ui-prototype)

---

## Screens

The application has the following screens, each accessible via the sidebar navigation:

| Screen | Description |
|--------|-------------|
| Landing | Public marketing page with hero, features, testimonials, CTA |
| Auth | Login/signup with email and social providers |
| Dashboard | KPIs, recent sessions, streak, score chart, weak areas |
| Practice | 3 modes: Topic Practice, Weak Areas, PDF Study with AI feedback |
| Coding | Algorithm problems with Monaco editor, test cases, AI verdict |
| History | Past sessions with expandable Q&A and feedback |
| Settings | Profile, notifications, preferences, AI config, documents |
| Library | PDF viewer with zoom, navigation, fullscreen, bulk delete |
| Chatbot | Floating AI assistant with topic-aware responses |

---

## Features In Detail

### 1. Landing Page

The public-facing marketing page shown to unauthenticated visitors.

- **Navigation bar** with brand logo, feature links (Features, How It Works, Results), theme toggle, login, and "Start Free" CTA
- **Hero section** with animated terminal mockup that simulates a live PrepAI session — shows command input, question display, answer submission, and score output with typing animation
- **Feature grid** (3 cards): Adaptive AI Engine, Line-by-Line Feedback, Weakness Mapping — each with icon, description, and hover effects
- **Testimonials section** (3 cards): Quotes from engineers at Google, Stripe, and Vercel with star ratings, avatars, names, and roles
- **How It Works** (4 steps): Pick Your Stack → Answer Live → Get AI Feedback → Track Growth — connected by a gradient line with numbered dots
- **Big number stats** (4 cards): 500+ Practice Questions, 20+ Topic Categories, 12k+ Sessions Completed, Free / No Credit Card
- **CTA section**: "Stop preparing the hard way" with gradient border and primary button
- **Footer** with copyright, privacy, terms, Twitter, GitHub links
- **Scroll reveal animations** on all sections via IntersectionObserver
- **Hero counter animation** that counts up to target numbers with easing

### 2. Authentication

Login and registration screen with social and email options.

- **Login mode**: Email + password fields, "Sign In" button, "Create one" link to switch to signup
- **Signup mode**: Full name field appears, "Create Account" button, "Sign in" link to switch back
- **Social login**: Google and GitHub buttons with SVG icons
- **Divider**: "OR" separator between social and email forms
- **Form validation**: Required fields, email format
- **Background glow**: Radial gradient behind the auth card
- **Smooth transition** between login and signup modes

### 3. Dashboard

The main hub after login showing progress overview and quick actions.

- **Welcome banner** (new users only): 3-step setup checklist (Choose Topics ✓, Upload PDFs, Set Difficulty) with dismiss button
- **Greeting**: "Good evening, Abhi" with session count for the week
- **KPI row** (4 cards):
  - Sessions Completed (24, +12% trend)
  - Questions Answered (186, +8% trend)
  - Average Score (7.4, +5% trend)
  - Topics Covered (8, -2% trend)
- **Recent sessions table**: Topic, Date, Score (color-coded pill), Status — with "View All" link to History
- **Suggested practice**: Clickable tag chips for weak areas (MongoDB, System Design, ExpressJS)
- **Streak tracker**: 7-day streak with day indicators (M T W T F S S), completed days highlighted in amber, current day solid amber
- **Score trend chart**: SVG line chart showing last 7 session scores with gradient fill, grid lines, date labels, and dot markers
- **Weak areas**: Progress bars for MongoDB (45%), System Design (62%), ExpressJS (68%) — each with color-coded gradient fills

### 4. Practice Sessions

The core interview practice flow with timed questions and AI scoring. 3 practice modes:

- **Mode selector**: 3 cards — Topic Practice, Weak Areas, PDF Study
- **Topic Practice**: Topic pills (multi-select) + difficulty selector. Questions from pre-seeded bank.
- **Weak Areas**: AI picks topics where user scores lowest. Shows current weak area percentages.
- **PDF Study**: Select uploaded PDFs, AI generates questions via RAG.
- **Session config**: Timer per question, hints on skip. Question count is role-based (10 free, 30 premium).
- **Remaining sessions bar**: Shows how many sessions left today (3/day for free, unlimited for premium).
- **Question card** (active session):
  - Question counter ("Q1 of 10" — role-based limit)
  - Timer (MM:SS format, counts up from 00:00)
  - Progress bar showing completion percentage
  - Question text
  - Textarea for answer input
  - Skip and Submit buttons
- **AI feedback card** (after submission):
  - Animated score ring (SVG circle with gradient stroke, animates from 0 to score)
  - Score display (e.g., "8.5 / 10")
  - Verdict text ("Excellent Answer!", "Good Answer!", "Decent Answer!")
  - Detailed feedback paragraph
  - Action buttons: Next Question, Practice Same Topic Again, End Session
- **Session complete card**: Shows questions answered, average score, time taken
- **Loading overlay**: Animated spinner with "AI is analyzing your answer..." text during scoring

### 5. Coding Challenges

Algorithm and data structure problems with a built-in code editor. 50 problems across 11 topics.

- **Coding stats bar**: Solved count, daily progress (x/5), AI Reviews left (x/3), day streak
- **Daily limits**: Free users — 5 problems solved/day, 3 AI Reviews/day. Premium/Admin — unlimited.
- **Problem list view**:
  - Topic filter pills: All, Arrays, Stacks, Hash Maps, Binary Search, Linked Lists, Trees, Graphs, DP, Two Pointers, Backtracking, Sliding Window
  - Difficulty filter pills: All, Easy, Medium, Hard
  - Card grid with difficulty indicator (green=Easy, amber=Medium, red=Hard)
  - Solved problems show green left border + checkmark badge
  - Each card shows: problem number, difficulty pill, title, description preview, topic tag, estimated time
  - Click to open problem detail
- **Problem detail + editor view** (split panel):
  - **Left panel** (collapsible): Problem title, difficulty + topic pills, full description, example inputs/outputs/explanations, constraints list
  - **Right panel**:
    - Editor header: Filename tab, Run button, Submit button, AI Review button, language dropdown (JavaScript, TypeScript, Python), reset button, fullscreen button
    - Monaco editor: Syntax highlighting, line numbers, JetBrains Mono font, dark theme, 480px height
    - Output panel: Tab bar (Output, Test Cases), clear button
- **Run code**: Executes code against test cases via Piston API
- **Submit**: Marks problem as solved, records coding streak
- **AI Review**: Shows time/space complexity analysis, code quality feedback, improvement suggestions (mock UI for prototype)
- **Submit results**: Accepted/Wrong Answer verdict with per-test-case pass/fail
- **Submit results** (modal overlay): Verdict pill (Accepted/Wrong Answer), time complexity analysis, space complexity analysis, AI suggestion paragraph, "Next Problem" and "Close" buttons
- **Fullscreen editor**: Overlay with header (filename, language, reset, minimize), full-viewport Monaco editor
- **Language switching**: Updates editor content, filename extension, and Monaco language mode
- **Code reset**: Restores boilerplate template for current problem and language

### 7. Session History

Review all past practice sessions with detailed Q&A breakdown.

- **Export CSV button**: Downloads session data
- **History table**: Date, Type (Practice pill), Topic, Questions count, Avg Score (color-coded), Duration, Status (Completed/In Progress)
- **Expandable rows**: Click any row to expand and see:
  - Q&A blocks for each question in that session
  - Each block shows: Question, User's Answer, AI Feedback (highlighted in amber)
- **Empty state**: "No sessions yet" with "Start Practicing" button

### 8. Settings

Comprehensive user preferences organized into tabs.

- **Tab navigation**: Profile, Notifications, Practice Preferences, AI & Sources, Documents, Plan, Danger Zone

#### Profile
- First Name, Last Name (side by side)
- Email
- Target Role dropdown: Frontend Engineer, Full-Stack Engineer, Backend Engineer, DevOps Engineer, Engineering Manager
- Experience Level dropdown: Junior (0-2 yrs), Mid (2-5 yrs), Senior (5+ yrs)
- Target Companies: Comma-separated text input
- Save Changes button

#### Notifications
- Toggle switches for:
  - Daily Practice Reminder (7 PM)
  - Weekly Progress Report (Sunday)
  - New Questions Alert
  - Streak Milestone Alerts (7, 14, 30 days)
  - Email Digest (weekly summary)
- Save Preferences button

#### Practice Preferences
- Default Difficulty dropdown: Junior, Mid, Senior, Mixed (random)
- Session Length dropdown: 5, 10, 15, 20 questions
- Timer per Question dropdown: No timer, 2 min, 5 min, 10 min
- Preferred Topics: Clickable tag chips (React, TypeScript, HTML, CSS, Node.js, ExpressJS, NestJS, MongoDB, System Design)
- Toggle: Show hints after skip
- Toggle: Auto-advance to next question (3-second delay)
- Save Preferences button

#### AI & Sources
- **AI Model card**: Provider (NVIDIA NIM), Model (meta/llama-1.8b-instruct), Connection status (green dot + "Connected"), Test Connection button
- **PDF Sources list**: Each PDF card shows name, size, page count, enable/disable toggle, delete button
- **Web Search toggle**: Also search web for latest questions from official docs

#### Documents
- PDF upload area with drag-and-drop support
- File list with toggle and delete for each uploaded PDF
- Drag-over visual feedback (border color change, background highlight)

#### Plan
- **Current plan card**: Shows plan badge (FREE/Premium), plan name, description
- **Limits grid**: Practice sessions, questions per session, coding problems, AI reviews — with current limits
- **Upgrade section** (free users only): Monthly (₹299) and Yearly (₹1,999) plan cards with features
- **Premium users**: Shows "Unlimited" for all limits, no upgrade section

### Sidebar Upgrade
- "Upgrade to Premium" button in sidebar (visible for free users only)
- Amber gradient background with sparkle icon
- Click opens upgrade modal with plan selection
- Hidden when user is Premium or Admin

### Payment (Razorpay)
- **UPI**: Select app (GPay/PhonePe/Paytm/BHIM) → QR code + UPI ID input → Pay
- **Card**: Enter card number, expiry, CVV, name → 6-digit OTP → Verify → Success
- **Netbanking**: Select bank (SBI, HDFC, ICICI, etc.) → Redirect to bank page → Approve → Success
- **Wallet**: Select wallet (Paytm, Mobikwik, FreeCharge, JioMoney) → Redirect to wallet → Approve → Success
- **Pricing**: ₹299/month or ₹1,999/year (44% savings)
- **Flow**: Upgrade Now → Razorpay checkout → Payment → Role updated to PREMIUM

#### Danger Zone
- **Reset All Progress**: Red-bordered card with description and "Reset Progress" button
- **Delete Account**: Red-bordered card with description and "Delete Account" button
- **Export All Data**: Red-bordered card with description and "Export Data" button

### 9. Library

PDF document viewer for reading uploaded study materials.

- **List view**:
  - Toolbar with "My PDFs" title, select count badge, Select/Cancel button, Delete button
  - Card grid: Each card shows PDF icon, filename, file size, page count, "PDF Document" tag, "Open →" link
  - Select mode: Checkboxes appear on cards, multi-select for bulk delete
- **Viewer view**:
  - Back button to return to list
  - Header: PDF filename with document icon, zoom controls (zoom out, percentage, zoom in, reset to 100%), fullscreen button
  - Body: PDF iframe or placeholder if not available
  - Toolbar: Previous page, page counter ("Page 1 / 142"), next page
- **Fullscreen view**: Full-viewport PDF viewer with same controls
- **Delete confirmation**: Modal dialog with "Delete PDFs" title, file count message, Cancel and Delete buttons

### 10. Chatbot

AI assistant accessible from any screen via floating bubble.

- **Chat bubble**: Fixed bottom-right, amber gradient background, message icon, hover scale effect, rotation animation when open
- **Chat popup** (380x520px):
  - Header: Green pulsing dot, "PrepAI Assistant" title, fullscreen button, close button
  - Messages area: Scrollable, user messages (amber, right-aligned), bot messages (surface background, left-aligned)
  - Input area: Text input with placeholder, send button (amber)
- **Topic-aware responses**: Detects keywords (React, JavaScript, System Design, TypeScript, Node.js, help, thank) and returns relevant advice
- **Fullscreen mode**: Expands to fill most of the viewport (900px max-width)

### 11. Global Features

Cross-cutting functionality available on all screens.

- **Dark/Light theme**: Toggle via navbar or toolbar icon, persisted to localStorage, full CSS variable system for both modes
- **Global search**: Inline search in toolbar, real-time filtering across pages (Practice, Coding, History, Settings), keyboard navigation (arrow keys, Enter, Escape)
- **Notifications dropdown**: Bell icon with unread count badge, notification items with colored icons (green/amber/red/blue), "Mark all read" action, items show session completions, new topics, streak milestones, weekly reports
- **Toast notifications**: Bottom-right stack, success (green checkmark), error (red X), info (blue ℹ), auto-dismiss after 3.5 seconds, manual close, slide-in animation
- **Responsive design**: Mobile sidebar as overlay with hamburger menu, stacked grid layouts, adjusted padding/typography
- **Collapsible sidebar**: Toggle between expanded (240px) and collapsed (60px) modes, icons-only when collapsed, tooltip on hover
- **User menu**: Avatar with dropdown (Settings, Log out) in both sidebar footer and toolbar
- **Upgrade button**: "Upgrade to Premium" in sidebar (free users only), hidden for Premium/Admin

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Bundler | Vite + esbuild | 8.1.0 |
| Language | TypeScript (strict mode) | 6.0.3 |
| UI Library | React | 19.2.7 |
| Routing | React Router | 8.0.1 |
| State Management | Redux Toolkit + React Redux | 2.12.0 / 9.3.0 |
| Server State | TanStack Query | 5.101.2 |
| Component Library | Shadcn UI (base-nova style) | 4.12.0 |
| Styling | Tailwind CSS | 4.3.1 |
| HTTP Client | ky | 2.0.2 |
| Validation | Zod | 4.4.3 |
| Forms | React Hook Form + @hookform/resolvers | 7.80.0 / 5.4.0 |
| Auth | Clerk (@clerk/clerk-react) | 5.61.3 |
| Unit Testing | Vitest + @testing-library/react + jsdom | 4.1.9 |
| E2E Testing | Playwright | 1.52.0 |
| Fonts | DM Sans + JetBrains Mono (Fontsource) | 5.2.8 |
| Package Manager | pnpm | 11.5.0 |

### Infrastructure

| Service | Technology | Purpose |
|---------|-----------|---------|
| Code Execution | Piston (self-hosted) | Sandboxed code runner for JS/TS/Python |
| Container Runtime | Podman Desktop | Runs Piston container locally |
| Email | Resend | Transactional emails (reminders, reports) |
| File Storage | Cloudinary | PDF upload and storage |
| AI/LLM | NVIDIA NIM | Question generation, answer evaluation, chatbot |

---

## Project Structure

```
PrepAI/
├── public/
│   └── dashboard.png              # Dashboard screenshot for README
├── docs/
│   ├── PISTON_SETUP.md            # Original Piston setup guide
│   └── PISTON_WSL_SETUP_GUIDE.md  # Detailed WSL/Podman troubleshooting
├── e2e/
│   ├── frontend/
│   │   └── smoke.spec.ts          # Frontend E2E tests
│   └── backend/
│       └── smoke.spec.ts          # Backend E2E tests
├── piston-cli/                    # Piston CLI for runtime installation
│   ├── commands/
│   ├── index.js
│   └── package.json
├── types/
│   ├── piston.ts                  # Piston manager script (start/stop/setup/status)
│   └── piston.types.ts            # TypeScript types for piston script
├── piston-entrypoint.sh           # Custom entrypoint for Windows/Podman cgroup fix
├── server/                         # Backend (NestJS + Fastify)
│   └── README.md                   # Backend documentation and API Spec
├── ui/                             # Frontend (React + Vite)
│   ├── public/                     # Static assets (favicon, icons)
│   ├── src/
│   │   ├── assets/                 # Images (react.svg, vite.svg, hero.png)
│   │   ├── components/ui/          # Shadcn UI components
│   │   ├── lib/
│   │   │   └── utils.ts            # cn() utility (clsx + tailwind-merge)
│   │   ├── store/
│   │   │   └── index.ts            # Redux store configuration
│   │   ├── test/
│   │   │   └── setup.ts            # Vitest setup (@testing-library/jest-dom)
│   │   ├── App.tsx                 # Root component
│   │   ├── App.css                 # Component styles
│   │   ├── index.css               # Global styles + Tailwind import
│   │   └── main.tsx                # Entry point with providers
│   ├── .env.example                # Environment variable template
│   ├── components.json             # Shadcn UI configuration
│   ├── eslint.config.js            # ESLint configuration
│   ├── index.html                  # HTML entry point
│   ├── package.json                # Frontend dependencies
│   ├── pnpm-lock.yaml              # Lockfile
│   ├── tsconfig.json               # Root TypeScript config
│   ├── tsconfig.app.json           # App TypeScript config (strict mode)
│   ├── tsconfig.node.json          # Node TypeScript config
│   └── vite.config.ts              # Vite config (aliases, Tailwind, Vitest)
├── package.json                    # Root package (Playwright E2E tests + Piston scripts)
├── playwright.config.ts            # Playwright config (frontend + backend)
├── prepai-ui.html                  # Full standalone UI prototype
├── .env.example                    # Environment variables template
├── GEMINI.md                       # Project guidelines (Gemini)
└── README.md
```

---

## Backend API

The backend is built with NestJS and Fastify, integrating Mastra LLM agents for technical interview feedback. 

For the complete list of endpoints, payloads, and mock requests/responses, see the [README.md](file:///c:/antigravity-test/PrepAI/server/README.md) specification in the `server` directory.

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- **Podman Desktop** — Download from https://podman-desktop.io (required for Piston)
- **Podman CLI** — Installed automatically with Podman Desktop
- **podman-compose** — Install via: `pip install podman-compose` (optional, for docker-compose files)

### Piston Code Execution Engine

Piston is self-hosted for secure code execution. Before running, ensure:

1. **Podman Desktop is running** — Open the app, verify the machine is started (green indicator)
2. **Podman CLI is available** — Test with: `podman --version`
3. **Container is running** — Test with: `podman ps`

#### Quick Piston Commands

```bash
pnpm piston:start     # Start Piston container (first time may take a minute)
pnpm piston:setup     # Install JS/TS/Python runtimes (run once)
pnpm piston:status    # Check if container is running
pnpm piston:stop      # Stop and remove container
```

#### Verify Piston is Working

```bash
# Check container status
podman ps

# Test API endpoint
curl http://127.0.0.1:2000/api/v2/runtimes

# Test code execution
curl -X POST http://127.0.0.1:2000/api/v2/execute \
  -H "Content-Type: application/json" \
  -d '{"language":"js","version":"*","files":[{"content":"console.log(1+1)"}]}'
```

Expected output: `"stdout":"2\n"` with `"code":0`

#### Troubleshooting Piston

| Issue | Solution |
|-------|----------|
| Container exits immediately | Run `podman rm -f piston_api` then `pnpm piston:start` |
| Port 2000 in use | Change port in `types/piston.ts` (line 39) |
| Podman not found | Ensure Podman Desktop is running and in PATH |
| Runtimes not installed | Run `pnpm piston:setup` |

### 1. Clone the repository

```bash
git clone <repo-url>
cd PrepAI
```

### 2. Install all dependencies

```bash
pnpm install
cd ui && pnpm install && cd ..
cd server && pnpm install && cd ..
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and add your API keys (see [Resources](#resources--api-keys) below):

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
NVIDIA_API_KEY=nvapi-your_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
RESEND_API_KEY=re_your_key_here
```

### 4. Start Piston (Code Execution Engine)

```bash
pnpm piston:start     # Boot Piston container
pnpm piston:setup     # Install JS/TS/Python runtimes
pnpm piston:status    # Verify it's running
```

### 5. Start the backend server

```bash
cd server
pnpm run start:dev
```

The API will be available at `http://localhost:3000`.

### 6. Start the frontend dev server

```bash
cd ui
pnpm dev
```

The app will be available at `http://localhost:5173`.

### 7. Install E2E test dependencies (optional)

```bash
pnpm install          # at root level
npx playwright install chromium
```

---

## Resources & API Keys

| Service | Purpose | Get Key At |
|---------|---------|-----------|
| **Clerk** | Authentication (Email, Google, GitHub, LinkedIn) | https://dashboard.clerk.com |
| **NVIDIA NIM** | AI/LLM for question generation and feedback | https://build.nvidia.com |
| **Cloudinary** | PDF file storage (25 GB free) | https://cloudinary.com |
| **Resend** | Transactional emails (100/day free) | https://resend.com |
| **Razorpay** | Payment gateway for premium upgrades | https://dashboard.razorpay.com |
| **Podman Desktop** | Container runtime for Piston | https://podman-desktop.io |

### Clerk
1. Sign up at https://dashboard.clerk.com
2. Create a new application
3. Enable providers: Email, Google, GitHub, LinkedIn
4. Copy **Publishable Key** → `VITE_CLERK_PUBLISHABLE_KEY`
5. Copy **Secret Key** → `CLERK_SECRET_KEY`

### NVIDIA NIM
1. Sign up at https://build.nvidia.com
2. Go to API Explorer
3. Generate an API key
4. Copy key → `NVIDIA_API_KEY`
5. Model used: `meta/llama-3.1-8b-instruct`

### Cloudinary
1. Sign up at https://cloudinary.com
2. Go to Dashboard → Account Details
3. Copy **Cloud Name** → `CLOUDINARY_CLOUD_NAME`
4. Copy **API Key** → `CLOUDINARY_API_KEY`
5. Copy **API Secret** → `CLOUDINARY_API_SECRET`

### Resend
1. Sign up at https://resend.com
2. Go to API Keys → Create API Key
3. Copy key → `RESEND_API_KEY`
4. Free tier: 100 emails/day

### Razorpay
1. Sign up at https://dashboard.razorpay.com
2. Go to Settings → API Keys
3. Generate Test Mode keys
4. Copy **Key ID** → `RAZORPAY_KEY_ID`
5. Copy **Key Secret** → `RAZORPAY_KEY_SECRET`
6. Test mode: No real money charged
7. Docs: https://razorpay.com/docs

### Piston (Code Execution)
- Self-hosted, no API key needed
- Runs locally via Podman container
- Commands: `pnpm piston:start/stop/setup/status`
- Details: See `docs/PISTON_WSL_SETUP_GUIDE.md`

---

## Testing

### Unit Tests (Vitest)

```bash
cd ui
pnpm test            # run all tests
pnpm test:ui         # open Vitest UI
```

### E2E Tests (Playwright)

```bash
pnpm test                          # run all E2E tests
pnpm test:frontend                 # frontend tests only
pnpm test:backend                  # backend tests only
pnpm test:chromium                 # chromium project only
pnpm report                        # open HTML report
```

---

## UI Prototype

The file `prepai-ui.html` at the project root is a **fully self-contained HTML prototype** of the entire application. It includes:

- All screens (Landing, Auth, Dashboard, Practice, Coding, History, Settings, Library)
- Working navigation between screens
- Dark/light theme toggle
- Interactive elements (filters, search, chatbot, toasts)
- 50 coding problems with Monaco editor integration across 11 topics
- 30+ practice questions across 6 topics
- Session history with expandable Q&A
- PDF viewer with zoom and navigation
- Responsive design

Open it in any browser — no backend, no dependencies, no build step required.

---

## License

Private project. All rights reserved.
