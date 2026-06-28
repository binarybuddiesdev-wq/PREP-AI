# PrepAI Backend Service

AI-powered interview preparation backend built with NestJS and Fastify. It integrates Mastra LLM agents with NVIDIA NIM to generate adaptive questions and evaluate user responses.

![Swagger API Documentation](c:/antigravity-test/PrepAI/server/public/swagger.png)

---

## Tech Stack & Tooling

- **Framework**: NestJS (v11) with Fastify adapter for high performance.
- **Language**: TypeScript (v6) in Strict mode.
- **ORM & Databases**: 
  - Prisma (v6)
  - MongoDB (Users, Topics, Questions, Chats)
  - PostgreSQL (Practice Sessions, Answers)
- **AI Agent Orchestration**: Mastra (v1) with `@ai-sdk/openai` calling NVIDIA NIM `llama-3.3-nemotron-super-49b-v1.5`.
- **Validation**: Zod (runtime validation) + class-validator/class-transformer.
- **Security**: Fastify Helmet (CSP, secure headers), Fastify CORS, and Fastify Rate Limit.
- **Authentication**: Clerk Node SDK.

---

## Development Setup

### Prerequisites
- Node.js v18+
- pnpm v9+

### Installation & Run
1. Install server dependencies:
   ```bash
   pnpm install
   ```
2. Start the dev server in watch mode:
   ```bash
   pnpm start:dev
   ```
   *Note: This runs Node natively with `--import @swc-node/register/esm-register` and `--env-file=../.env` to support TypeScript decorators and load environment keys early.*

---

## API Routes Specification

All endpoint paths are prefixed with `/api/v1`.

### 1. Health Checks
#### `GET /api/v1/health`
Checks backend and database connectivity.
* **Authentication**: None (Public)
* **Response (200 OK)**:
  ```json
  {
    "status": "ok"
  }
  ```

### 2. Tech Expert Assistant (AI)
#### `POST /api/v1/tech-expert`
Submits a technology query to the AI Tech Expert agent.
* **Authentication**: None (Public in dev)
* **Request Body** (`application/json`):
  * `question` (string, required): The question to ask.
  ```json
  {
    "question": "Explain the difference between REST and GraphQL APIs."
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "data": {
      "answer": {
        "topic": "REST vs GraphQL",
        "summary": "REST and GraphQL are two API standards. REST uses resource-based URLs and standard HTTP verbs, while GraphQL provides a single endpoint for dynamic client queries.",
        "keyPoints": [
          "REST uses multiple resource-specific endpoints.",
          "GraphQL fetches exact requested fields in a single query.",
          "REST relies on HTTP caching; GraphQL requires custom query caching."
        ],
        "examples": [
          "GET /api/v1/users/1",
          "query { user(id: 1) { name email } }"
        ],
        "relatedTopics": [
          "OpenAPI",
          "Apollo Client",
          "gRPC"
        ]
      },
      "rawResponse": "..."
    },
    "error": null,
    "meta": {}
  }
  ```
* **Validation Error (400 Bad Request)**:
  ```json
  {
    "statusCode": 400,
    "message": "Validation failed",
    "error": "Bad Request",
    "meta": {
      "errors": {
        "question": {
          "_errors": ["Question must not be empty"]
        }
      }
    }
  }
  ```

---

## Planned API Specifications (Future Modules)

- **`POST /api/v1/auth/login`**: Authenticate and return credentials.
- **`POST /api/v1/auth/logout`**: Terminate session.
- **`GET /api/v1/users/me`**: Get authenticated user profile.
- **`PATCH /api/v1/users/me`**: Update user profile preferences/metadata.
- **`GET /api/v1/topics`**: Retrieve list of topics.
- **`POST /api/v1/questions/generate`**: Generate a new question using AI based on a topic.
- **`POST /api/v1/sessions/start`**: Start a new practice test session.
- **`POST /api/v1/sessions/:id/complete`**: Finalize and grade a practice test session.
- **`POST /api/v1/answers/submit`**: Submit user answer for evaluation and grading.
- **`GET /api/v1/analytics`**: Retrieve performance metrics, history trends, and strength charts.
- **`POST /api/v1/chatbot`**: Talk to the general AI study chatbot.
