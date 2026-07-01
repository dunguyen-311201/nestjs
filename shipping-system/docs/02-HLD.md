# Shipping System — HLD Reference

## Services & Data Ownership

| Service | Responsibility | Owns (write) | Notes |
|---|---|---|---|
| Order | Order intake, pricing orchestration, order lifecycle | CUSTOMER, ORDER, PARCEL | Receives order requests, calls Pricing synchronously, owns the parcel state machine and the ORDER.status write-back projection. |
| Pricing | Rate-card lookup, price calculation | RATECARD | Returns a fixed price for route x parcel type; price locked at order creation. |
| Tracking | Append-only scan-event store, tracking timeline | SCANEVENT | Consumes all scan events, stores them immutably (parcel-level), derives projections. Listens to parcel.delivered; does NOT own DELIVERYPROOF. |
| Courier | First/last-mile pickup & delivery, POD | COURIER, DELIVERYPROOF | Manages pickup/delivery legs, write-owns proof-of-delivery. Never writes SCANEVENT directly (Tracking is sole writer) — on each REST call it writes only its own tables, then synchronously publishes the corresponding NATS event (`parcel.picked_up`, `parcel.out_for_delivery`, `parcel.delivered`, `parcel.rts`) in the same request; Tracking consumes it and appends the SCANEVENT row. No cross-service call, no outbox (outbox stays Order-Creation-only). |
| Hub / Sortation | Inbound scan, network topology | ZONE, ROUTE | HUB_RECEIVE scan, parcel inbound/outbound; owns zones & routes. (Bag/manifest consolidation is physical-only, not modeled.) |
| Line-haul | Line-haul trip lifecycle | LINEHAULTRIP | Trip creation, depart/arrive hooks, deconsolidation trigger. |
| Dispatcher | Assignment & planning | DRIVER, TRUCK (assignment) | Assigns driver/truck to trips and couriers to legs. |

## NATS Subject Map

| Subject | Producer | Consumers | Meaning |
|---|---|---|---|
| `order.created` | Order | Tracking, Pricing(audit) | A new order with parcels was created |
| `parcel.picked_up` | Courier | Tracking, Order | First-mile pickup scan recorded |
| `parcel.hub_received` | Hub | Tracking, Order | Parcel inbounded at a hub (HUB_RECEIVE) |
| `parcel.loaded_for_linehaul` | Hub | Tracking | Parcel loaded onto a line-haul trip; payload includes `linehaul_trip_id` |
| `parcel.arrived_at_hub` | Hub | Tracking, Order | Parcel inbounded at destination hub; payload includes `linehaul_trip_id` so a trip-level exception (e.g. truck broke down, or arrived at the wrong hub) can be queried/validated once per trip instead of per parcel |
| `trip.departed` | Line-haul | Tracking | A line-haul trip departed origin hub |
| `trip.arrived` | Line-haul | Tracking, Hub | A trip arrived at destination hub |
| `parcel.misrouted` | Hub | Tracking, Order | Parcel scanned at an off-route hub |
| `parcel.out_for_delivery` | Courier | Tracking, Order | Last-mile dispatch |
| `parcel.delivered` | Courier | Tracking, Order | Delivered, carries POD image links |
| `parcel.rts` | Courier | Tracking, Order | Return-to-Sender triggered; payload sets `PARCEL.direction = Reverse_RTS` and resets the failed-delivery-attempt counter to zero for the reverse leg |
| `parcel.lost_suspected` | Tracking (scheduled job) | Order | SLA threshold breached with no next scan; passive lost-parcel detection (no manifest to count against) |
| `orders.status.<order_id>` | Tracking projector | Order projection consumer | Per-order subject for serialized projection writes (JetStream ordering) |

## REST Endpoints

| Actor | Endpoint | Purpose |
|---|---|---|
| Sender | `POST /orders` | Create an order; returns order + locked price |
| Sender | `GET /orders/{id}/quote` | Preview price before creation |
| Recipient | `GET /tracking/{tracking_id}` | End-to-end tracking timeline from scan events |
| Courier | `POST /couriers/legs/{id}/pickup` | Record a pickup scan |
| Courier | `POST /couriers/legs/{id}/deliver` | Record delivery + upload POD |
| Hub Operator | `POST /hubs/{id}/receive` | HUB_RECEIVE scan |
| Dispatcher | `POST /trips / POST /trips/{id}/assign` | Create trip, assign driver/truck |
| Dispatcher | `POST /legs/{id}/assign` | Assign courier to a leg |

## Design Solutions for Specific Cases

### Misrouted handling and corrective re-route (BR-02)

