# Real Integrations Guide: Stripe Payments & Resend Emails

This guide details how to transition the shipping system from local simulation mode to real integrations using **Stripe (Test Mode)** for payment processing and **Resend (Free Tier)** for real-time customer email notifications.

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
