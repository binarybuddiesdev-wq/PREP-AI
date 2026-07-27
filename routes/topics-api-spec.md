# Topics Module — API Specification

Base URL: `http://localhost:3000/api/v1/topics`

All endpoints require Bearer token authentication (Clerk).

---

## 1. Create Topic

**Method:** `POST`
**Route:** `/topics`
**Auth:** Bearer Token + ADMIN role

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name (e.g. "React") |
| `slug` | string | yes | URL-safe slug (e.g. "react") |
| `category` | string | yes | Category group (e.g. "Frontend", "Backend") |
| `icon` | string | no | Icon identifier |

```json
{
  "name": "React",
  "slug": "react",
  "category": "Frontend"
}
```

### Response (201 Created)

```json
{
  "success": true,
  "message": "Topic created successfully",
  "data": {
    "id": "667f8a1b2c3d4e5f6a7b8c9d",
    "name": "React",
    "slug": "react",
    "category": "Frontend",
    "icon": null,
    "createdAt": "2026-07-25T10:00:00.000Z",
    "updatedAt": "2026-07-25T10:00:00.000Z"
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 409 | Topic with this name or slug already exists |

---

## 2. Get All Topics

**Method:** `GET`
**Route:** `/topics`
**Auth:** Bearer Token (any authenticated user)

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | no | Filter by category (e.g. "Frontend") |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Topics fetched successfully",
  "data": [
    {
      "id": "667f8a1b2c3d4e5f6a7b8c9d",
      "name": "React",
      "slug": "react",
      "category": "Frontend",
      "icon": null
    }
  ]
}
```

---

## 3. Get Topic by Slug

**Method:** `GET`
**Route:** `/topics/:slug`
**Auth:** Bearer Token (any authenticated user)

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `slug` | string | Topic slug (e.g. "react") |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Topic fetched successfully",
  "data": {
    "id": "667f8a1b2c3d4e5f6a7b8c9d",
    "name": "React",
    "slug": "react",
    "category": "Frontend",
    "icon": null
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 404 | Topic not found |

---

## 4. Update Topic

**Method:** `PATCH`
**Route:** `/topics/:id`
**Auth:** Bearer Token + ADMIN role

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | MongoDB ObjectId |

### Request Body (all fields optional)

```json
{
  "name": "React.js",
  "icon": "react-icon"
}
```

### Response (200 OK)

```json
{
  "success": true,
  "message": "Topic updated successfully",
  "data": {
    "id": "667f8a1b2c3d4e5f6a7b8c9d",
    "name": "React.js",
    "slug": "react",
    "category": "Frontend",
    "icon": "react-icon"
  }
}
```

### Errors

| Status | Message |
|--------|---------|
| 404 | Topic not found |
| 409 | Slug already taken |

---

## 5. Delete Topic

**Method:** `DELETE`
**Route:** `/topics/:id`
**Auth:** Bearer Token + ADMIN role

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | MongoDB ObjectId |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Topic deleted successfully"
}
```

### Errors

| Status | Message |
|--------|---------|
| 404 | Topic not found |
| 400 | Cannot delete topic with existing questions |

---

## Summary

| # | Method | Route | Description | Auth | Role |
|---|--------|-------|-------------|------|------|
| 1 | `POST` | `/topics` | Create topic | Bearer | ADMIN |
| 2 | `GET` | `/topics` | List topics (optional `?category=` filter) | Bearer | Any |
| 3 | `GET` | `/topics/:slug` | Get topic by slug | Bearer | Any |
| 4 | `PATCH` | `/topics/:id` | Update topic | Bearer | ADMIN |
| 5 | `DELETE` | `/topics/:id` | Delete topic | Bearer | ADMIN |

## Model (MongoDB)

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