1. A hub scan (`HUB_RECEIVE` / `ARRIVED_AT_HUB`) is recorded by the Hub/Sortation service. Before accepting the scan as a forward-progressing event, the service compares the scanning hub's zone against the zone expected by `PARCEL.route_id`.
2. If they don't match, the guard blocks the normal forward transition: instead of `parcel.hub_received` / `parcel.arrived_at_hub`, the Hub service emits `parcel.misrouted`. Tracking appends a `MISROUTED` scan event (this keeps the append-only rule — no correction overwrites the wrong scan).
3. Consuming `parcel.misrouted`, the Hub/Sortation service recalculates a corridor from the *actual* scanning hub's zone to the order's original destination zone, updates `PARCEL.route_id`, and re-emits a corrective `parcel.hub_received` so the parcel resumes forward movement on the new route.
4. `PARCEL.state = Misrouted` is transient — it's superseded by the next scan event once the corrective route is applied. `ORDER.status` reflects `Misrouted` only for the debounce window before the correction lands (BR-05 still applies: least-advanced status).
5. Batch case: when an entire line-haul trip is misrouted (e.g. the truck unloads its whole load at the wrong hub), every affected `parcel.arrived_at_hub` event carries the same `linehaul_trip_id`. The Hub/Sortation service can validate and re-route the whole trip's cargo in one pass keyed by `linehaul_trip_id`, instead of running the zone-mismatch check independently per parcel.

### RTS after 3 failed attempts (BR-04)

1. Each failed last-mile attempt needs its own scan event so the append-only log stays the single source of truth. `DELIVERY_FAILED` has been added to the `event_type` enum in `01-ERD.md` for this purpose.
2. The Courier service counts `DELIVERY_FAILED` scan events for the parcel (queried from Tracking, or tallied from the events Courier itself just emitted). On the 3rd `DELIVERY_FAILED`, Courier emits `parcel.rts` instead of dispatching another `OUT_FOR_DELIVERY`.
3. On `parcel.rts`: `PARCEL.direction` flips to `Reverse_RTS` and the failed-delivery-attempt counter resets to zero, so a delivery failure on the reverse leg back to the sender is counted independently from the original 3 forward-leg failures. The barcode (`PA-XXXX`) and `PARCEL.id` are unchanged — no new parcel row, no new tracking ID (per BR-04).
4. Loop avoidance: the routing engine always evaluates `(direction, current_zone)` together. A parcel with `direction=Reverse_RTS` is only ever routed toward the original sender's zone; the forward-dispatch guard at any hub explicitly excludes `Reverse_RTS` parcels from outbound-to-recipient routing, so it can never be re-dispatched forward again.

### ORDER.status projection mechanics (BR-05, BR-07, ADR-001)

