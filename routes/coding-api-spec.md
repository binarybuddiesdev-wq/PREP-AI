# Coding Module — API Specification

Base URL: `http://localhost:3000/api/v1/coding`

All endpoints require Bearer token authentication (Clerk).

> **Implementation status (2026-11-02):** The supported MVP routes are problem list/detail, session start, run, submit, session detail, completion, and session history as listed below. AI review and stats are deferred and are not implemented. This implementation status and the rules below supersede older examples in this draft where they conflict.

### Implemented contract and execution rules

- Problem examples are executable structured JSON values: `{ "input": [arg1, arg2], "output": value, "explanation": "optional" }`. The server calls the user's `solution(...args)` function in JavaScript, TypeScript, or Python.
- Run and submit accept only `problemId`, `language`, and `code`. They execute only examples stored on that problem; runtime, version, filename, harness, arguments, limits, and Piston URL are server-owned.
- Source code is capped at 32,000 characters, examples at 20, each Piston process has a 3-second wall-time and CPU-time limit and 256 MiB memory cap, and the complete example batch has a 15-second request deadline. Piston output and bytes read from its response are capped; surfaced output values are limited to 16 KiB.
- Each run/submit requires an owned in-progress session and a problem assigned to it. A session owned by someone else and a problem outside that session both return 404. Completed sessions return 409.
- Run and submit share a per-user Redis fixed-window throttle of 10 execution requests per 60 seconds. Exceeding it returns 429. If Redis cannot reserve capacity, execution fails closed with 503.
- Run never saves an answer or consumes the daily solved quota. Submit saves accepted, wrong-answer, and runtime-error results. Only an accepted first solve reserves a daily solve count; a failed submission releases its reservation. A daily limit or same-problem submission already in progress returns 409.
- The per-day unique-solve quota is tracked atomically in Redis and expires at UTC midnight. Redis is the quota authority for the current MVP; flushing Redis resets that day's quota accounting.
- PostgreSQL or Piston unavailability returns 503. Successful response envelope is `{ "message": "...", "data": ... }` (the global success field is added by the response interceptor).
- Run and submit create a durable PostgreSQL execution record, enqueue Piston work, and return `202 Accepted` with an execution ID. Poll `GET /coding/session/:sessionId/executions/:executionId` for its status and result.
- Execution statuses are `queued`, `running`, `completed`, and `failed`. The result and submit answer are committed once, even if BullMQ retries the job. Terminal failure releases a reserved daily solve slot.
- `PISTON_URL` defaults to `http://127.0.0.1:2000` on the host. The full Podman server uses `http://host.containers.internal:2000` to reach the host Piston service.
- Code execution is enabled in development by default. In production it is disabled unless `PISTON_EXECUTION_ENABLED=true` is explicitly configured. That flag does not provide isolation: the local privileged Podman runner is for development only. Public production traffic requires a separately reviewed stronger runtime boundary; see the [Piston runbook](../docs/runbooks/piston.md).
- A local-only Two Sum seed is available as `pnpm --filter server seed:coding:local`; it refuses non-loopback PostgreSQL hosts. Apply/validate schema as described in `server/README.md` before running it.

---

## Role-Based Limits

|                           | Free (USER) | Premium / Admin |
| ------------------------- | ----------- | --------------- |
| **Daily solved problems** | 5 per day   | Unlimited       |
| **Daily AI reviews**      | 3 per day   | Unlimited       |

### How Limits Are Enforced

- **Daily solved**: Frontend sends submit request. Backend checks daily submission count against the user's limit.
- **AI reviews**: Each AI review request increments a daily counter. Backend checks against the user's limit before generating review.
- **Role** is read from MongoDB User record at request time via `ClerkAuthGuard`.

### Environment Variables

| Variable                       | Default | Description                                 |
| ------------------------------ | ------- | ------------------------------------------- |
| `CODING_DAILY_SOLVED_FREE`     | 5       | Max daily solved problems for free users    |
| `CODING_DAILY_SOLVED_PREMIUM`  | 999     | Max daily solved problems for premium users |
| `CODING_DAILY_REVIEWS_FREE`    | 3       | Max daily AI reviews for free users         |
| `CODING_DAILY_REVIEWS_PREMIUM` | 999     | Max daily AI reviews for premium users      |

---

## 1. List Problems

Fetch all coding problems with optional filtering.

