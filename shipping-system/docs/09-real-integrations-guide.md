# Real Integrations Guide: Stripe, Resend & Clerk Authentication

This guide details how to transition the shipping system from local simulation mode to real integrations using **Stripe (Test Mode)** for payment processing, **Resend (Free Tier)** for real-time customer email notifications, and **Clerk** for user authentication at the API Gateway.

---

## 1. Stripe Real Integration (Test Mode)

To enable real credit card payments in the browser and receive verified webhooks:

### Step 1: Obtain Stripe Keys
1. Sign up for a free developer account at [Stripe](https://stripe.com).
2. Go to the Developer Dashboard and toggle **Test Mode** on.
3. Retrieve your **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`).

### Step 2: Configure Webhook Forwarding
Since your local API Gateway runs on `localhost:3000`, the public Stripe servers cannot send webhooks directly to your computer. You must use the **Stripe CLI** to tunnel events:

1. Install the Stripe CLI or run it via Docker:
   ```bash
   # Using docker to listen and forward webhooks
   docker run --rm -it --ipc=host --net=host stripe/stripe-cli:latest listen --forward-to localhost:3000/payments/webhook
   ```
2. The command will output a webhook signing secret starting with `whsec_...` (e.g., `whsec_4683e845...`).
3. Keep this terminal window open; it forwards events in real time.

### Step 3: Update `.env` Configuration
Open your `.env` file and replace the placeholders:
```ini
STRIPE_SECRET_KEY=sk_test_your_real_test_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_real_stripe_cli_webhook_secret_here
```
*Restart your Docker Compose containers to apply the changes:*
```bash
docker compose down && docker compose up -d
```

### Step 4: Verify the Payment Flow
1. Create a prepaid order using a client like Postman or `curl`:
   ```bash
   curl -s -X POST http://localhost:3000/orders \
     -H "Content-Type: application/json" -H "Idempotency-Key: real-test-1" \
     -d '{
       "sender": {"name":"Alice","phone":"+84900000001","address":"1 Alice St","region_code":"REG-100"},
       "recipient": {"name":"Bob","phone":"+84911111112","address":"2 Bob St","region_code":"REG-101"},
       "parcels": [{"declared_weight_grams":500,"type":"parcel"}],
       "payment_type": "PREPAID_STRIPE"
     }'
   ```
2. Trigger the checkout session to get a payment URL:
   ```bash
   curl -s -X POST http://localhost:3000/orders/{SHIPMENT_ORDER_ID}/checkout
   ```
3. Open the returned URL (e.g. `https://checkout.stripe.com/c/pay/...`) in your browser.
4. Complete the checkout using Stripe's test credit card (Card number: `4242 4242 4242 4242`, Expiry: any future date, CVC: any 3 digits).
5. After payment, verify in the terminal that the Stripe CLI forwards the webhook and the status projection transitions the order to `Confirmed`.

---

## 2. Resend Email Integration (Free Tier)

The Notification service already ships with two real mail adapters behind the `IEmailProvider` port (`apps/notification/src/ports/email-provider.port.ts`):

- `apps/notification/src/adapters/resend-email.adapter.ts` — Resend HTTP API
- `apps/notification/src/adapters/sendgrid-email.adapter.ts` — SendGrid v3 HTTP API

Both call the provider's REST endpoint through Node's built-in `fetch` — **no SDK dependency is installed or needed**. The factory in `apps/notification/src/notification.module.ts` selects the adapter from the environment at boot, in priority order:

1. `RESEND_API_KEY` set → `ResendEmailAdapter`
2. else `SENDGRID_API_KEY` set → `SendGridEmailAdapter`
3. else → `LoggingEmailAdapter` (the `[EMAIL EMULATOR]` log-only default)

So enabling Resend is configuration only — no code changes.

