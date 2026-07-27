# Health — API Specification

Base URL: `http://localhost:3000/api/v1/health`

Public endpoint — no authentication required.

---

## 1. Health Check

**Method:** `GET`
**Route:** `/health`
**Auth:** None (`@Public()`)

### Response (200 OK)

```json
{
  "status": "ok"
}
```

---

## Summary

| # | Method | Route | Description | Auth |
|---|--------|-------|-------------|------|
| 1 | `GET` | `/health` | Server health check | None |