**Method:** `GET`
**Route:** `/coding/problems`
**Auth:** Bearer Token (any authenticated user)

### Query Parameters

| Param        | Type   | Required | Description                                               |
| ------------ | ------ | -------- | --------------------------------------------------------- |
| `topic`      | string | no       | Filter by topic (e.g. "Arrays", "Stacks", "Trees")        |
| `difficulty` | string | no       | Filter by difficulty (`"Easy"` \| `"Medium"` \| `"Hard"`) |

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

| Param | Type   | Description        |
| ----- | ------ | ------------------ |
| `id`  | string | Problem ID or slug |

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

| Status | Message           |
| ------ | ----------------- |
| 404    | Problem not found |

---

## 3. Start Coding Session

Create a new coding practice session.

**Method:** `POST`
**Route:** `/coding/session/start`
**Auth:** Bearer Token (any authenticated user)

### Request Body

| Field        | Type     | Required | Description                                                           |
| ------------ | -------- | -------- | --------------------------------------------------------------------- |
| `problemIds` | string[] | no       | Specific problem IDs to include. If omitted, picks from all problems. |

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

| Status | Message           |
| ------ | ----------------- |
| 400    | Validation failed |

---

## 4. Run Code (Test)

Run submitted code against problem examples for testing. Does not count toward daily solved limit.

**Method:** `POST`
**Route:** `/coding/session/:sessionId/run`
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param       | Type   | Description      |
| ----------- | ------ | ---------------- |
| `sessionId` | string | CodingSession ID |

### Request Body

| Field       | Type   | Required | Description                                    |
| ----------- | ------ | -------- | ---------------------------------------------- |
| `problemId` | string | yes      | Problem ID                                     |
| `language`  | string | yes      | `"javascript"` \| `"typescript"` \| `"python"` |
| `code`      | string | yes      | The user's code                                |

```json
{
  "problemId": "uuid-1",
  "language": "javascript",
  "code": "function twoSum(nums, target) {\n  const map = {};\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (complement in map) return [map[complement], i];\n    map[nums[i]] = i;\n  }\n  return [];\n}"
}
```

### Response (202 Accepted)

```json
{
  "success": true,
  "message": "Code execution queued successfully",
  "data": {
    "id": "execution-uuid",
    "sessionId": "session-uuid",
    "operation": "run",
    "status": "queued",
    "createdAt": "2026-11-02T10:32:00.000Z"
  }
}
```

### Errors

| Status | Message                                    |
| ------ | ------------------------------------------ |
| 404    | Session not found                          |
| 404    | Session is not visible to the current user |
| 404    | Problem not found                          |
| 429    | Code execution rate limit exceeded         |
| 503    | Execution queue is unavailable             |

---

## 5. Submit Solution

Submit a solution for evaluation. This counts toward the daily solved limit. If all problem examples pass, the problem is marked as solved.

**Method:** `POST`
**Route:** `/coding/session/:sessionId/submit`
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param       | Type   | Description      |
| ----------- | ------ | ---------------- |
| `sessionId` | string | CodingSession ID |

### Request Body

| Field       | Type   | Required | Description                                    |
| ----------- | ------ | -------- | ---------------------------------------------- |
| `problemId` | string | yes      | Problem ID                                     |
| `language`  | string | yes      | `"javascript"` \| `"typescript"` \| `"python"` |
| `code`      | string | yes      | The user's code                                |

```json
{
  "problemId": "uuid-1",
  "language": "javascript",
  "code": "function twoSum(nums, target) {\n  const map = {};\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (complement in map) return [map[complement], i];\n    map[nums[i]] = i;\n  }\n  return [];\n}"
}
```

### Response (202 Accepted)

```json
{
  "success": true,
  "message": "Solution submission queued successfully",
  "data": {
    "id": "execution-uuid",
    "sessionId": "session-uuid",
    "operation": "submit",
    "status": "queued",
    "createdAt": "2026-11-02T10:32:00.000Z"
  }
}
```

### Errors

| Status | Message                                              |
| ------ | ---------------------------------------------------- |
| 400    | Validation failed                                    |
| 404    | Session not found                                    |
| 404    | Session is not visible to the current user           |
| 409    | Daily solved-problem limit reached                   |
| 409    | A submission for this problem is already in progress |
| 429    | Code execution rate limit exceeded                   |
| 503    | Execution queue is unavailable                       |

