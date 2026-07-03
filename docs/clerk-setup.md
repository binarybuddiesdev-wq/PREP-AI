# Clerk Authentication Setup

## Prerequisites

1. Create a free account at [clerk.com](https://clerk.com)
2. Create a new Application in the Clerk Dashboard

---

## Step 1: Get API Keys

1. Go to **Clerk Dashboard** → Left sidebar → **API Keys**
2. You'll see two keys:

| Key | Value | Where to use |
|-----|-------|--------------|
| **Publishable Key** | `pk_test_xxx...` | Frontend (`VITE_CLERK_PUBLISHABLE_KEY`) |
| **Secret Key** | `sk_test_xxx...` | Backend (`CLERK_SECRET_KEY`) |

3. Copy both values into your `.env` file

---

## Step 2: Get Webhook Signing Secret

1. Go to **Clerk Dashboard** → Left sidebar → **Webhooks**
2. Click **Add Endpoint**
3. Fill in:
   - **Endpoint URL**: `http://localhost:3000/api/v1/webhooks/clerk`
   - **Description**: `PrepAI Backend`
4. Under **Events**, select:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Click **Create**
6. After creation, click on the webhook → copy the **Signing Secret**
7. Add it to your `.env` as `CLERK_WEBHOOK_SECRET`

---

## Step 3: Enable Social Providers (Optional)

To enable Google, GitHub, LinkedIn login:

1. Go to **Clerk Dashboard** → Left sidebar → **User & Authentication** → **Social Connections**
2. Enable the providers you want:
   - **Google** — Click configure → Create OAuth credentials in Google Cloud Console
   - **GitHub** — Click configure → Create OAuth App in GitHub Settings
   - **LinkedIn** — Click configure → Create App in LinkedIn Developer Portal
3. Each provider will give you a **Client ID** and **Client Secret** — enter these in Clerk

---

## Final .env Configuration

```env
# Clerk
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

---

## How It Works

```
User signs up on frontend (Clerk SDK)
        │
        ▼
Clerk handles auth (email/password, Google, GitHub, LinkedIn)
        │
        ▼
Clerk fires webhook: POST /api/v1/webhooks/clerk
        │
        ▼
Backend verifies webhook signature (svix)
        │
        ▼
Backend creates/updates/deletes User in MongoDB
```

---

## Testing the Webhook Locally

### Using curl (development mode)

Start your server, then run:

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/clerk \
  -H "Content-Type: application/json" \
  -H "svix-id: test_msg_123" \
  -H "svix-timestamp: 1234567890" \
  -H "svix-signature: v1,test_signature" \
  -d '{
    "type": "user.created",
    "data": {
      "id": "clerk_test_user_123",
      "email_addresses": [{"email_address": "test@example.com"}],
      "first_name": "Test",
      "last_name": "User",
      "image_url": null
    }
  }'
```

> **Note**: In production, the signature is verified. For local testing, you need a valid signing secret or use Clerk's test environment.

### Using Clerk's Test Webhooks

1. In Clerk Dashboard → Webhooks → click your endpoint
2. Go to **Testing** tab
3. Send test events directly from the dashboard