### Step 1: Obtain a Resend API Key
1. Sign up for a free developer account at [Resend](https://resend.com) (no credit card or domain required).
2. Go to API Keys in the dashboard and create a new key with **Sending** permissions.
3. Retrieve your key starting with `re_...`.

### Step 2: Update `.env` Configuration
```ini
RESEND_API_KEY=re_your_real_resend_api_key_here
RESEND_TO_EMAIL=your_resend_account_email@example.com
# Optional; defaults to onboarding@resend.dev when unset
# RESEND_FROM_EMAIL=onboarding@resend.dev
```

Notes:
- Without a verified custom domain, Resend only sends **from** `onboarding@resend.dev` (the adapter's default) and only **to your own Resend account email** — any other recipient is rejected with a 403.
- The recipient is a fixed env var because domain events carry no customer email (PII is encrypted at rest), so `IEmailProvider.send()` takes only a reference ID, subject, and body.
- A failed send is logged and dropped by `NotificationService` per BR-09 — it never blocks or retries the triggering event.

### Step 3: Rebuild and Restart the Notification Container
The container bakes the compiled app into its image, so restarting alone is not enough after code changes; after `.env`-only changes a plain `up -d notification` recreates the container with the new env:

```bash
docker compose up -d --build notification
```

### Step 4: Verify the Integration
1. (Optional) Smoke-test the credentials directly, bypassing the app:
   ```bash
   curl -s -w '\nHTTP %{http_code}\n' https://api.resend.com/emails \
     -H "Authorization: Bearer $RESEND_API_KEY" \
     -H "Content-Type: application/json" \
     -d "{\"from\":\"onboarding@resend.dev\",\"to\":[\"$RESEND_TO_EMAIL\"],\"subject\":\"Smoke test\",\"text\":\"It works.\"}"
   ```
   Expect `HTTP 200` and a JSON body with an `id`.
2. Create an order through the gateway (see the Stripe section's `curl` above, or run `pnpm demo`).
3. Confirm the adapter fired:
   ```bash
   docker logs shipping_notification | grep Resend
   # [ResendEmailAdapter] Email sent via Resend for ref <shipment_order_id>
   ```
4. Check your inbox (including spam — mail from `onboarding@resend.dev` is often flagged) for the `Order Created: ...` email.

Mind the free-tier limits (100 emails/day, 2 requests/second): a full `pnpm demo` run fires one real email per notification event.

---

## 3. Clerk Authentication Integration

To secure the API Gateway endpoints using **Clerk** and enable JWT session token verification:

### Step 1: Obtain Clerk API Keys
1. Sign up for a free developer account at [Clerk](https://clerk.com).
2. Create an application in the Clerk Dashboard.
3. Under **API Keys** in the navigation sidebar, copy your **Secret Key** (`sk_test_...`) and **Publishable Key** (`pk_test_...`).

### Step 2: Update `.env` Configuration
Open your `.env` file and append the Clerk credentials (also documented in your local `.env` and `.env.example` templates):
```ini
# Clerk Authentication (task: API Gateway session verification)
CLERK_SECRET_KEY=sk_test_your_real_clerk_secret_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_real_clerk_publishable_key_here
```
> [!NOTE]
> The API Gateway uses `CLERK_SECRET_KEY` to retrieve Clerk's JSON Web Key Set (JWKS) and verify the signature of incoming session tokens.

### Step 3: Fetch a Session Token from Clerk (Client-Side)
To call any protected gateway route, your client application must fetch a short-lived JWT session token from the Clerk Frontend SDK.
*   **Javascript / React Example**:
    ```javascript
    // Retrieve the session token from the Clerk client
    const token = await window.Clerk.session.getToken();
    ```

### Step 4: Make Authenticated Requests
All requests to the API Gateway must include this session token in the `Authorization` header, except for designated public routes.

*   **Public Routes (Bypass Clerk Auth)**:
    *   `GET /health` (Gateway healthcheck probe)
    *   `GET /api/docs*` (Swagger API Documentation)
    *   `POST /payments/webhook` (Stripe webhook, authenticated using `Stripe-Signature` validation in the Order Service)
*   **Protected Routes** (e.g. `/orders`, `/tracking`, `/couriers`, `/hubs`, `/trips`, `/legs`):
    *   Include the header `Authorization: Bearer <CLERK_JWT_SESSION_TOKEN>`.
    
Example request to create an order:
```bash
curl -s -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer cl_jwt_session_token_here" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: auth-test-1" \
  -d '{
    "sender": {"name":"Alice","phone":"+84900000001","address":"1 Alice St","region_code":"REG-100"},
    "recipient": {"name":"Bob","phone":"+84911111112","address":"2 Bob St","region_code":"REG-101"},
    "parcels": [{"declared_weight_grams":500,"type":"parcel"}],
    "payment_type": "PREPAID_STRIPE"
  }'
```

### Step 5: Consume Auth Context in Downstream Microservices
The API Gateway's [ProxyService](file:///home/dunguyen/Training/nestjs/shipping-system/apps/api-gateway/src/proxy/proxy.service.ts) acts as a trusted proxy. Once it verifies the Clerk token, it forwards the verified user identity to downstream microservices using custom HTTP headers:
*   `x-user-id` (The Clerk `userId`/`sub` claim)
*   `x-session-id` (The Clerk `sessionId`/`sid` claim)

Backend microservices can read these headers directly (e.g. `req.headers['x-user-id']`) to check roles or log user actions, without needing to integrate Clerk SDKs or parse JWTs themselves.