### Check execution status and retrieve its result

Read the durable state after queueing. Continue polling while the status is
`queued` or `running`. A completed run includes `result`; a completed submission
includes both `result` and the persisted `answer`. A terminal infrastructure
failure has status `failed` and a safe `failureMessage`.

**Method:** `GET`
**Route:** `/coding/session/:sessionId/executions/:executionId`
**Auth:** Bearer Token (session owner)

### Response (200 OK, queued example)

```json
{
  "success": true,
  "message": "Code execution fetched successfully",
  "data": {
    "id": "execution-uuid",
    "sessionId": "session-uuid",
    "problemId": "uuid-1",
    "operation": "submit",
    "language": "javascript",
    "status": "running",
    "result": null,
    "failureMessage": null,
    "createdAt": "2026-11-02T10:32:00.000Z",
    "startedAt": "2026-11-02T10:32:01.000Z",
    "completedAt": null,
    "answer": null
  }
}
```

The execution lookup is scoped by execution ID, session ID, and authenticated
user ID. A missing or foreign execution returns 404.

---

## 6. AI Code Review (Deferred; not implemented)

Request an AI-powered code review. This counts toward the daily AI review limit.

**Method:** `POST`
**Route:** `/coding/session/:sessionId/review`
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param       | Type   | Description      |
| ----------- | ------ | ---------------- |
| `sessionId` | string | CodingSession ID |

### Request Body

| Field       | Type   | Required | Description                   |
| ----------- | ------ | -------- | ----------------------------- |
| `answerId`  | string | yes      | The CodingAnswer ID to review |
| `problemId` | string | yes      | Problem ID (for context)      |

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

| Status | Message                    |
| ------ | -------------------------- |
| 400    | Validation failed          |
| 404    | Session not found          |
| 403    | Not session owner          |
| 404    | Answer not found           |
| 403    | Daily review limit reached |

---

## 7. Get Session Detail

Get a coding session with all submitted answers.

**Method:** `GET`
**Route:** `/coding/session/:sessionId`
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param       | Type   | Description      |
| ----------- | ------ | ---------------- |
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

| Status | Message           |
| ------ | ----------------- |
| 404    | Session not found |
| 403    | Not session owner |

---

## 8. Complete Session

Mark a coding session as completed.

**Method:** `POST`
**Route:** `/coding/session/:sessionId/complete`
**Auth:** Bearer Token (session owner)

### Path Parameters

| Param       | Type   | Description      |
| ----------- | ------ | ---------------- |
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

| Status | Message                   |
| ------ | ------------------------- |
| 404    | Session not found         |
| 403    | Not session owner         |
| 409    | Session already completed |

---

## 9. Get Session History

Get all past coding sessions for the current user.

**Method:** `GET`
**Route:** `/coding/sessions`
**Auth:** Bearer Token (any authenticated user)

### Query Parameters

| Param   | Type   | Required | Description                  |
| ------- | ------ | -------- | ---------------------------- |
| `page`  | number | no       | Page number (default: 1)     |
| `limit` | number | no       | Items per page (default: 20) |

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

## 10. Get Coding Stats (Deferred; not implemented)

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

| #   | Method | Route                                                | Description                                 |
| --- | ------ | ---------------------------------------------------- | ------------------------------------------- |
| 1   | `GET`  | `/coding/problems`                                   | List problems with optional filters         |
| 2   | `GET`  | `/coding/problems/:id`                               | Get problem detail with templates           |
| 3   | `POST` | `/coding/session/start`                              | Start a coding session                      |
| 4   | `POST` | `/coding/session/:sessionId/run`                     | Run code against examples (test)            |
| 5   | `POST` | `/coding/session/:sessionId/submit`                  | Submit solution (counts toward daily limit) |
| 6   | `GET`  | `/coding/session/:sessionId/executions/:executionId` | Get execution status/result                 |
| 7   | `POST` | `/coding/session/:sessionId/review`                  | Request AI code review                      |
| 8   | `GET`  | `/coding/session/:sessionId`                         | Get session detail with answers             |
| 9   | `POST` | `/coding/session/:sessionId/complete`                | Complete a session                          |
| 10  | `GET`  | `/coding/sessions`                                   | Get session history (paginated)             |
| 11  | `GET`  | `/coding/stats`                                      | Get daily coding stats and streak           |