1. Tracking is the producer on `orders.status.<order_id>`: after appending any status-relevant scan event, Tracking publishes a lightweight "recompute" trigger to that order's subject (not the full event payload — just a signal to recompute).
2. Because JetStream preserves in-order delivery per subject, and each `orders.status.<order_id>` subject is consumed serially, the Order service's projection consumer never processes two triggers for the same order concurrently — this is what makes the per-aggregate serialization in ADR-001 safe without a lock.
3. Debounce: on receiving a trigger, the consumer (re)starts a short in-memory timer keyed by `order_id` (e.g. a few hundred ms) instead of recomputing immediately. If another trigger for the same order arrives before the timer fires, the timer resets. When it finally fires, the consumer runs **one** recompute pass covering however many scan events landed in that burst — this is what "event-batching debounce" in BR-07 refers to.
4. Recompute pass: read the latest computed state of every parcel under the order (derived from each parcel's own scan-event sequence — see design note in `01-ERD.md`), rank each parcel's state (`Created < InHub < InTransit < OutForDelivery < Delivered`, with `Lost`/`Damaged`/`Misrouted` treated as exception states), and set `ORDER.status` to the least-advanced rank across all parcels. If any parcel is terminally `Lost`/`Damaged` while others are `Delivered`, `ORDER.status = Partially_Delivered` (per the BR-05 exception branch). `Cancelled` is set directly by the Order service pre-dispatch and is never derived from parcel state.

### Weight mismatch reconciliation and passive lost-parcel detection (BR-06 + ERD design note)

**Weight mismatch:**
1. Hub/Sortation records `actual_weight_grams` at the origin-hub scan and includes it in the `parcel.hub_received` event payload; the Order service (owner of the `PARCEL` row) applies it to `PARCEL.actual_weight_grams` and compares against `declared_weight_grams`.
2. Per BR-06 the parcel is never held for a mismatch. Resolution path depends on payment type:
   - **COD:** the delta adjusts the amount collected at delivery — Courier reads the reconciled amount when populating `DELIVERYPROOF.cod_collected_cents`.
   - **Prepaid:** the delta needs a post-delivery invoice/adjustment. **Open item — no entity for this exists in the current 13-entity ERD.** Recommend deferring this the same way RateCard versioning is deferred in `CLAUDE.md`'s Open Decisions, rather than inventing a new entity now.

**Passive lost-parcel detection** (consequence of cutting manifests — no active count to compare against):
1. Tracking owns `SCANEVENT` and is best positioned to run this as a scheduled job (not a real-time NATS flow): periodically query for parcels whose latest scan event is an in-transit type (`DEPARTED_LINEHAUL`, `OUT_FOR_DELIVERY`, etc.) older than an SLA threshold, with no subsequent `ARRIVED_AT_HUB` / `DELIVERED` event.
2. On threshold breach, Tracking emits a `parcel.lost_suspected` event (new subject — not yet in the NATS Subject Map above; add if this design is confirmed). The Order service consumes it, sets `PARCEL.state = Lost`, and the normal projection flow (above) cascades `ORDER.status` to `Partially_Delivered`.

### Idempotency and outbox mechanics (Order Creation only)

1. **Outbox write:** creating an order inserts `ORDER` + `PARCEL` rows and an outbox row (`event_type=order.created`, `event_id=uuid`, `payload`, `status=PENDING`) in the same DB transaction — this avoids the dual-write problem (DB commit succeeding but the publish failing, or vice versa).
2. **Outbox publish:** a separate poller reads `PENDING` outbox rows and publishes to NATS with the header `Nats-Msg-Id = event_id`, then marks the row published. If the poller crashes after publish but before marking the row published, it will republish the same `event_id` on restart — this is intentional; layer 2 handles it.
3. **Layer 1 — broker dedup:** the JetStream stream's configured dedup window uses `Nats-Msg-Id` to silently drop a duplicate publish of the same `event_id` within the window (handles the retry-storm case cheaply, at the broker, before any consumer sees it twice).
4. **Layer 2 — consumer dedup:** since the dedup window is time-bounded, a redelivery *outside* that window (e.g. consumer ack failure long after original publish) would not be caught by layer 1. Each consumer (Tracking, Pricing-audit, etc.) additionally checks `event_id` against its own processed-events record before applying the event, and no-ops (acks without reprocessing) if already seen. Layer 1 is the cheap common case; layer 2 is the correctness backstop.

## 5. System Architecture & Topology

### 5.1 Logical Block Diagram

The system is organized as Event-Driven Microservices with database isolation per bounded context. No service ever calls directly into another service's database — all cross-service interaction goes through the message broker (writes) or parallel read calls (reads).

```
[ Sender Web ] ──(HTTPS)──┐
                          ├──> [ 7 Microservices (NestJS) ]
[ Courier App ] ─(HTTPS)──┘           │                │
                                      │ (Internal IPC) │ (TypeORM / Prisma — ADR-002 pending)
                                      ▼                ▼
                            [ NATS JetStream ]   [ PostgreSQL Engine ]
                            (Message Broker)     (5 isolated schemas, ADR-003 shared-DB-for-slice)
```

Note the count mismatch with a naive "one schema per service" assumption: there are 7 services (Order, Pricing, Tracking, Courier, Hub/Sortation, Line-haul, Dispatcher) but only 5 schemas — Hub/Sortation, Line-haul, and Dispatcher share one physical schema (`shipping_network_db`, see 6.1) under ADR-003. Sharing a schema is a slice-only simplification for deployment convenience; it does not change which service logically owns which table (see 6.2).

### 5.2 Cross-Service Communication Strategy

**Write path (asynchronous):** courier-svc, hub-svc, and linehaul-svc record physical parcel actions into their own datastore first, then publish a thin event over NATS JetStream. tracking-svc is the sole consumer that writes SCANEVENT.

**Read path (CQRS & API Composition):** screens that need data owned by more than one service (e.g. a tracking page showing both the sender's name from order-svc and the scan history from tracking-svc) use API Composition, not a cross-DB join. The client (or a thin composition layer) issues parallel requests to each service's read endpoint and merges the payloads at the presentation layer. Cross-DB joins are never performed.

## 6. Data Isolation Strategy

### 6.1 Schema-per-Service

One physical PostgreSQL engine, split into 5 isolated schemas along bounded-context lines:

| Schema | Owning service(s) | Tables |
|---|---|---|
| `shipping_order_db` | Order | CUSTOMER, ORDER, PARCEL |
| `shipping_pricing_db` | Pricing | RATECARD |
| `shipping_tracking_db` | Tracking | SCANEVENT |
| `shipping_courier_db` | Courier | COURIER, DELIVERYPROOF |
| `shipping_network_db` | Hub/Sortation, Line-haul, Dispatcher (shared schema, ADR-003) | ZONE, HUB, ROUTE, LINEHAULTRIP, DRIVER, TRUCK |

### 6.2 Logical Foreign Keys

All cross-service references (e.g. `SCANEVENT.parcel_id` → `PARCEL.id`) are logical FKs typed as UUID — no hard `FOREIGN KEY` constraint at the database level. Parcel-existence checks are the responsibility of the consuming service's state machine when it handles the event, not the database.

This applies **even inside the shared `shipping_network_db` schema**: Hub/Sortation, Line-haul, and Dispatcher are colocated there for slice convenience (ADR-003), but each still only owns its own tables (Hub/Sortation → ZONE/HUB/ROUTE, Line-haul → LINEHAULTRIP, Dispatcher → DRIVER/TRUCK). A hard FK constraint should only ever be added between tables owned by the *same* logical service (e.g. `HUB.zone_id` → `ZONE.id`, both Hub/Sortation). Cross-owner references that happen to sit in the same physical schema (e.g. `LINEHAULTRIP.origin_hub_id` → `HUB.id`, crossing from Line-haul into Hub/Sortation) stay logical-only, so the boundary still holds if these services are ever split into separate physical databases later.

## 7. Message Broker & Fault Tolerance

### 7.1 Stream & Consumer Configuration

- **Stream:** all subjects under the `parcel.*` and `trip.*` prefixes, **plus `order.*` and `orders.status.>`** (so `order.created` and the per-order projection subjects are covered too), are grouped into one stream, `SHIPPING_PIPELINE`.
- **Retention policy:** `Limits` — retained indefinitely (or up to a configured max storage size), since the append-only scan history must remain queryable.
- **Ack policy:** every consumer that writes state or the scan ledger uses `AckExplicit`. A message counts as consumed only once the consuming service's database transaction has committed.

### 7.2 Retry & Dead Letter Queue (DLQ)

When a consumer (e.g. order-svc updating a projection) fails due to a system-level error (DB down, network partition):

- **Max deliver:** JetStream is configured with `max_deliver = 5`.
- **Backoff policy:** exponential backoff between retries — 2s, 4s, 8s, 16s.
- **DLQ:** if all 5 attempts fail, the consumer sends `Term` back to NATS. JetStream routes the message to a dedicated `SHIPPING_DLQ` stream for monitoring, alerting, and manual operator intervention — keeping the main pipeline from suffering head-of-line blocking.

## 8. Security & Data Protection

### 8.1 Application-Level Field Encryption (FLE)

Every `_enc`-suffixed field (`name_enc`, `phone_enc`, `address_enc` on CUSTOMER and DRIVER) is encrypted before it's written to PostgreSQL, via the shared `crypto/` helper (see `CLAUDE.md`).

- **Algorithm:** AES-256-GCM (authenticated symmetric encryption).
- **Key management:** the encryption key is supplied via the `ENCRYPTION_KEY` environment variable at container startup.
- **Routing impact:** `region_code` stays plaintext, so hub-svc can classify and route parcels at high speed without paying the CPU cost of decrypting PII for every parcel.

### 8.2 Media Storage Security

Proof-of-delivery signatures and photos, referenced from DELIVERYPROOF:

- **Storage:** the actual files live in an independent object store (e.g. S3 or MinIO). `signature_url` / `photo_url` in the database store only the logical object path, never the binary.
- **Access:** buckets are fully private. When a client (recipient or admin) requests to view a proof image, the owning service mints a short-lived presigned URL (e.g. 15 minutes) so proof-of-delivery images can't be scraped via guessable links.

## 9. Observability & Tracing

### 9.1 Distributed Tracing Key

- **Correlation ID:** when a sender calls `POST /orders`, order-svc generates a `correlation_id` (UUIDv4), independent of `order_id`.
- **Context propagation:** this `correlation_id` is attached to the NATS message headers of every downstream event in that order's lifecycle (`parcel.picked_up`, `parcel.hub_received`, etc.) as its own header — **distinct from `Nats-Msg-Id`**, which carries `event_id` for JetStream's dedup window (see Idempotency, above). Every log line a consuming service emits for that message must include the `correlation_id`, so a single request can be traced across all services it touched.

### 9.2 Health Check Endpoints

Every NestJS service exposes `GET /health`:

- **Liveness:** returns `200` if the Node.js process is running.
- **Readiness:** returns `200` only if the service has a live connection to both its own database *and* the NATS JetStream cluster; returns `503` if either is down, signaling the orchestrator to stop routing new requests to that pod.
