# Theory Module — API Specification

Base URL: `http://localhost:3000/api/v1/theory`

All endpoints require Bearer token authentication (Clerk).

---

## Role-Based Limits

| | Free (USER) | Premium / Admin |
|---|---|---|
| **Daily practice sessions** | 3 per day | Unlimited |
| **Questions per session** | 10 max | 30 max |
| **AI-generated questions (Weak Areas / PDF Study)** | 10 max | 30 max |

### How Limits Are Enforced

- **Session start**: Check daily session count. If limit reached → return 403.
- **Questions per session**: Frontend sends `totalQuestions` (role-based). Backend validates it doesn't exceed the user's limit.
- **Role is read from MongoDB User record** at request time via `ClerkAuthGuard`.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `THEORY_DAILY_SESSIONS_FREE` | 3 | Max daily sessions for free users |
| `THEORY_DAILY_SESSIONS_PREMIUM` | 999 | Max daily sessions for premium users |
| `THEORY_QUESTIONS_PER_SESSION_FREE` | 10 | Max questions per session for free users |
| `THEORY_QUESTIONS_PER_SESSION_PREMIUM` | 30 | Max questions per session for premium users |

---

## 1. Start Practice Session

Create a new theory practice session.

**Method:** `POST`  
**Route:** `/theory/session/start`  
**Auth:** Bearer Token (any authenticated user)

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topicId` | string | no | MongoDB Topic ID. Required for "topic" mode. |
| `mode` | string | yes | `"topic"` \| `"weak"` \| `"pdf"` |
| `difficulty` | string | yes | `"Junior"` \| `"Mid"` \| `"Senior"` |
| `totalQuestions` | number | yes | Number of questions. Max: 10 (free), 30 (premium). |

```json
{
  "topicId": "507f1f77bcf86cd799439011",
  "mode": "topic",
  "difficulty": "Mid",
  "totalQuestions": 10
}
```

### Response (201 Created)

```json
{
  "success": true,
  "message": "Session started successfully",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "user_2xKp9mNqR3",
    "topicId": "507f1f77bcf86cd799439011",
    "mode": "topic",
    "difficulty": "Mid",
    "totalQuestions": 10,
    "questionsAnswered": 0,
    "avgScore": 0,
    "status": "in_progress",
    "startedAt": "2026-07-25T10:30:00.000Z",
    "completedAt": null,
    "createdAt": "2026-07-25T10:30:00.000Z"
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 400 | Validation failed (missing required fields) |
| 400 | Topic not found (when topicId provided but invalid) |
| 403 | Daily session limit reached (free users: 3/day) |

---

## 2. Get Questions for Session

Fetch questions from the question bank for the current session.

**Method:** `GET`  
**Route:** `/theory/session/:sessionId/questions`  
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | TheorySession ID |

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | no | Number of questions to fetch (default: 10) |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Questions fetched successfully",
  "data": [
    {
      "id": "507f1f77bcf86cd799439022",
      "question": "What is the difference between useEffect and useLayoutEffect?",
      "topicId": "507f1f77bcf86cd799439011",
      "difficulty": "Mid",
      "referenceAnswer": "useEffect runs after paint, useLayoutEffect runs synchronously before paint..."
    }
  ]
}
```

### Errors

| Status | Message |
|--------|---------|
| 404 | Session not found |
| 403 | Not session owner |

---

## 3. Submit Answer

Submit a user's answer for a question. AI evaluates and returns score + feedback.

**Method:** `POST`  
**Route:** `/theory/session/:sessionId/answer`  
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | TheorySession ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `questionId` | string | no | MongoDB Question ID. Null for AI-generated questions. |
| `questionText` | string | yes | The question text (stored for history) |
| `userAnswer` | string | yes | User's text answer |
| `timeTaken` | number | no | Time taken in seconds |

```json
{
  "questionId": "507f1f77bcf86cd799439022",
  "questionText": "What is the difference between useEffect and useLayoutEffect?",
  "userAnswer": "useEffect runs after the browser paints the screen, while useLayoutEffect runs synchronously before the browser repaints...",
  "timeTaken": 120
}
```

### Response (201 Created)

```json
{
  "success": true,
  "message": "Answer submitted successfully",
  "data": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "questionId": "507f1f77bcf86cd799439022",
    "questionText": "What is the difference between useEffect and useLayoutEffect?",
    "userAnswer": "useEffect runs after the browser paints the screen, while useLayoutEffect runs synchronously before the browser repaints...",
    "aiScore": 8.5,
    "aiFeedback": "Good answer. You correctly identified the timing difference. Consider adding examples of when to use each.",
    "timeTaken": 120,
    "createdAt": "2026-07-25T10:32:00.000Z"
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 404 | Session not found |
| 403 | Not session owner |
| 409 | Session already completed |

---

## 4. Complete Session

Mark session as completed and compute final average score.

**Method:** `POST`  
**Route:** `/theory/session/:sessionId/complete`  
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | TheorySession ID |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Session completed successfully",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "user_2xKp9mNqR3",
    "topicId": "507f1f77bcf86cd799439011",
    "mode": "topic",
    "difficulty": "Mid",
    "totalQuestions": 10,
    "questionsAnswered": 10,
    "avgScore": 7.8,
    "status": "completed",
    "startedAt": "2026-07-25T10:30:00.000Z",
    "completedAt": "2026-07-25T10:50:00.000Z",
    "createdAt": "2026-07-25T10:30:00.000Z"
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 404 | Session not found |
| 403 | Not session owner |
| 409 | Session already completed |

---

## 5. Get Session Detail

Get a single session with all its answers.

**Method:** `GET`  
**Route:** `/theory/session/:sessionId`  
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | TheorySession ID |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Session fetched successfully",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "user_2xKp9mNqR3",
    "topicId": "507f1f77bcf86cd799439011",
    "mode": "topic",
    "difficulty": "Mid",
    "totalQuestions": 10,
    "questionsAnswered": 10,
    "avgScore": 7.8,
    "status": "completed",
    "startedAt": "2026-07-25T10:30:00.000Z",
    "completedAt": "2026-07-25T10:50:00.000Z",
    "createdAt": "2026-07-25T10:30:00.000Z",
    "answers": [
      {
        "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "questionId": "507f1f77bcf86cd799439022",
        "questionText": "What is the difference between useEffect and useLayoutEffect?",
        "userAnswer": "useEffect runs after the browser paints...",
        "aiScore": 8.5,
        "aiFeedback": "Good answer. Consider adding examples.",
        "timeTaken": 120,
        "createdAt": "2026-07-25T10:32:00.000Z"
      }
    ]
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 404 | Session not found |
| 403 | Not session owner |

---

## 6. Get Session History

Get all past sessions for the current user.

**Method:** `GET`  
**Route:** `/theory/sessions`  
**Auth:** Bearer Token (any authenticated user)

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | number | no | Page number (default: 1) |
| `limit` | number | no | Items per page (default: 20) |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Sessions fetched successfully",
  "data": {
    "sessions": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "topicId": "507f1f77bcf86cd799439011",
        "mode": "topic",
        "difficulty": "Mid",
        "totalQuestions": 10,
        "questionsAnswered": 10,
        "avgScore": 7.8,
        "status": "completed",
        "startedAt": "2026-07-25T10:30:00.000Z",
        "completedAt": "2026-07-25T10:50:00.000Z",
        "createdAt": "2026-07-25T10:30:00.000Z"
      }
    ],
    "total": 24,
    "page": 1,
    "limit": 20
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 400 | Invalid pagination params |

