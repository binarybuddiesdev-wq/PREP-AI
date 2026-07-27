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

## Topics

| Method | Endpoint | Description | Auth | Role | Request Body | Response |
|--------|----------|-------------|------|------|--------------|----------|
| `POST` | `/topics` | Create a new topic | Bearer Token | ADMIN | `{ name, slug, category, icon? }` | `{ message, data: Topic }` |
| `GET` | `/topics` | Get all topics (optional `?category=` filter) | Bearer Token | Any | — | `{ message, data: Topic[] }` |
| `GET` | `/topics/:slug` | Get topic by slug | Bearer Token | Any | — | `{ message, data: Topic }` |
| `PATCH` | `/topics/:id` | Update a topic | Bearer Token | ADMIN | `{ name?, slug?, category?, icon? }` | `{ message, data: Topic }` |
| `DELETE` | `/topics/:id` | Delete a topic | Bearer Token | ADMIN | — | `{ message }` |

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

## Topic Model

```
Topic {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  slug        String    @unique
  category    String
  icon        String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

---

## Questions

| Method | Endpoint | Description | Auth | Role | Request Body | Response |
|--------|----------|-------------|------|------|--------------|----------|
| `POST` | `/questions` | Create a new question | Bearer Token | ADMIN | `{ question, topicId, difficulty, referenceAnswer? }` | `{ message, data: Question }` |
| `GET` | `/questions` | Get questions by topic and difficulty | Bearer Token | Any | — | `{ message, data: Question[] }` |
| `GET` | `/questions/:id` | Get question by ID | Bearer Token | Any | — | `{ message, data: Question }` |
| `PATCH` | `/questions/:id` | Update a question | Bearer Token | ADMIN | `{ question?, topicId?, difficulty?, referenceAnswer? }` | `{ message, data: Question }` |
| `DELETE` | `/questions/:id` | Delete a question | Bearer Token | ADMIN | — | `{ message }` |

---

## Question Model

```
Question {
  id              String    @id @default(auto()) @map("_id") @db.ObjectId
  question        String
  topicId         String    @db.ObjectId
  difficulty      String
  referenceAnswer String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

---

## Theory

| Method | Endpoint | Description | Auth | Role | Request Body / Query | Response |
|--------|----------|-------------|------|------|----------------------|----------|
| `POST` | `/theory/session/start` | Start a new theory practice session | Bearer Token | Any | `{ topicId?, mode, difficulty, totalQuestions }` | `{ message, data: TheorySession }` |
| `GET` | `/theory/session/:sessionId/questions` | Get questions for a session | Bearer Token | Any | `?limit=` (optional) | `{ message, data: Question[] }` |
| `POST` | `/theory/session/:sessionId/answer` | Submit answer for AI evaluation | Bearer Token | Any | `{ questionId?, questionText, userAnswer, timeTaken? }` | `{ message, data: TheoryAnswer }` |
| `POST` | `/theory/session/:sessionId/complete` | Complete a session and compute avg score | Bearer Token | Any | — | `{ message, data: TheorySession }` |
| `GET` | `/theory/session/:sessionId` | Get session detail with all answers | Bearer Token | Any | — | `{ message, data: TheorySessionWithAnswers }` |
| `GET` | `/theory/sessions` | Get paginated session history | Bearer Token | Any | `?page=&limit=` (optional) | `{ message, data: { sessions, total, page, limit } }` |
| `GET` | `/theory/weak-areas` | Get topics scoring below 70% | Bearer Token | Any | — | `{ message, data: WeakArea[] }` |
| `GET` | `/theory/score-trend` | Get score trend for dashboard chart | Bearer Token | Any | `?limit=` (optional, default 7) | `{ message, data: { date, avgScore }[] }` |

### Mode Options

| Mode | Description |
|------|-------------|
| `topic` | Questions scoped to a specific topic |
| `weak` | Questions from topics where user scores below 70% |
| `pdf` | Questions generated from uploaded PDFs |

### Role Limits

| Limit | Free (USER) | Premium / ADMIN |
|-------|-------------|-----------------|
| Daily sessions | 3 | Unlimited (999) |
| Questions per session | 10 | 30 |

### TheorySession Model (PostgreSQL)

```
TheorySession {
  id                String    @id @default(uuid())
  userId            String
  topicId           String?   // null for weak/pdf mode
  mode              String    // "topic" | "weak" | "pdf"
  difficulty        String    // "Junior" | "Mid" | "Senior"
  totalQuestions    Int
  questionsAnswered Int       @default(0)
  avgScore          Float     @default(0)
  status            String    @default("in_progress") // "in_progress" | "completed"
  startedAt         DateTime  @default(now())
  completedAt       DateTime?
  createdAt         DateTime  @default(now())
}
```

### TheoryAnswer Model (PostgreSQL)

```
TheoryAnswer {
  id           String    @id @default(uuid())
  sessionId    String
  questionId   String?   // null for AI-generated questions
  questionText String
  userAnswer   String
  aiScore      Float
  aiFeedback   String
  timeTaken    Int?      // seconds
  createdAt    DateTime  @default(now())
}
```

---

## Testing in Swagger

### Authentication

1. Open Swagger at `http://localhost:3000/docs`
2. Click **Authorize** at the top right
3. Paste your Bearer token and click **Authorize**

### Getting the Bearer Token

1. Open the frontend at `http://localhost:5173`
2. Log in normally
3. Open browser **DevTools** (F12) → **Application** tab → **Cookies**
4. Copy the value of `__session` cookie (starts with `eyJ...`)
5. Paste it into Swagger's Authorize field

### Important: Clerk Token Expiry

Clerk access tokens expire in **~60 seconds**. If you get a `401 Invalid session token` error:

1. Go back to the frontend
2. Refresh the page (F5)
3. Copy the new `__session` cookie value
4. Paste it into Swagger's Authorize again
5. Test the endpoint

This is normal Clerk behavior — short-lived tokens for security. For testing, you'll need to refresh the token frequently.
