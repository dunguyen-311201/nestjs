# Shipping System — High-Level Design Reference

## Introduction

### Purpose
This High-Level Design defines the architecture of the Shipping System backend vertical slice: the services, how they own data, how they communicate, the event and API contracts, and the cross-cutting concerns. It is the implementation contract — scaffolding and coding follow directly from it.

### Scope
- **In scope**: backend vertical slice, all six actors exercised via REST API; the full physical flow order → pickup → hub → line-haul → delivery → tracking; exception handling (terminal states, misroute, RTS, reconciliation).
- **Out of scope**: frontend UIs, CI/CD, cloud deployment. The system runs locally via Docker Compose.

### References
- [docs/01-ERD.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/01-ERD.md)
- [docs/04-business-rules.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/04-business-rules.md)

---

## Architecture

### Architecture Overview
The system is a set of NestJS microservices over a NATS JetStream event backbone, with a REST API gateway at the edge. PostgreSQL is the system of record (shared instance, schema-per-service for the slice); Redis is a read-through cache for hot projections. Communication is asynchronous by default (events); synchronous REST is used only where an immediate answer is required (pricing at order creation).

### Architectural Style
- **Event-driven microservices**: services are decoupled, communicating through published events; each owns its data and reacts to others' events.
- **Append-only event store as source of truth**: every state transition emits an immutable scan event; read models (projections) are derived from the stream.
- **CQRS-lean**: writes go through the domain + outbox; reads serve materialized projections to meet the latency target.

### Logical Components
- **API Gateway** — auth, routing, request validation, OpenAPI.
- **Domain services** — Order, Pricing, Tracking, Courier, Hub/Sortation, Line-haul, Dispatcher.
- **NATS JetStream** — event backbone + per-order subjects for serialized projection writes.
- **PostgreSQL** — durable storage, schema-per-service.
- **Redis** — read cache for `ORDER.status` and hot tracking lookups.

---

## Services & Data Ownership

Each entity is write-owned by exactly one service. Cross-service references are plain IDs, never foreign keys; a service learns about another's data only through events. The slice uses a shared PostgreSQL with schema-per-service, but logical ownership is strict.

| Service | Responsibility | Owns (write) | Notes |
| :--- | :--- | :--- | :--- |
| **Order** | Order intake, pricing orchestration, order lifecycle | `CUSTOMER`, `ORDER`, `PARCEL` | Receives order requests, calls Pricing synchronously, owns the parcel state machine and the `ORDER.status` write-back projection. |
| **Pricing** | Rate-card lookup, price calculation | `RATECARD` | Returns a fixed price for route × parcel type; price locked at order creation. |
| **Tracking** | Append-only scan-event store, tracking timeline | `SCANEVENT` | Consumes all scan events, stores them immutably, derives projections. Listens to `parcel.delivered`; does NOT own `DELIVERYPROOF`. |
| **Courier** | First/last-mile pickup & delivery, POD | `COURIER`, `DELIVERYPROOF` | Manages pickup/delivery legs, write-owns proof-of-delivery. Never writes `SCANEVENT` directly (Tracking is sole writer) — on each REST call it writes only its own tables, then synchronously publishes the corresponding NATS event in the same request; Tracking consumes it and appends the `SCANEVENT` row. No cross-service call, no outbox. |
| **Hub / Sortation** | Inbound scan, network topology | `ZONE`, `ROUTE` | `HUB_RECEIVE` scan, parcel inbound/outbound; owns zones & routes. (Bag/manifest consolidation is physical-only, not modeled.) |
| **Line-haul** | Line-haul trip lifecycle | `LINEHAULTRIP` | Trip creation, depart/arrive hooks, deconsolidation trigger. |
| **Dispatcher** | Assignment & planning | `DRIVER`, `TRUCK` (assignment) | Assigns driver/truck to trips and couriers to legs. |

> [!NOTE]
> Ownership rule highlights: `ZONE` and `ROUTE` belong to Hub/Sortation (network topology). `DELIVERYPROOF` is write-owned by Courier; Tracking only consumes `parcel.delivered` and records it in its append-only store.

---

## Communication Model

### Synchronous (REST)
- Used only when the caller needs an immediate result: Order → Pricing at order creation (price must be returned and locked).
- Client → API Gateway → service, request/response, validated DTOs.

### Asynchronous (NATS JetStream)
- The default. Every state transition publishes an event; interested services subscribe. No service blocks on another for the main flow.
- Per-aggregate serialization: order-projection events publish to `orders.status.<order_id>`; JetStream guarantees in-subject ordering, so one order's projection is written serially while different orders run in parallel across the consumer group (ADR-001).

### NATS Subject Map
Convention: `<domain>.<event>`, lowercase, dot-separated. Per-order projection subject carries the order id.

