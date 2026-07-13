# Supporter Presentation — 2026-07-13

> Temporary prep doc for today's ~30–45 min status presentation with your
> supporter. Bilingual (EN / VI). Delete or archive after the session.

**Format:** 30–45 min, technical supporter. Structure: scope/architecture
(10 min) → progress walkthrough (10 min) → live demo (15 min) → open
items + Q&A (10 min).

---

## 0. Before you start (5 min, do this ~10 min before the call)

**One-time setup, if you haven't already**: this repo now has a
`.env.example` at the root (every app's `ConfigModule.forRoot({ isGlobal:
true })` auto-loads a `.env` from cwd, no more prefixing env vars on the
command line). A real `.env` with a freshly generated
`PII_ENCRYPTION_KEY` already exists locally (gitignored, never committed)
— if it's ever missing, regenerate it:
```bash
cd /home/dunguyen/Training/nestjs/shipping-system
cp .env.example .env
# then edit .env and fill in PII_ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```bash
cd /home/dunguyen/Training/nestjs/shipping-system

# 1. Stack up (Postgres/Redis/NATS)
docker compose up -d
docker compose ps   # expect shipping_postgres, shipping_redis, shipping_nats all Up

# 2. Quality gate — run this live-ish right before, so the numbers are fresh
pnpm build && pnpm lint && pnpm test 2>&1 | tail -10
```

Kill anything stale on the demo ports first (a common footgun in this repo —
old background processes linger across sessions):
```bash
lsof -i :3001 -i :3003 2>/dev/null   # if either shows a PID, kill it before starting fresh
```

Then start the two services the demo needs — no env prefix needed now,
`.env` covers it:
```bash
npx nest start order &      # :3001
npx nest start tracking &   # :3003

sleep 6
curl -s localhost:3001/health && echo
curl -s localhost:3003/health && echo
```

Note: `.env`'s `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are
placeholders — fine for everything in this demo (Step 4 below relies on
that placeholder key failing predictably). Swap in a real Stripe
test-mode key only if you want the Checkout Session call to fully
succeed instead of failing at the network boundary.

---

## 1. Scope & Architecture (10 min)

**EN — talking points**
- Domestic parcel shipping system, hub-and-spoke, modeled on GHN/GHTK/J&T.
- Deliberately reduced scope for a 16-day timeline (see `CLAUDE.md` §
  SCOPE): **bags/manifests are physical-only, not modeled**; no
  consolidation logic; COD settlement cut entirely.
- Architecture: NestJS microservices (`Order`, `Pricing`(in-process),
  `Tracking`, `Courier`*, `Hub`*, `Line-haul`*, `Dispatcher`*,
  `Notification`* — `*` = Phase 6, not built yet), NATS JetStream event
  backbone, Postgres (schema-per-service), Redis (read cache only, not a
  queue).
- Key architectural decisions (ADRs), worth naming if asked:
  - **ADR-001**: per-aggregate serialization via a JetStream per-order
    subject (`shipment_orders.status.<id>`) — avoids DB lock contention
    during high-volume hub scan bursts.
  - **ADR-002**: TypeORM. **ADR-003**: shared-DB-for-slice (schema per
    service, no cross-schema FKs). **ADR-005**: NATS JetStream over
    Kafka/RabbitMQ (lightweight, per-subject ordering).
  - Event store: `TRACKING_EVENT` is **append-only** — parcel state is
    *computed* from the event sequence, never an editable column.
  - Transactional Outbox — used for `order.created` only (documented
    accepted risk for the two smaller-blast-radius cases: Courier/Hub
    scans, and the payment webhook — see `docs/02-HLD.md`).

**VI — ý chính (nói bằng tiếng Việt nếu supporter thoải mái hơn)**
- Hệ thống giao hàng nội địa, mô hình hub-and-spoke, tham khảo GHN/GHTK/J&T.
- Đã cắt giảm phạm vi có chủ đích để vừa timeline 16 ngày: **bao/manifest
  chỉ là hành động vật lý, không model trong DB**; bỏ logic
  consolidation; bỏ hẳn COD settlement.
- Kiến trúc: NestJS microservices, NATS JetStream làm event backbone,
  Postgres (mỗi service 1 schema riêng), Redis chỉ dùng làm cache đọc
  (không phải queue).
- Các quyết định kiến trúc quan trọng: JetStream serialize theo từng đơn
  hàng (ADR-001), TypeORM (ADR-002), shared-DB-for-slice (ADR-003), chọn
  NATS JetStream thay vì Kafka/RabbitMQ (ADR-005).
- `TRACKING_EVENT` là **append-only** — trạng thái parcel được tính từ
  chuỗi event, không phải cột có thể sửa trực tiếp.

