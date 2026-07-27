# Question Model — Implementation Spec

## Model Fields (MongoDB)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | ObjectId | auto | Auto-generated unique ID |
| `question` | String | yes | The question text |
| `topicId` | ObjectId | yes | Reference to Topic model |
| `difficulty` | String | yes | Junior / Mid / Senior |
| `referenceAnswer` | String? | no | Model answer for AI comparison |
| `createdAt` | DateTime | auto | Timestamp |
| `updatedAt` | DateTime | auto | Timestamp |

---

## APIs

### 1. POST /questions — Create Question (Admin Only)

**Auth:** Bearer Token + ADMIN role

**DTO:** `CreateQuestionDto`

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `question` | string | yes | `@IsString()`, `@IsNotEmpty()` |
| `topicId` | string | yes | `@IsString()`, `@IsNotEmpty()` |
| `difficulty` | string | yes | `@IsString()`, `@IsIn(['Junior', 'Mid', 'Senior'])` |
| `referenceAnswer` | string | no | `@IsOptional()`, `@IsString()` |

**File:** `dto/create-question.dto.ts`

**Service Method:** `createQuestion(dto: CreateQuestionDto)`

**Logic:**
1. Check if a question with the same text already exists for the same topic → throw ConflictException
2. Verify topicId exists in Topic collection → throw NotFoundException if not
3. Create question in MongoDB
4. Return created question

**Controller:** `POST /questions` → `@Roles('ADMIN')` → `@HttpCode(201)`

**Success Response:** `{ message: CREATE_QUESTION_SUCCESS, data: Question }`

---

### 2. GET /questions — Get Questions by Topic and Difficulty

**Auth:** Bearer Token (any logged-in user)

**DTO:** `GetQuestionsDto` (Query Params)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `topicId` | string | yes | `@IsNotEmpty()`, `@IsString()` |
| `difficulty` | string | yes | `@IsIn(['Junior', 'Mid', 'Senior'])`, `@IsString()` |

**File:** `dto/get-questions.dto.ts`

**Service Method:** `getQuestions(dto: GetQuestionsDto)`

**Logic:**
1. Validate difficulty is one of Junior/Mid/Senior → throw BadRequestException if invalid
2. Verify topicId exists in Topic collection → throw NotFoundException if not
3. Query `this.prisma.question.findMany({ where: { topicId, difficulty } })`
4. Return questions array

**Controller:** `GET /questions` → `@HttpCode(200)`

**Success Response:** `{ message: GET_QUESTIONS_SUCCESS, data: Question[] }`

---

### 3. GET /questions/:id — Get Question By ID

**Auth:** Bearer Token (any logged-in user)

**No DTO** — uses `@Param('id') id: string` directly in controller

**Service Method:** `getQuestionById(id: string)`

**Logic:**
1. Query `this.prisma.question.findUnique({ where: { id } })`
2. If not found → throw NotFoundException
3. Return question

**Controller:** `GET /questions/:id` → `@HttpCode(200)` → `@ApiParam({ name: 'id' })`

**Success Response:** `{ message: GET_QUESTION_SUCCESS, data: Question }`

---

### 4. PATCH /questions/:id — Update Question (Admin Only)

**Auth:** Bearer Token + ADMIN role

**DTO:** `UpdateQuestionDto` (Body)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `question` | string | no | `@IsOptional()`, `@IsString()` |
| `topicId` | string | no | `@IsOptional()`, `@IsString()` |
| `difficulty` | string | no | `@IsOptional()`, `@IsIn(['Junior', 'Mid', 'Senior'])` |
| `referenceAnswer` | string | no | `@IsOptional()`, `@IsString()` |

**File:** `dto/update-question.dto.ts`

**Service Method:** `updateQuestion(id: string, dto: UpdateQuestionDto)`

**Logic:**
1. Find question by id → throw NotFoundException if not found
2. If topicId is being changed, verify new topicId exists → throw NotFoundException if not
3. Update question with provided fields only
4. Return updated question

**Controller:** `PATCH /questions/:id` → `@Roles('ADMIN')` → `@HttpCode(200)`

**Success Response:** `{ message: UPDATE_QUESTION_SUCCESS, data: Question }`

---

### 5. DELETE /questions/:id — Delete Question (Admin Only)

**Auth:** Bearer Token + ADMIN role

**DTO:** None (uses `@Param('id')`)

**Service Method:** `deleteQuestion(id: string)`

**Logic:**
1. Find question by id → throw NotFoundException if not found
2. Delete question
3. Return void

**Controller:** `DELETE /questions/:id` → `@Roles('ADMIN')` → `@HttpCode(200)`

**Success Response:** `{ message: DELETE_QUESTION_SUCCESS }`

---

## Constants

### ApiOperation

| Key | Value |
|-----|-------|
| `QUESTION_GET_ALL` | Get all questions |
| `QUESTION_GET_BY_ID` | Get question by ID |
| `QUESTION_CREATE` | Create a new question |
| `QUESTION_UPDATE` | Update a question |
| `QUESTION_DELETE` | Delete a question |

### Success Messages

| Key | Value |
|-----|-------|
| `GET_QUESTIONS_SUCCESS` | Questions fetched successfully |
| `GET_QUESTION_SUCCESS` | Question fetched successfully |
| `CREATE_QUESTION_SUCCESS` | Question created successfully |
| `UPDATE_QUESTION_SUCCESS` | Question updated successfully |
| `DELETE_QUESTION_SUCCESS` | Question deleted successfully |

### Error Messages

| Key | Value |
|-----|-------|
| `QUESTION_NOT_FOUND` | Question not found |
| `QUESTION_ALREADY_EXISTS` | Question already exists for this topic |

---

## Files To Create/Modify

| File | Action |
|------|--------|
| `dto/create-question.dto.ts` | Create |
| `dto/get-questions.dto.ts` | Create |
| `dto/get-question-by-id.dto.ts` | Create |
| `dto/update-question.dto.ts` | Create |
| `dto/index.ts` | Update (export new DTOs) |
| `question.service.ts` | Create (5 methods) |
| `question.service.spec.ts` | Create (tests) |
| `question.controller.ts` | Create (5 endpoints) |
| `question.controller.spec.ts` | Create (tests) |
| `question.module.ts` | Create |

---

## Test Cases

### Service Tests

| Method | Test Cases |
|--------|------------|
| `createQuestion` | Creates successfully, throws ConflictException if duplicate, throws NotFoundException if invalid topicId |
| `getAllQuestions` | Returns all questions, filters by topicId, filters by difficulty, filters by both, returns empty array |
| `getQuestionById` | Returns question, throws NotFoundException if not found |
| `updateQuestion` | Updates successfully, throws NotFoundException if not found, throws NotFoundException if invalid topicId |
| `deleteQuestion` | Deletes successfully, throws NotFoundException if not found |

### Controller Tests

| Method | Test Cases |
|--------|------------|
| `createQuestion` | Returns success with message, throws ConflictException |
| `getAllQuestions` | Returns all questions, filters work, returns empty array |
| `getQuestionById` | Returns question by id, throws NotFoundException |
| `updateQuestion` | Returns success with message, throws NotFoundException |
| `deleteQuestion` | Returns success with message, throws NotFoundException |
