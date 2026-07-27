# Coding Module — API Specification

Base URL: `http://localhost:3000/api/v1/coding`

All endpoints require Bearer token authentication (Clerk).

---

## Role-Based Limits

| | Free (USER) | Premium / Admin |
|---|---|---|
| **Daily solved problems** | 5 per day | Unlimited |
| **Daily AI reviews** | 3 per day | Unlimited |

### How Limits Are Enforced

- **Daily solved**: Frontend sends submit request. Backend checks daily submission count against the user's limit.
- **AI reviews**: Each AI review request increments a daily counter. Backend checks against the user's limit before generating review.
- **Role** is read from MongoDB User record at request time via `ClerkAuthGuard`.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CODING_DAILY_SOLVED_FREE` | 5 | Max daily solved problems for free users |
| `CODING_DAILY_SOLVED_PREMIUM` | 999 | Max daily solved problems for premium users |
| `CODING_DAILY_REVIEWS_FREE` | 3 | Max daily AI reviews for free users |
| `CODING_DAILY_REVIEWS_PREMIUM` | 999 | Max daily AI reviews for premium users |

---

## 1. List Problems

Fetch all coding problems with optional filtering.

**Method:** `GET`
**Route:** `/coding/problems`
**Auth:** Bearer Token (any authenticated user)

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | no | Filter by topic (e.g. "Arrays", "Stacks", "Trees") |
| `difficulty` | string | no | Filter by difficulty (`"Easy"` \| `"Medium"` \| `"Hard"`) |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Problems fetched successfully",
  "data": [
    {
      "id": "uuid-1",
      "title": "Two Sum",
      "slug": "two-sum",
      "difficulty": "Easy",
      "topic": "Arrays",
      "description": "Given an array of integers <strong>nums</strong> and an integer <strong>target</strong>, return indices of the two numbers such that they add up to target."
    }
  ]
}
```

---

## 2. Get Problem Detail

Get a single problem with full details, examples, constraints, and code templates.