---

## 2. Progress Walkthrough (10 min)

**Status right now**: Phases 1–5 complete (out of 8). Phase 5 (Core
Backend, the biggest phase, 6.0d estimate) just finished today.

| # | Phase | Status |
|---|---|---|
| 1 | Analysis | ✅ Done |
| 2 | Design Docs | ✅ Done |
| 3 | HLD + ADRs | ✅ Done |
| 4 | Project Setup | ✅ Done |
| 5 | **Core Backend** | ✅ **Done today** (5.1–5.8) |
| 6 | Operational Services | ⬜ Next (Courier, Hub, Line-haul, Dispatcher, Notification) |
| 7 | Integration & E2E | ⬜ Not started |
| 8 | Testing, Demo & Docs | ⬜ Not started |

**What "Core Backend" means concretely** (this is the part worth walking
through slide-by-slide):
1. **5.1–5.4**: Order Service (entities, DTOs, order creation with a
   locked price/ETA via Pricing's rate-card lookup), Parcel State
   Machine + guards (BR-02), terminal/exception states (Misrouted, Lost,
   Damaged, RTS — BR-04), Pricing rate-card matrix.
2. **5.5–5.6**: Tracking Service — append-only event store (BR-03),
   first real NATS consumer, then wired the full projection loop:
   scan event → `PARCEL.state` update → debounced recompute →
   `SHIPMENT_ORDER.status` (BR-05) → Redis cache-write → API read.
   Also: Transactional Outbox for `order.created` (first real event ever
   published from this codebase).
3. **5.7**: Made the per-order projection trigger run over **real
   JetStream** (persistent stream + durable ack'd consumer), not just
   NATS core pub/sub — this is ADR-001 actually implemented, not just
   designed.
4. **5.8**: Payment — Stripe Checkout session, webhook handler with
   signature verification, `PAYMENT_TRANSACTION` audit log, and BR-08 (no
   dispatch/hub-inbound before payment is confirmed).

**Numbers to quote**: 162/162 tests green, `pnpm build`/`pnpm lint` clean
across every app in the monorepo (not just the default one — that itself
was a real gap found and fixed in task 5.6).

**Honest transparency points** (raise these yourself, don't wait to be
asked — it reads better):
- Every task this project has had **at least one real bug caught only by
  live verification** that the mocked unit test suite missed (e.g. a
  `Pick<>`-typed DI constructor param that silently breaks Nest's runtime
  dependency resolution; an entity registered via `forFeature()` but
  missing from the connection's own `entities` array). This is why
  "156/156 green" alone isn't the whole story — every task also got a
  real `docker compose` + `curl`/NATS-publish pass before being called
  done.
- Known open items, none blocking Phase 6: `docs/lld/order-service.md`'s
  "abandoned prepaid payment" gap (no auto-cancel yet), `DELIVERY_FAILED`
  has no NATS contract until Courier Service (task 6.1) exists, UC-15's
  passive lost-parcel SLA sweep has no assigned task yet.
- **Same-day example of this practice**: while prepping *this* demo, found
  that `POST /orders` was silently creating a brand-new `CUSTOMER` row for
  sender/recipient on *every* order — even a repeat customer got a fresh
  duplicate row with no way to reconcile it later. Fixed same day: added a
  deterministic `phone_hash` (HMAC-SHA256, since the PII encryption itself
  is intentionally non-deterministic) so a repeat phone number reuses the
  existing `CUSTOMER` row. Also confirmed (and now explicitly documented,
  not just "no guard exists") that **self-shipment is a supported use
  case** — sender and recipient can be the same person at two different
  addresses, which is exactly the "unaccompanied baggage before a flight"
  scenario. Both are demoed live in Step 6 below.

---

## 3. Live Demo (15 min)

**Narrative**: "Create an order → pay for it → watch a courier scan event
flow through the whole system in real time." Run these in order — this
sequence matters (payment before the scan event, matching the real BR-08
gate; doing it out of order, as I found during rehearsal, produces a
confusing status regression).

### Step 1 — Create an order (`POST /orders`)
```bash
curl -s -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" -H "Idempotency-Key: demo-$(date +%s)" \
  -d '{
    "sender": {"name":"Alice","phone":"0900000000","address":"1 Alice St","region_code":"REG-100"},
    "recipient": {"name":"Bob","phone":"0911111111","address":"2 Bob St","region_code":"REG-101"},
    "parcels": [{"declared_weight_grams":500,"type":"parcel"}],
    "payment_type": "PREPAID_STRIPE"
  }' | tee /tmp/order.json
```
**Point out**: price/ETA locked from a real rate-card lookup (BR-01), an
`Idempotency-Key` is required, response status is `Created`.

```bash
ORDER_ID=$(python3 -c "import json;print(json.load(open('/tmp/order.json'))['shipment_order_id'])")
echo "$ORDER_ID"
```

### Step 2 — Show it's already flowing async (outbox)
```bash
docker exec shipping_postgres psql -U postgres -d postgres -t -c \
  "select status, published_at from shipping_order_db.outbox order by created_at desc limit 1;"
```
**Point out**: `order.created` was written in the same DB transaction as
the order, then published for real by the outbox poller within ~500ms —
this is the Transactional Outbox pattern, not a toy.

### Step 3 — Check tracking (should be empty, status null)
```bash
curl -s http://localhost:3003/tracking/$ORDER_ID | python3 -m json.tool
```
**Point out**: `status: null` is a documented transient state (order
exists, projection hasn't run yet), not a bug.

### Step 4 — Pay for it (Stripe Checkout, real API call)
```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3001/orders/$ORDER_ID/checkout
```
**Point out**: this reaches the *real* Stripe API and fails only because
the demo uses a placeholder key (`401 Invalid API Key`) — proves the
integration is wired correctly up to the network boundary, without
needing a real Stripe account live on camera.

**Fully-real variant (optional, if you want to show an actual payment
instead of the 401)**: put a real Stripe test-mode secret key in `.env`,
run `~/.local/bin/stripe listen --api-key sk_test_... --forward-to
localhost:3001/payments/webhook` in a separate terminal (copy its printed
`whsec_...` into `.env`'s `STRIPE_WEBHOOK_SECRET`, restart `order`), open
the real `checkout_url` this step returns, and pay with card `4242 4242
4242 4242`. Already verified working end-to-end this way — a real Stripe
webhook flips `PAYMENT.status`/`SHIPMENT_ORDER.status` for real, no
simulated payload needed. Skip this if you'd rather not expose a real
Stripe terminal on camera — the placeholder-key path above proves the
same wiring without it.

Simulate what Stripe's webhook would send on a completed checkout (a
validly-signed test event, no real Stripe account needed):
```bash
node -e "
const Stripe = require('stripe');
const payload = JSON.stringify({
  id: 'evt_demo_' + Date.now(),
  type: 'checkout.session.completed',
  data: { object: { client_reference_id: '$ORDER_ID', payment_intent: 'pi_demo_1', payment_status: 'paid' } }
});
const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_placeholder' }); // must match .env's STRIPE_WEBHOOK_SECRET
console.log(payload); console.log(header);
" > /tmp/webhook.txt
PAYLOAD=$(sed -n '1p' /tmp/webhook.txt); SIG=$(sed -n '2p' /tmp/webhook.txt)
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3001/payments/webhook \
  -H "Content-Type: application/json" -H "Stripe-Signature: $SIG" --data-raw "$PAYLOAD"
```
```bash
docker exec shipping_postgres psql -U postgres -d postgres -t -c \
  "select status from shipping_order_db.payment where shipment_order_id='$ORDER_ID';"
docker exec shipping_postgres psql -U postgres -d postgres -t -c \
  "select status from shipping_order_db.shipment_order where id='$ORDER_ID';"
```
**Point out**: `PAYMENT.status → Paid`, `SHIPMENT_ORDER.status →
Confirmed` (BR-08's gate just cleared). Optionally re-run the same curl
once more to show it's a no-op the second time (webhook idempotency).

### Step 5 — Simulate a courier scan event (the real-time part)
```bash
PARCEL_ID=$(curl -s http://localhost:3003/tracking/$ORDER_ID | python3 -c "import json,sys;print(json.load(sys.stdin)['parcels'][0]['parcel_id'])")
EVT_ID=$(python3 -c "import uuid;print(uuid.uuid4())")
node scripts/publish-event.js parcel.picked_up \
  "{\"event_id\":\"$EVT_ID\",\"parcel_id\":\"$PARCEL_ID\",\"courier_id\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\"}"
sleep 1
curl -s http://localhost:3003/tracking/$ORDER_ID | python3 -m json.tool
```
**Point out**: one NATS message triggered *three* independent effects —
Order's own consumer flipped `PARCEL.state` to `InTransit`, Tracking
appended a real `TRACKING_EVENT` row (the timeline entry you're looking
at), and the status-projection consumer recomputed `SHIPMENT_ORDER.status`
to `Active`, all served back through this one API call, with Redis
caching the status for sub-300ms reads.

### Step 6 — Repeat-customer dedup + self-shipment (the fix found while prepping this demo)

**Narrative**: "A customer flying HN → HCM has one bag they can't carry on
the plane — can they ship it to themselves?" Create an order where sender
and recipient are the *same person* (same phone), at two different
`region_code`s:
```bash
BODY='{
    "sender": {"name":"Nguyen Van Du","phone":"0987654321","address":"1 Trang Tien, Hanoi","region_code":"REG-100"},
    "recipient": {"name":"Nguyen Van Du","phone":"0987654321","address":"2 Nguyen Hue, HCM","region_code":"REG-101"},
    "parcels": [{"declared_weight_grams":2000,"type":"parcel"}],
    "payment_type": "PREPAID_STRIPE"
  }'
curl -s -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" -H "Idempotency-Key: self-ship-$(date +%s)" \
  -d "$BODY" | tee /tmp/self-ship.json
```
**Point out**: `201`, no special-casing needed — nothing in the DTO, the
`SHIPMENT_ORDER` schema, or BR-01–BR-09 requires sender ≠ recipient.

```bash
SELF_ID=$(python3 -c "import json;print(json.load(open('/tmp/self-ship.json'))['shipment_order_id'])")
docker exec shipping_postgres psql -U postgres -d postgres -t -c \
  "select sender_id, recipient_id, (sender_id = recipient_id) as same_customer
   from shipping_order_db.shipment_order where id='$SELF_ID';"
```
**Point out**: `same_customer = t` — the `phone_hash` dedup means this
resolves to **one** `CUSTOMER` row for both roles, not two. Optionally
repeat the "create the same sender twice with a different recipient" test
to show a repeat customer (not just a self-ship) also dedups correctly —
same query, two different orders, matching `sender_id`.

### Optional stretch — show JetStream is real, not just NATS pub/sub
```bash
curl -s "localhost:8222/jsz?streams=true&consumers=true" | python3 -m json.tool | head -40
```
**Point out**: `SHIPMENT_ORDER_STATUS` is a real persistent JetStream
stream with a durable, explicitly-acked consumer — this is ADR-001, not
just a design doc.

### Cleanup after the demo
```bash
lsof -i :3001 -i :3003 2>/dev/null   # find the two node PIDs
kill <pid1> <pid2>                    # graceful shutdown (both close their NATS/DB connections cleanly)
```

---

## 4. Open Items / Anticipated Questions (10 min)

| If asked... | Answer |
|---|---|
| "Why not build Courier/Hub before Payment?" | Phase ordering in `docs/03-phases.md` — Payment (BR-08) is a *gate* that those services will check independently once built; building it first means the gate exists from day one, not bolted on later. |
| "What happens if the payment webhook publish is lost?" | Documented accepted risk (`docs/02-HLD.md`): no outbox on this one handler, but `SHIPMENT_ORDER.status` is already correct in the DB even if the NATS publish is lost — only downstream consumers (Tracking, Notification) would miss the transition. Extending the outbox here was judged not worth the complexity at this scope. |
| "How do you know a redelivered NATS event doesn't double-process?" | Two-layer idempotency: broker-level `Nats-Msg-Id` dedup on publish, and every consumer also dedups on `event_id` at the DB level (`ON CONFLICT DO NOTHING` / unique constraints) — demoed live if time allows by re-publishing the same `event_id` twice. |
| "What's left before this is demo-able end to end for all actors?" | Phase 6 (Courier, Hub, Line-haul, Dispatcher, Notification — 3.0d), then Phase 7 (wire it all together + one integration test, 1.0d), then Phase 8 (final testing/demo/docs polish, 1.0d). |
| "Is this production-ready?" | No — explicitly scoped as a 16-day vertical slice. Known gaps are tracked, not hidden (see the open-items list above and `docs/PROGRESS.md`'s Resume point). |
| "Can a recipient track their own incoming parcel?" | Not fully today, and documented as such (`docs/lld/order-service.md`/`tracking-service.md` § Known Open Items): the sender gets the `tracking_id` back directly from `POST /orders`, but the recipient has no self-service way to discover it — the only planned channel is the Notification consumer (task 6.6, not built, best-effort by design). There's also no auth/RBAC anywhere in this codebase yet, despite it being a listed NFR with no task assigned. This needs its own architecture decision, not an ad-hoc fix. |
| "What about a repeat customer, or someone shipping to themselves?" | Both handled correctly (Step 6) — `phone_hash` dedup resolves a repeat phone number to the same `CUSTOMER` row instead of creating duplicates, and self-shipment (sender = recipient at a different address) is a fully supported case, not just an absent guard. |

---

## 5. Closing

**Next task**: `6.1` Courier Service — pickup/delivery legs + scan events,
the first of five Phase 6 services. `docs/PROGRESS.md` has the full
resume-point detail if the supporter wants to see session-handoff
practices too.
