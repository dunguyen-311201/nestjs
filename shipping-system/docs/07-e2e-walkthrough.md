# End-to-End Workflow Walkthrough

Every command below was run for real against the dockerized stack (task 7.1)
and the output shown is the actual captured output, not a mock-up. All
requests go through the **API Gateway** (`localhost:3000`) — per task 7.1's
reverse proxy, that's the only port a real client should ever call; the other
per-service ports (3001/3003/3004/3005/3006/3007) are shown only where the
walkthrough needs to inspect a service directly (e.g. calling the payment
webhook on `order`'s own port to compare against the gateway-proxied call).

This walkthrough supersedes the older, narrower
[`docs/reference/supporter-presentation-2026-07-13.md`](reference/supporter-presentation-2026-07-13.md)
(pre-dates Dispatcher, Notification, and Docker — order→payment→one scan
event only). That file stays as archived provenance; this doc is current.

## Prerequisites

```bash
cp .env.example .env   # fill in PII_ENCRYPTION_KEY (see the comment in the file)
docker compose up -d   # brings up postgres, redis, nats, and all 8 apps
```

Confirm every HTTP app is healthy:
```bash
for port in 3000 3001 3003 3004 3005 3006 3007; do
  echo "port $port: $(curl -s http://localhost:$port/health)"
done
```
All seven should return `{"status":"ok"}`. `notification` (task 6.6) has no
HTTP port — it's a pure NATS consumer; check it's alive via `docker compose
logs notification` for a `Nest microservice successfully started` line.

**Authentication (added in Phase 9, after this walkthrough was captured):**
every gateway route except `/health`, the Swagger docs, and
`POST /payments/webhook` now requires a Clerk session JWT
(`Authorization: Bearer <token>`) — the curl commands below were captured
before that and omit the header; add it when re-running them. Get a 1h test
token per role from the `apps/web` panel (`http://localhost:5173`,
"Get 1h test token"). RBAC (403 per role) and per-actor ownership are
demonstrated in [Per-actor authorization matrix](#per-actor-authorization-matrix-phase-10)
below.

Seed data (`db/init-db.sql`'s `docker-entrypoint-initdb.d` mount, populated by
`generate_seed.py`) already provides zones, hubs, routes, drivers, trucks,
and couriers. This walkthrough uses `Hub-REG-100` (origin) and `Hub-REG-101`
(destination), which the seeded `ROUTE` table connects directly — using this
region-code pair for sender/recipient means the created parcel's `route_id`
matches a real route, so the flow below never trips the BR-02 misrouted
guard by accident.

## UC-02 — Create an order

```bash
curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" -H "Idempotency-Key: e2e-$(date +%s)" \
  -d '{
    "sender": {"name":"Alice Nguyen","phone":"0900000001","address":"1 Alice St, Hanoi","region_code":"REG-100"},
    "recipient": {"name":"Bob Tran","phone":"0911111112","address":"2 Bob St, HCM","region_code":"REG-101"},
    "parcels": [{"declared_weight_grams":500,"type":"parcel"}],
    "payment_type": "PREPAID_STRIPE"
  }'
```
```json
{"shipment_order_id":"568dffd9-9018-4e10-86ce-d9b662426675","price_cents":2809,"expected_delivery_at":"2026-07-17T03:56:36.596Z","status":"Created"}
```
Price/ETA are locked from a real rate-card lookup (BR-01), an
`Idempotency-Key` is required (missing → `400`), and the order+parcel insert
+ outbox row all happen in one DB transaction (Transactional Outbox
pattern). Confirmed published within ~1s:
```bash
docker exec -i shipping_postgres psql -U postgres -d postgres -t -c \
  "SELECT status, published_at FROM shipping_order_db.outbox WHERE payload::text LIKE '%568dffd9-9018-4e10-86ce-d9b662426675%' ORDER BY created_at DESC LIMIT 1;"
```
```
PUBLISHED | 2026-07-15 03:56:36.997
```

Grab the parcel id for later steps:
```bash
docker exec -i shipping_postgres psql -U postgres -d postgres -t -c \
  "SELECT id, route_id, state FROM shipping_order_db.parcel WHERE shipment_order_id='568dffd9-9018-4e10-86ce-d9b662426675';"
```
```
0f6939d9-cb97-4b06-b5b3-fe51206e0718 | cbd38a06-6dcb-40c5-a68b-5cb4c22f2b49 | Created
```

## UC-04 — Check tracking (before payment)

```bash
curl -s http://localhost:3000/tracking/568dffd9-9018-4e10-86ce-d9b662426675 | python3 -m json.tool
```
```json
{
    "shipment_order_id": "568dffd9-9018-4e10-86ce-d9b662426675",
    "status": null,
    "parcels": [{"parcel_id": "0f6939d9-cb97-4b06-b5b3-fe51206e0718", "state": "Created", "timeline": []}]
}
```
`status: null` is a documented transient state (order exists, the async
status projection hasn't run yet), not a bug.

## UC-03 — Pay for it (Stripe Checkout + webhook)

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/orders/568dffd9-9018-4e10-86ce-d9b662426675/checkout
```
```
{"statusCode":401,"message":"Invalid API Key provided: sk_test_***...lder"}
HTTP 401
```
This reaches the *real* Stripe API and only fails because `.env` uses a
placeholder key — it proves the integration is wired correctly up to the
network boundary. Put a real Stripe test-mode key in `.env` to see a real
`checkout_url` instead.

Simulate what Stripe's webhook sends on a completed checkout (a validly
signed test event, no real Stripe account needed) — note this goes through
the **gateway**, which forwards the raw, unparsed request body byte-for-byte
(task 7.1's `bodyParser: false` fix), so Stripe's signature still verifies
correctly on the far side:
```bash
SECRET=$(grep '^STRIPE_WEBHOOK_SECRET=' .env | cut -d= -f2-)   # must match exactly, including any trailing text after a `#` — dotenv only treats `#` as a comment when preceded by whitespace
node -e "
const Stripe = require('stripe');
const payload = JSON.stringify({
  id: 'evt_e2e_' + Date.now(),
  type: 'checkout.session.completed',
  data: { object: { client_reference_id: '568dffd9-9018-4e10-86ce-d9b662426675', payment_intent: 'pi_e2e_1', payment_status: 'paid' } }
});
const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: '$SECRET' });
console.log(payload); console.log(header);
" > /tmp/webhook.txt
PAYLOAD=$(sed -n '1p' /tmp/webhook.txt); SIG=$(sed -n '2p' /tmp/webhook.txt)
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/payments/webhook \
  -H "Content-Type: application/json" -H "Stripe-Signature: $SIG" --data-raw "$PAYLOAD"
```
```
HTTP 200
```
```bash
docker exec -i shipping_postgres psql -U postgres -d postgres -t -c \
  "SELECT status FROM shipping_order_db.payment WHERE shipment_order_id='568dffd9-9018-4e10-86ce-d9b662426675';"
docker exec -i shipping_postgres psql -U postgres -d postgres -t -c \
  "SELECT status FROM shipping_order_db.shipment_order WHERE id='568dffd9-9018-4e10-86ce-d9b662426675';"
```
```
Paid
Confirmed
```
BR-08's gate just cleared — hub inbound and first-mile pickup are now
unblocked for this order.

## UC-05 — Courier pickup scan

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/couriers/legs/0f6939d9-cb97-4b06-b5b3-fe51206e0718/pickup \
  -H "Content-Type: application/json" -H "Idempotency-Key: e2e-pickup-$(date +%s)" \
  -d '{"courier_id":"b578dcfe-0b3e-4f4b-9acf-b5e3e35ca36f"}'
```
```
{"status":"recorded"}
HTTP 201
```
`PARCEL.state: Created → InTransit` (confirmed via `psql`).

## UC-07 — Origin hub receive scan

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/hubs/9befa823-dd9a-440c-bb9c-52f97946e64c/receive \
  -H "Content-Type: application/json" -H "Idempotency-Key: e2e-hub1-$(date +%s)" \
  -d '{"parcel_id":"0f6939d9-cb97-4b06-b5b3-fe51206e0718","actual_weight_grams":510}'
```
```
{"status":"recorded"}
HTTP 201
```
`PARCEL.state: InTransit → InHub`. No `linehaul_trip_id` in the body means
Hub Service treats this as the origin scan (`parcel.hub_received`).

## UC-09 / UC-08 / UC-11 — Line-haul trip + Dispatcher assignment

```bash
curl -s -X POST http://localhost:3000/trips \
  -H "Content-Type: application/json" -H "Idempotency-Key: e2e-trip-$(date +%s)" \
  -d '{"origin_hub_id":"9befa823-dd9a-440c-bb9c-52f97946e64c","dest_hub_id":"bd332ddb-dfe6-4f3f-aaa8-5a4519435471"}'
```
```json
{"trip_id":"11c1cd57-9c0e-4dc6-898c-00aa9649b177"}
```
```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/trips/11c1cd57-9c0e-4dc6-898c-00aa9649b177/assign \
  -H "Content-Type: application/json" -H "Idempotency-Key: e2e-assign-$(date +%s)" \
  -d '{"driver_id":"81911218-e523-4689-a660-2c72d9864b82","truck_id":"d85c64fa-d8e7-42d1-9124-297c73be96a8"}'
```
```
{"status":"recorded"}
HTTP 201
```
This request is routed by the gateway's `/trips/{id}/assign` regex rule
(task 7.1/6.5) to **Dispatcher**, not Line-haul, even though both services
share the `/trips` prefix. Dispatcher writes `driver_id`/`truck_id` directly
onto `LINEHAULTRIP` — an in-schema write, since Dispatcher and Line-haul
share `shipping_network_db` (ADR-003).

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/trips/11c1cd57-9c0e-4dc6-898c-00aa9649b177/depart \
  -H "Content-Type: application/json" -H "Idempotency-Key: e2e-depart-$(date +%s)" -d '{}'
```
```
{"status":"recorded"}
HTTP 201
```
This flips `LINEHAULTRIP.status → Departed`. It does **not** move
`PARCEL.state` — see the gap noted below.

## UC-07 — Destination hub receive scan

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/hubs/bd332ddb-dfe6-4f3f-aaa8-5a4519435471/receive \
  -H "Content-Type: application/json" -H "Idempotency-Key: e2e-hub2-$(date +%s)" \
  -d '{"parcel_id":"0f6939d9-cb97-4b06-b5b3-fe51206e0718","linehaul_trip_id":"11c1cd57-9c0e-4dc6-898c-00aa9649b177"}'
```
```
{"status":"recorded"}
HTTP 201
```
Hub Service published `parcel.arrived_at_hub` successfully — Tracking
appended the scan event (see the timeline below), but **Order's own FSM
rejected it**:
```
[ParcelEventConsumer] Dropped parcel.arrived_at_hub for parcel 0f6939d9-...: No valid transition from InHub on event ARRIVED_AT_HUB
```

## UC-06 — Courier delivery attempt

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/couriers/legs/0f6939d9-cb97-4b06-b5b3-fe51206e0718/deliver \
  -H "Content-Type: application/json" -H "Idempotency-Key: e2e-deliver-$(date +%s)" \
  -d '{"courier_id":"b578dcfe-0b3e-4f4b-9acf-b5e3e35ca36f","outcome":"DELIVERED","signature_url":"https://example.com/sig.png"}'
```
```
{"status":"recorded","proof_of_delivery_id":"21f4ee0e-feee-4fdd-90ff-310c924aedc5"}
HTTP 201
```
`PROOF_OF_DELIVERY` was written and `parcel.delivered` was published (see
Notification's log below) — Courier's own guard only checks the parent
order's status (BR-08), not `PARCEL.state`. Order's FSM rejected this one
too, for the same reason as the previous step:
```
[ParcelEventConsumer] Dropped parcel.delivered for parcel 0f6939d9-...: No valid transition from InHub on event DELIVERED
```

## Known gap found while writing this walkthrough (fixed in task 7.3)

> **Update (task 7.3)**: this gap is now closed. `POST /trips/{id}/depart`
> (Line-haul) publishes `parcel.loaded_for_linehaul` per parcel, and
> `POST /legs/{id}/assign` (Dispatcher) publishes `parcel.out_for_delivery`.
> The full sequence below now genuinely reaches `Delivered` — verified by
> the automated integration test at
> `apps/api-gateway/src/happy-path.integration.spec.ts`
> (`RUN_INTEGRATION_TEST=true`). The section below is left as originally
> written for historical accuracy (it was true when this doc was written,
> during task 7.2) — see `TASKS.md`'s 7.3 entry for the fix details.

**`PARCEL.state` cannot currently reach `Delivered` through the full
multi-hub flow.** The state machine requires
`InHub --DEPARTED_LINEHAUL--> InTransit --ARRIVED_AT_HUB--> InHub` before
`OUT_FOR_DELIVERY`/`DELIVERED` become valid — but **no built service ever
publishes `parcel.loaded_for_linehaul` or `parcel.out_for_delivery`**
(confirmed: both subjects exist in `libs/contracts`/`NATS_SUBJECTS` and have
registered consumers in Order and Tracking, but zero producers anywhere in
`apps/hub`, `apps/linehaul`, `apps/dispatcher`, or `apps/courier`). Line-haul's
`/trips/{id}/depart` only flips the trip's own `LINEHAULTRIP.status` — it
has no per-parcel effect, consistent with `CLAUDE.md`'s SCOPE cutting
bags/manifests (there is no mechanism to associate a specific parcel with a
specific trip in this schema). Hub Service's destination-scan branch
publishes `ARRIVED_AT_HUB` directly, skipping the intermediate
`DEPARTED_LINEHAUL` transition Order's FSM requires.

**What still works despite this**: Tracking's timeline (BR-03, append-only)
records every scan event unconditionally, regardless of whether Order's
parallel FSM accepted it — this is by design, not a bug (Tracking and Order
are independent consumers of the same events). Courier's delivery guard
(BR-08) and Notification (BR-09) also don't depend on `PARCEL.state`, so
`PROOF_OF_DELIVERY` and the delivery email both fire correctly even though
`PARCEL.state` is stuck at `InHub`.

**Not fixed as part of this task** — task 7.2 is documentation only; this is
flagged here for a follow-up task (likely touching Hub Service's transit-scan
event choice, or Line-haul's `/depart` endpoint) rather than fixed silently
mid-walkthrough.

## Final tracking check

```bash
curl -s http://localhost:3000/tracking/568dffd9-9018-4e10-86ce-d9b662426675 | python3 -m json.tool
```
```json
{
    "shipment_order_id": "568dffd9-9018-4e10-86ce-d9b662426675",
    "status": "Active",
    "parcels": [
        {
            "parcel_id": "0f6939d9-cb97-4b06-b5b3-fe51206e0718",
            "state": "InHub",
            "timeline": [
                {"event_type": "HUB_RECEIVE", "created_at": "2026-07-15T03:58:07.114Z", "hub_id": "9befa823-dd9a-440c-bb9c-52f97946e64c", "courier_id": null, "linehaul_trip_id": null},
                {"event_type": "PICKUP", "created_at": "2026-07-15T03:59:28.302Z", "hub_id": null, "courier_id": "b578dcfe-0b3e-4f4b-9acf-b5e3e35ca36f", "linehaul_trip_id": null},
                {"event_type": "HUB_RECEIVE", "created_at": "2026-07-15T03:59:37.710Z", "hub_id": "9befa823-dd9a-440c-bb9c-52f97946e64c", "courier_id": null, "linehaul_trip_id": null},
                {"event_type": "ARRIVED_AT_HUB", "created_at": "2026-07-15T04:00:45.802Z", "hub_id": "bd332ddb-dfe6-4f3f-aaa8-5a4519435471", "courier_id": null, "linehaul_trip_id": "11c1cd57-9c0e-4dc6-898c-00aa9649b177"}
            ]
        }
    ]
}
```
The first `HUB_RECEIVE` entry (03:58:07) is from an earlier attempt in this
same session, made *before* the courier pickup — Order's FSM correctly
rejected it (`No valid transition from Created on event HUB_RECEIVE`), but
Tracking still recorded it, which is the same BR-03 append-only behavior
demonstrated above, not a duplicate bug.

`SHIPMENT_ORDER.status: Active` — correctly reflects BR-05's "least-advanced
status among its parcels" (the one parcel is non-terminal → `Active`).

## UC-16 — Notification (BR-09)

```bash
docker compose logs notification --no-log-prefix | grep "EMAIL EMULATOR"
```
```
[LoggingEmailAdapter] [EMAIL EMULATOR] Would send email for ref 568dffd9-... | Subject: "Order Created: 568dffd9-..." | Body: "Your order 568dffd9-... has been successfully created with 1 parcels."
[LoggingEmailAdapter] [EMAIL EMULATOR] Would send email for ref 568dffd9-... | Subject: "Payment Succeeded: 568dffd9-..." | Body: "Your payment for order 568dffd9-... (Payment ID: 8d2f2c8a-...) has succeeded."
[LoggingEmailAdapter] [EMAIL EMULATOR] Would send email for ref 0f6939d9-... | Subject: "Parcel Delivered: 0f6939d9-..." | Body: "Your parcel 0f6939d9-... has been delivered by courier b578dcfe-...."
```
All three milestone events (`order.created`, `payment.succeeded`,
`parcel.delivered`) were independently consumed and logged — proving
Notification fires off the raw NATS event regardless of Order's own FSM
outcome for that same event (the `parcel.delivered` email still sent even
though `PARCEL.state` never reached `Delivered`, per the gap above).

## Exception paths (not re-run here — already live-verified during their own tasks)

These are documented rather than re-demonstrated, to avoid duplicating
evidence already captured in `TASKS.md`/`docs/PROGRESS.md` at the task that
built each guard:

- **Misrouted (BR-02)** — a hub scan whose zone doesn't match the parcel's
  expected destination zone blocks the forward transition, sets
  `PARCEL.state = Misrouted`, and emits `parcel.misrouted`. Verified during
  task 6.2 (Hub/Sortation).
- **RTS after 3 failed attempts (BR-04)** — the 3rd consecutive
  `DELIVERY_FAILED` for a parcel flips `direction = Reverse_RTS` and resets
  the attempt counter. Verified during task 6.1 (Courier).
- **Passive lost-parcel detection (BR-06 design note)** — a cron sweep in
  Tracking for in-transit parcels past their SLA with no further scans,
  emitting `parcel.lost_suspected`. Verified during task 5.5/5.6 (Tracking
  event store / status projection).

## Per-actor authorization matrix (Phase 10)

Captured 2026-07-17 (task 10.3), all through the gateway (`:3000`) with real
Clerk 1h test tokens. Setup: two fresh orders were staged through the full
flow above (create → webhook payment → pickup → origin hub → trip
depart → destination hub → dispatcher `POST /legs/{id}/assign`), leaving two
`OutForDelivery` parcels with persisted assignments (task 10.1):

- parcel `411ecaac` — `assigned_courier_id = b578dcfe`, the courier row
  linked to `shipper.test@example.com` via `COURIER.user_id`
- parcel `ac983258` — `assigned_courier_id = a354903c`, an unlinked courier

The shipper's pickup scan itself was also made with the shipper token
(courier-identity check passes on their own `courier_id` → 201) — pickup
enforces identity only, since assignment doesn't exist yet at pickup time.

`POST /couriers/legs/{parcel_id}/deliver` matrix (task 10.2's guards):

| # | Caller | Body `courier_id` | Parcel | Result |
| - | :--- | :--- | :--- | :--- |
| 1 | no token | own | `411ecaac` | `401 Missing bearer token` |
| 2 | shipper | `a354903c` (not own) | `ac983258` | `403 A shipper can only act as their own courier` |
| 3 | shipper | `b578dcfe` (own) | `ac983258` (another courier's) | `403 This parcel is not assigned to the calling courier` |
| 4 | shipper | `b578dcfe` (own) | `411ecaac` (own assignment) | `201 {"status":"recorded","proof_of_delivery_id":"f394eff0-..."}` |
| 5 | admin | `a354903c` | `ac983258` | `201` (admin bypass) `{"proof_of_delivery_id":"2fdcaad4-..."}` |

Confirmed in Postgres after the run: both parcels `state = Delivered` (the
first time the full multi-hub flow has been driven per-actor end-to-end),
and both `PROOF_OF_DELIVERY` rows exist in `shipping_courier_db`. The 403s
are deliberately plain `Forbidden` responses, distinct from the `422 BR-XX`
business-rule envelope — ownership is an authorization concern, not a
business rule.

Customer ownership (`GET /orders` filtered by `created_by_user_id`, admin
sees all, shipper → 403 on `/orders`) was captured during task 9.4 and is
not re-run here.

## Cleanup

```bash
docker compose down   # stops all containers; add -v to also drop volumes/seed data
```