| Subject | Producer | Consumers | Meaning |
| :--- | :--- | :--- | :--- |
| `order.created` | Order | Tracking, Pricing (audit) | A new order with parcels was created |
| `parcel.picked_up` | Courier | Tracking, Order | First-mile pickup scan recorded |
| `parcel.hub_received` | Hub | Tracking, Order | Parcel inbounded at a hub (`HUB_RECEIVE`) |
| `parcel.loaded_for_linehaul` | Hub | Tracking | Parcel loaded onto a line-haul trip; payload includes `linehaul_trip_id` |
| `parcel.arrived_at_hub` | Hub | Tracking, Order | Parcel inbounded at destination hub; payload includes `linehaul_trip_id` |
| `trip.departed` | Line-haul | Tracking | A line-haul trip departed origin hub |
| `trip.arrived` | Line-haul | Tracking, Hub | A trip arrived at destination hub |
| `parcel.misrouted` | Hub | Tracking, Order | Parcel scanned at an off-route hub |
| `parcel.out_for_delivery` | Courier | Tracking, Order | Last-mile dispatch |
| `parcel.delivered` | Courier | Tracking, Order | Delivered, carries POD image links |
| `parcel.rts` | Courier | Tracking, Order | Return-to-Sender triggered; payload sets `PARCEL.direction = Reverse_RTS` and resets the failed-delivery-attempt counter to zero for the reverse leg |
| `parcel.lost_suspected` | Tracking (job) | Order | SLA threshold breached with no next scan; passive lost-parcel detection |
| `orders.status.<order_id>` | Tracking projector | Order projection consumer | Per-order subject for serialized projection writes (JetStream ordering) |

---

## Event & API Contracts

### Event Contracts
Each event has: a name, a version, a payload schema (fields + types), a producer, and consumers.
- **Versioning**: a breaking change creates a new version (e.g. `parcel.delivered.v2`); the old version is not edited.
- **Money** is integer cents; **weight** is integer grams; all timestamps are UTC.

#### Example: `parcel.delivered` (v1)
```json
{
  "event_id": "uuid",
  "occurred_at": "2026-06-30T08:15:00Z",
  "parcel_id": "uuid",
  "order_id": "uuid",
  "courier_id": "uuid",
  "pod": {
    "signature_url": "string|null",
    "photo_url": "string|null",
    "cod_collected_cents": "int|null"
  }
}
```
- **Producer**: Courier Service.
- **Consumers**: Tracking (append to `ScanEvent`), Order (advance parcel/order state).

### REST Endpoints
The gateway handles authentication, RBAC, request routing, and validation; OpenAPI is generated from DTOs. Endpoints are grouped by actor. All write endpoints validate against business-rule guards before emitting events.

| Actor | Endpoint | Purpose |
| :--- | :--- | :--- |
| **Sender** | `POST /orders` | Create an order; returns order + locked price |
| **Sender** | `GET /orders/{id}/quote` | Preview price before creation |
| **Recipient** | `GET /tracking/{tracking_id}` | End-to-end tracking timeline from scan events |
| **Courier** | `POST /couriers/legs/{id}/pickup` | Record a pickup scan |
| **Courier** | `POST /couriers/legs/{id}/deliver` | Record delivery + upload POD |
| **Hub Operator** | `POST /hubs/{id}/receive` | `HUB_RECEIVE` scan |
| **Dispatcher** | `POST /trips / POST /trips/{id}/assign` | Create trip, assign driver/truck |
| **Dispatcher** | `POST /legs/{id}/assign` | Assign courier to a leg |

---

## Design Solutions for Specific Cases

### Misrouted handling and corrective re-route (BR-02)
1. A hub scan (`HUB_RECEIVE` / `ARRIVED_AT_HUB`) is recorded by the Hub/Sortation service. Before accepting the scan as a forward-progressing event, the service compares the scanning hub's zone against the zone expected by `PARCEL.route_id`.
2. If they don't match, the guard blocks the normal forward transition: instead of `parcel.hub_received` / `parcel.arrived_at_hub`, the Hub service emits `parcel.misrouted`. Tracking appends a `MISROUTED` scan event (this keeps the append-only rule — no correction overwrites the wrong scan).
3. Consuming `parcel.misrouted`, the Hub/Sortation service recalculates a corridor from the *actual* scanning hub's zone to the order's original destination zone, updates `PARCEL.route_id`, and re-emits a corrective `parcel.hub_received` so the parcel resumes forward movement on the new route.
4. `PARCEL.state = Misrouted` is transient — it's superseded by the next scan event once the corrective route is applied. `ORDER.status` reflects `Misrouted` only for the debounce window before the correction lands (BR-05 still applies: least-advanced status).
5. Batch case: when an entire line-haul trip is misrouted (e.g. the truck unloads its whole load at the wrong hub), every affected `parcel.arrived_at_hub` event carries the same `linehaul_trip_id`. The Hub/Sortation service can validate and re-route the whole trip's cargo in one pass keyed by `linehaul_trip_id`, instead of running the zone-mismatch check independently per parcel.