---

## 7. Get Weak Areas

Get topics where the user scores below 70%.

**Method:** `GET`  
**Route:** `/theory/weak-areas`  
**Auth:** Bearer Token (any authenticated user)

### Response (200 OK)

```json
{
  "success": true,
  "message": "Weak areas fetched successfully",
  "data": [
    {
      "topicId": "507f1f77bcf86cd799439033",
      "topicName": "MongoDB",
      "avgScore": 4.5,
      "sessionsCount": 5,
      "lastPracticed": "2026-07-24T15:00:00.000Z"
    },
    {
      "topicId": "507f1f77bcf86cd799439044",
      "topicName": "System Design",
      "avgScore": 6.2,
      "sessionsCount": 3,
      "lastPracticed": "2026-07-23T10:00:00.000Z"
    }
  ]
}
```

---

## 8. Get Score Trend

Get the user's last N session scores for the dashboard chart.

**Method:** `GET`  
**Route:** `/theory/score-trend`  
**Auth:** Bearer Token (any authenticated user)

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | no | Number of sessions (default: 7) |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Score trend fetched successfully",
  "data": [
    { "date": "2026-07-18", "avgScore": 5.5 },
    { "date": "2026-07-19", "avgScore": 6.9 },
    { "date": "2026-07-20", "avgScore": 7.3 },
    { "date": "2026-07-21", "avgScore": 9.1 },
    { "date": "2026-07-22", "avgScore": 4.8 },
    { "date": "2026-07-23", "avgScore": 6.2 },
    { "date": "2026-07-24", "avgScore": 8.5 }
  ]
}
```

---

## Summary

| # | Method | Route | Description |
|---|--------|-------|-------------|
| 1 | `POST` | `/theory/session/start` | Start a new practice session |
| 2 | `GET` | `/theory/session/:sessionId/questions` | Get questions for session |
| 3 | `POST` | `/theory/session/:sessionId/answer` | Submit answer (AI evaluates) |
| 4 | `POST` | `/theory/session/:sessionId/complete` | Complete session |
| 5 | `GET` | `/theory/session/:sessionId` | Get session detail with answers |
| 6 | `GET` | `/theory/sessions` | Get session history (paginated) |
| 7 | `GET` | `/theory/weak-areas` | Get topics below 70% score |
| 8 | `GET` | `/theory/score-trend` | Get score trend for chart |