**Method:** `GET`
**Route:** `/coding/problems/:id`
**Auth:** Bearer Token (any authenticated user)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Problem ID or slug |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Problem fetched successfully",
  "data": {
    "id": "uuid-1",
    "title": "Two Sum",
    "slug": "two-sum",
    "difficulty": "Easy",
    "topic": "Arrays",
    "description": "Given an array of integers <strong>nums</strong> and an integer <strong>target</strong>, return indices of the two numbers such that they add up to target.",
    "examples": [
      {
        "input": "nums = [2,7,11,15], target = 9",
        "output": "[0,1]",
        "explanation": "nums[0] + nums[1] == 9"
      }
    ],
    "constraints": [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "Only one valid answer exists."
    ],
    "codeJs": "function twoSum(nums, target) {\n  \n}",
    "codeTs": "function twoSum(nums: number[], target: number): number[] {\n  \n}",
    "codePy": "def two_sum(nums, target):\n    pass"
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 404 | Problem not found |

---

## 3. Start Coding Session

Create a new coding practice session.

**Method:** `POST`
**Route:** `/coding/session/start`
**Auth:** Bearer Token (any authenticated user)

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `problemIds` | string[] | no | Specific problem IDs to include. If omitted, picks from all problems. |

```json
{
  "problemIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

### Response (201 Created)

```json
{
  "success": true,
  "message": "Coding session started",
  "data": {
    "id": "session-uuid",
    "userId": "user_2xKp9mNqR3",
    "problemsAttempted": 0,
    "problemsSolved": 0,
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
| 400 | Validation failed |

---

## 4. Run Code (Test)

Run submitted code against problem examples for testing. Does not count toward daily solved limit.

**Method:** `POST`
**Route:** `/coding/session/:sessionId/run`
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | CodingSession ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `problemId` | string | yes | Problem ID |
| `language` | string | yes | `"javascript"` \| `"typescript"` \| `"python"` |
| `code` | string | yes | The user's code |

```json
{
  "problemId": "uuid-1",
  "language": "javascript",
  "code": "function twoSum(nums, target) {\n  const map = {};\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (complement in map) return [map[complement], i];\n    map[nums[i]] = i;\n  }\n  return [];\n}"
}
```

### Response (200 OK)

```json
{
  "success": true,
  "message": "Code executed successfully",
  "data": {
    "status": "accepted",
    "testCasesPassed": 2,
    "testCasesTotal": 2,
    "testCases": [
      {
        "input": "nums = [2,7,11,15], target = 9",
        "expected": "[0,1]",
        "got": "[0,1]",
        "passed": true
      },
      {
        "input": "nums = [3,2,4], target = 6",
        "expected": "[1,2]",
        "got": "[1,2]",
        "passed": true
      }
    ],
    "runtime": 45,
    "memoryUsage": 12
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 404 | Session not found |
| 403 | Not session owner |
| 404 | Problem not found |

---

## 5. Submit Solution

Submit a solution for evaluation. This counts toward the daily solved limit. If all problem examples pass, the problem is marked as solved.

**Method:** `POST`
**Route:** `/coding/session/:sessionId/submit`
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | CodingSession ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `problemId` | string | yes | Problem ID |
| `language` | string | yes | `"javascript"` \| `"typescript"` \| `"python"` |
| `code` | string | yes | The user's code |

```json
{
  "problemId": "uuid-1",
  "language": "javascript",
  "code": "function twoSum(nums, target) {\n  const map = {};\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (complement in map) return [map[complement], i];\n    map[nums[i]] = i;\n  }\n  return [];\n}"
}
```

### Response (201 Created)

```json
{
  "success": true,
  "message": "Solution submitted successfully",
  "data": {
    "id": "answer-uuid",
    "sessionId": "session-uuid",
    "problemId": "uuid-1",
    "language": "javascript",
    "code": "function twoSum(nums, target) { ... }",
    "status": "accepted",
    "testCasesPassed": 2,
    "testCasesTotal": 2,
    "runtime": 45,
    "memoryUsage": 12,
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
| 403 | Daily solved limit reached |

---

## 6. AI Code Review

Request an AI-powered code review. This counts toward the daily AI review limit.

**Method:** `POST`
**Route:** `/coding/session/:sessionId/review`
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | CodingSession ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `answerId` | string | yes | The CodingAnswer ID to review |
| `problemId` | string | yes | Problem ID (for context) |

```json
{
  "answerId": "answer-uuid",
  "problemId": "uuid-1"
}
```

### Response (200 OK)

```json
{
  "success": true,
  "message": "AI review generated successfully",
  "data": {
    "answerId": "answer-uuid",
    "timeComplexity": "O(n)",
    "timeComplexityDesc": "Linear time. Single pass through the array using a hash map for O(1) lookups.",
    "spaceComplexity": "O(n)",
    "spaceComplexityDesc": "Linear extra space for the hash map storing up to n elements.",
    "quality": "Clean and efficient solution. Good use of hash map for O(1) lookups.",
    "suggestions": "Consider adding input validation for edge cases like empty arrays."
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 404 | Session not found |
| 403 | Not session owner |
| 404 | Answer not found |
| 403 | Daily review limit reached |

---

## 7. Get Session Detail

Get a coding session with all submitted answers.

**Method:** `GET`
**Route:** `/coding/session/:sessionId`
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | CodingSession ID |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Session fetched successfully",
  "data": {
    "id": "session-uuid",
    "userId": "user_2xKp9mNqR3",
    "problemsAttempted": 3,
    "problemsSolved": 2,
    "status": "in_progress",
    "startedAt": "2026-07-25T10:30:00.000Z",
    "completedAt": null,
    "createdAt": "2026-07-25T10:30:00.000Z",
    "answers": [
      {
        "id": "answer-uuid",
        "problemId": "uuid-1",
        "language": "javascript",
        "code": "function twoSum(nums, target) { ... }",
        "status": "accepted",
        "testCasesPassed": 2,
        "testCasesTotal": 2,
        "runtime": 45,
        "memoryUsage": 12,
        "aiReviewJson": {
          "timeComplexity": "O(n)",
          "spaceComplexity": "O(n)",
          "quality": "Clean solution.",
          "suggestions": "Add edge case handling."
        },
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

## 8. Complete Session

Mark a coding session as completed.

**Method:** `POST`
**Route:** `/coding/session/:sessionId/complete`
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | CodingSession ID |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Coding session completed",
  "data": {
    "id": "session-uuid",
    "userId": "user_2xKp9mNqR3",
    "problemsAttempted": 3,
    "problemsSolved": 2,
    "status": "completed",
    "startedAt": "2026-07-25T10:30:00.000Z",
    "completedAt": "2026-07-25T11:00:00.000Z",
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

## 9. Get Session History

Get all past coding sessions for the current user.

**Method:** `GET`
**Route:** `/coding/sessions`
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
        "id": "session-uuid",
        "problemsAttempted": 3,
        "problemsSolved": 2,
        "status": "completed",
        "startedAt": "2026-07-25T10:30:00.000Z",
        "completedAt": "2026-07-25T11:00:00.000Z",
        "createdAt": "2026-07-25T10:30:00.000Z"
      }
    ],
    "total": 12,
    "page": 1,
    "limit": 20
  }
}
```

---

## 10. Get Coding Stats

Get the user's daily coding stats and streak.

**Method:** `GET`
**Route:** `/coding/stats`
**Auth:** Bearer Token (any authenticated user)

### Response (200 OK)

```json
{
  "success": true,
  "message": "Stats fetched successfully",
  "data": {
    "totalSolved": 47,
    "dailySolved": 3,
    "dailyLimit": 5,
    "dailyReviews": 1,
    "dailyReviewLimit": 3,
    "streak": 5,
    "lastActiveDate": "2026-07-25"
  }
}
```

---

## Summary

| # | Method | Route | Description |
|---|--------|-------|-------------|
| 1 | `GET` | `/coding/problems` | List problems with optional filters |
| 2 | `GET` | `/coding/problems/:id` | Get problem detail with templates |
| 3 | `POST` | `/coding/session/start` | Start a coding session |
| 4 | `POST` | `/coding/session/:sessionId/run` | Run code against examples (test) |
| 5 | `POST` | `/coding/session/:sessionId/submit` | Submit solution (counts toward daily limit) |
| 6 | `POST` | `/coding/session/:sessionId/review` | Request AI code review |
| 7 | `GET` | `/coding/session/:sessionId` | Get session detail with answers |
| 8 | `POST` | `/coding/session/:sessionId/complete` | Complete a session |
| 9 | `GET` | `/coding/sessions` | Get session history (paginated) |
| 10 | `GET` | `/coding/stats` | Get daily coding stats and streak |