### RTS after 3 failed attempts (BR-04)
1. Each failed last-mile attempt needs its own scan event so the append-only log stays the single source of truth. `DELIVERY_FAILED` has been added to the `event_type` enum in `01-ERD.md` for this purpose.
2. The Courier service counts `DELIVERY_FAILED` scan events for the parcel. On the 3rd `DELIVERY_FAILED`, Courier emits `parcel.rts` instead of dispatching another `OUT_FOR_DELIVERY`.
3. On `parcel.rts`: `PARCEL.direction` flips to `Reverse_RTS` and the failed-delivery-attempt counter resets to zero, so a delivery failure on the reverse leg back to the sender is counted independently from the original 3 forward-leg failures. The barcode (`PA-XXXX`) and `PARCEL.id` are unchanged — no new parcel row, no new tracking ID (per BR-04).
4. Loop avoidance: the routing engine always evaluates `(direction, current_zone)` together. A parcel with `direction=Reverse_RTS` is only ever routed toward the original sender's zone; the forward-dispatch guard at any hub explicitly excludes `Reverse_RTS` parcels from outbound-to-recipient routing, so it can never be re-dispatched forward again.

### ORDER.status projection mechanics (BR-05, BR-07, ADR-001)
1. Tracking is the producer on `orders.status.<order_id>`: after appending any status-relevant scan event, Tracking publishes a lightweight "recompute" trigger to that order's subject (not the full event payload — just a signal to recompute).
2. Because JetStream preserves in-order delivery per subject, and each `orders.status.<order_id>` subject is consumed serially, the Order service's projection consumer never processes two triggers for the same order concurrently — this is what makes the per-aggregate serialization in ADR-001 safe without a lock.
3. Debounce: on receiving a trigger, the consumer (re)starts a short in-memory timer keyed by `order_id` (e.g. a few hundred ms) instead of recomputing immediately. If another trigger for the same order arrives before the timer fires, the timer resets. When it finally fires, the consumer runs **one** recompute pass covering however many scan events landed in that burst — this is what "event-batching debounce" in BR-07 refers to.
4. Recompute pass: read the latest computed state of every parcel under the order (derived from each parcel's own scan-event sequence), rank each parcel's state (`Created < InHub < InTransit < OutForDelivery < Delivered`, with `Lost`/`Damaged`/`Misrouted` treated as exception states), and set `ORDER.status` to the least-advanced rank across all parcels. If any parcel is terminally `Lost`/`Damaged` while others are `Delivered`, `ORDER.status = Partially_Delivered` (per the BR-05 exception branch). `Cancelled` is set directly by the Order service pre-dispatch and is never derived from parcel state.

### Weight mismatch reconciliation and passive lost-parcel detection (BR-06 + ERD design note)
- **Weight mismatch**: Hub/Sortation records `actual_weight_grams` at the origin-hub scan and includes it in the `parcel.hub_received` event payload; the Order service applies it to `PARCEL.actual_weight_grams` and compares against `declared_weight_grams`. Resolution path depends on payment type:
  - **COD**: the delta adjusts the amount collected at delivery — Courier reads the reconciled amount when populating `DELIVERYPROOF.cod_collected_cents`.
  - **Prepaid**: the delta needs a post-delivery invoice/adjustment. Recommend deferring this the same way RateCard versioning is deferred.
- **Passive lost-parcel detection**: Tracking owns `SCANEVENT` and is best positioned to run this as a scheduled job. Periodically query for parcels whose latest scan event is an in-transit type (`DEPARTED_LINEHAUL`, `OUT_FOR_DELIVERY`, etc.) older than an SLA threshold, with no subsequent `ARRIVED_AT_HUB` / `DELIVERED` event. On threshold breach, Tracking emits a `parcel.lost_suspected` event. The Order service consumes it, sets `PARCEL.state = Lost`, and the normal projection flow cascades `ORDER.status` to `Partially_Delivered`.

### Idempotency and outbox mechanics (Order Creation only)
1. **Outbox write**: creating an order inserts `ORDER` + `PARCEL` rows and an outbox row (`event_type=order.created`, `event_id=uuid`, `payload`, `status=PENDING`) in the same DB transaction — this avoids the dual-write problem.
2. **Outbox publish**: a separate poller reads `PENDING` outbox rows and publishes to NATS with the header `Nats-Msg-Id = event_id`, then marks the row published.
3. **Layer 1 — broker dedup**: the JetStream stream's configured dedup window uses `Nats-Msg-Id` to silently drop a duplicate publish of the same `event_id` within the window.
4. **Layer 2 — consumer dedup**: each consumer additionally checks `event_id` against its own processed-events record before applying the event, and no-ops if already seen.

---

## Data Isolation Strategy

### Schema-per-Service
One physical PostgreSQL engine, split into 5 isolated schemas along bounded-context lines:

| Schema | Owning service(s) | Tables |
| :--- | :--- | :--- |
| `shipping_order_db` | Order | `CUSTOMER`, `ORDER`, `PARCEL` |
| `shipping_pricing_db` | Pricing | `RATECARD` |
| `shipping_tracking_db` | Tracking | `SCANEVENT` |
| `shipping_courier_db` | Courier | `COURIER`, `DELIVERYPROOF` |
| `shipping_network_db` | Hub/Sortation, Line-haul, Dispatcher (shared DB for slice, ADR-003) | `ZONE`, `HUB`, `ROUTE`, `LINEHAULTRIP`, `DRIVER`, `TRUCK` |

### Logical Foreign Keys
All cross-service references (e.g. `SCANEVENT.parcel_id` → `PARCEL.id`) are logical FKs typed as UUID — no hard `FOREIGN KEY` constraint at the database level. Parcel-existence checks are the responsibility of the consuming service's state machine when it handles the event, not the database.

> [!IMPORTANT]
> A hard FK constraint should only ever be added between tables owned by the *same* logical service (e.g. `HUB.zone_id` → `ZONE.id`, both Hub/Sortation). Cross-owner references that happen to sit in the same physical schema (e.g. `LINEHAULTRIP.origin_hub_id` → `HUB.id`) stay logical-only.

---

## Message Broker & Fault Tolerance

### Stream & Consumer Configuration
- **Stream**: all subjects under the `parcel.*` and `trip.*` prefixes, plus `order.*` and `orders.status.>` are grouped into one stream, `SHIPPING_PIPELINE`.
- **Retention policy**: `Limits` — retained indefinitely since the append-only scan history must remain queryable.
- **Ack policy**: every consumer that writes state uses `AckExplicit`. A message counts as consumed only once the consuming service's database transaction has committed.

### Retry & Dead Letter Queue (DLQ)
When a consumer fails due to a system-level error:
- **Max deliver**: JetStream is configured with `max_deliver = 5`.
- **Backoff policy**: exponential backoff between retries — 2s, 4s, 8s, 16s.
- **DLQ**: if all 5 attempts fail, the consumer sends `Term` back to NATS. JetStream routes the message to a dedicated `SHIPPING_DLQ` stream for monitoring, alerting, and manual operator intervention.

---

## Cross-cutting Concerns

- **Auth & RBAC**: Roles include Sender/Customer, Courier, Hub Operator, Dispatcher, Admin. The gateway enforces role-to-endpoint access; services re-check on sensitive operations.
- **Security & PII**: Recipient PII (name, phone, address) is field-level encrypted at rest; region/postal code is stored in plaintext as routing metadata so sortation never decrypts PII.
- **Observability**: A correlation/trace id follows a parcel across services and events; health endpoints per service.
- **Error handling**: Retries with backoff; a dead-letter subject; idempotent consumers; a reconciliation job.
- **Config**: `@nestjs/config` with schema validation; secrets via environment; no secrets in code.
- **Deployment (Local)**: docker-compose brings up: NATS JetStream, PostgreSQL, Redis, and the NestJS services. migrations run on startup for the slice.

---

## Key Design Decisions (ADRs)

| ADR | Decision | Status |
| :--- | :--- | :--- |
| **ADR-001** | Per-aggregate serialization via NATS JetStream per-order subject; Redis is cache-only | Accepted |
| **ADR-002** | ORM selection (TypeORM vs Prisma) | To decide in Project Setup |
| **ADR-003** | Shared-DB-for-slice now; DB-per-service when services split | Accepted |
| **ADR-004** | Polymorphic ScanEvent (entity_id + entity_type) | Rejected (simplified to direct `parcel_id` FK) |

---

## Monorepo & Shared Library Structure

The monorepo holds the seven services, the gateway, and a shared library.

| Partition | Contents | Why shared |
| :--- | :--- | :--- |
| `contracts/` | TypeScript interfaces / JSON Schemas for every NATS event (e.g. `OrderCreatedEventV1`) | One source of truth for event shape; producer and consumers compile against the same type |
| `dtos/` | Shared validation classes and rules, including barcode formats (Parcel `PA-XXXX`) and common request DTOs | Consistent validation across services; a bad barcode is rejected the same way everywhere |
| `crypto/` | Field-level encrypt/decrypt helpers for PII (`name_enc`, `phone_enc`, `address_enc`) | Order and Courier services reuse one tested implementation; PII is never encrypted ad-hoc |

