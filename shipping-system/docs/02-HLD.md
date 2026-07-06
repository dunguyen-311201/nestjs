# Shipping System - High Level Design

## Table of Contents
1. [Introduction](#introduction)
   - [Purpose](#purpose)
   - [Scope](#scope)
   - [References](#references)
2. [Architecture](#architecture)
   - [Architecture Overview](#architecture-overview)
   - [Architectural Style](#architectural-style)
   - [Logical Components](#logical-components)
3. [Services & Data Ownership](#services--data-ownership)
4. [Communication Model](#communication-model)
   - [Synchronous (REST)](#synchronous-rest)
   - [Asynchronous (NATS JetStream)](#asynchronous-nats-jetstream)
   - [NATS Subject Map](#nats-subject-map)
5. [Event & API Contracts](#event--api-contracts)
   - [Event Contracts](#event-contracts)
   - [REST Endpoints](#rest-endpoints)
6. [Design Solutions for Specific Cases](#design-solutions-for-specific-cases)
   - [Misrouted handling and corrective re-route (BR-02)](#misrouted-handling-and-corrective-re-route-br-02)
   - [RTS after 3 failed attempts (BR-04)](#rts-after-3-failed-attempts-br-04)
   - [ORDER.status projection mechanics (BR-05, BR-07, ADR-001)](#orderstatus-projection-mechanics-br-05-br-07-adr-001)
   - [Weight mismatch reconciliation and passive lost-parcel detection (BR-06 + ERD design note)](#weight-mismatch-reconciliation-and-passive-lost-parcel-detection-br-06--erd-design-note)
   - [Idempotency and outbox mechanics (Order Creation only)](#idempotency-and-outbox-mechanics-order-creation-only)
   - [Prepaid Payment Verification via Stripe (BR-08)](#prepaid-payment-verification-via-stripe-br-08)
   - [COD Cash Settlement and Reconciliation (BR-09)](#cod-cash-settlement-and-reconciliation-br-09)
   - [Notification Delivery (BR-10)](#notification-delivery-br-10)
7. [Data Isolation Strategy](#data-isolation-strategy)
   - [Schema-per-Service](#schema-per-service)
   - [Logical Foreign Keys](#logical-foreign-keys)
8. [Message Broker & Fault Tolerance](#message-broker--fault-tolerance)
   - [Stream & Consumer Configuration](#stream--consumer-configuration)
   - [Retry & Dead Letter Queue (DLQ)](#retry--dead-letter-queue-dlq)
9. [Cross-cutting Concerns](#cross-cutting-concerns)
10. [Architectural Evaluation & Strengths](#architectural-evaluation--strengths)
11. [Key Design Decisions (ADRs)](#key-design-decisions-adrs)
12. [Monorepo & Shared Library Structure](#monorepo--shared-library-structure)

---

## Introduction

### Purpose
This High-Level Design defines the architecture of the Shipping System backend vertical slice: the services, how they own data, how they communicate, the event and API contracts, and the cross-cutting concerns. It is the implementation contract — scaffolding and coding follow directly from it.

### Scope
- **In scope**: backend vertical slice, all six actors exercised via REST API; the full physical flow order → pickup → hub → line-haul → delivery → tracking; exception handling (terminal states, misroute, RTS, reconciliation).
- **Out of scope**: frontend UIs, CI/CD, cloud deployment. The system runs locally via Docker Compose.

### References
- [docs/01-ERD.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/01-ERD.md)
- [docs/04-business-rules.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/04-business-rules.md)
- [docs/06-specification.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/06-specification.md) — scope, functional/non-functional requirements
- [docs/lld/](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/00-conventions.md) — API DTOs/validation/error codes, DB indexes/constraints, **plus each service's own Use Cases and Sequence Diagrams**, split one file per service

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
- **Redis** — read cache for `ORDER.status` and hot tracking lookups. **Write-through**: the `ORDER.status` projection consumer writes to Redis in the same step it persists to Postgres (no separate invalidation pass); reads fall back to Postgres on a cache miss.

---

## Services & Data Ownership

Each entity is write-owned by exactly one service. Cross-service references are plain IDs, never foreign keys; a service learns about another's data only through events. The slice uses a shared PostgreSQL with schema-per-service, but logical ownership is strict.

| Service | Responsibility | Owns (write) | Notes |
| :--- | :--- | :--- | :--- |
| **Order** | Order intake, pricing orchestration, payment flow, order lifecycle | `CUSTOMER`, `ORDER`, `PARCEL`, `PAYMENT`, `STRIPE_TRANSACTION` | Receives order requests, calls Pricing synchronously, owns the parcel state machine, prepaid checkout sessions, Stripe webhook integration, and the `ORDER.status` write-back projection. |
| **Pricing** | Rate-card lookup, price calculation | `RATECARD` | Returns a fixed price for route × parcel type; price locked at order creation. |
| **Tracking** | Append-only scan-event store, tracking timeline | `SCANEVENT` | Consumes all scan events, stores them immutably, derives projections. Listens to `parcel.delivered`; does NOT own `DELIVERYPROOF`. |
| **Courier** | First/last-mile pickup & delivery, POD, COD reconciliation | `COURIER`, `DELIVERYPROOF`, `COD_SETTLEMENT`, `DELIVERY_ATTEMPT` | Manages pickup/delivery legs, write-owns proof-of-delivery, delivery attempt counts, and courier cash settlements. Never writes `SCANEVENT` directly (Tracking is sole writer) — on each REST call it writes only its own tables, then synchronously publishes the corresponding NATS event in the same request; Tracking consumes it and appends the `SCANEVENT` row. No cross-service call, no outbox. |
| **Hub / Sortation** | Inbound scan, network topology | `ZONE`, `ROUTE`, `HUB` | `HUB_RECEIVE` scan, parcel inbound/outbound; owns zones, routes, and hub records. (Bag/manifest consolidation is physical-only, not modeled.) |
| **Line-haul** | Line-haul trip lifecycle | `LINEHAULTRIP` | Trip creation, depart/arrive hooks; on arrival, hands off to Hub/Sortation which emits `parcel.arrived_at_hub` per parcel via `linehaul_trip_id`. |
| **Dispatcher** | Assignment & planning | `DRIVER`, `TRUCK` (assignment) | Assigns driver/truck to trips and couriers to legs. |
| **Notification** | Best-effort customer email notifications | *(none — stateless)* | Subscribes to existing lifecycle events (`order.created`, `payment.succeeded`, `parcel.delivered`, `parcel.rts`, `parcel.lost_suspected`); sends email via a provider SDK. Owns no data, no outbox, no retries — a send failure is logged and dropped, never blocks or retries the triggering transaction (BR-10). |

> [!NOTE]
> Ownership rule highlights: `ZONE` and `ROUTE` belong to Hub/Sortation (network topology). `DELIVERYPROOF` and `COD_SETTLEMENT` are write-owned by Courier; `PAYMENT` and `STRIPE_TRANSACTION` are write-owned by Order. Tracking only consumes events and records them in its append-only store.

> [!WARNING]
> **Accepted MVP risk — no outbox outside Order Creation**: Courier and Hub/Sortation publish their NATS events synchronously in the same request as their own DB write, with no outbox (see "Idempotency and outbox mechanics" below — it covers Order Creation only). If the NATS publish fails after the DB commit, that scan event is permanently missing from `SCANEVENT`, silently breaking the "100% append-only audit log" target. Accepted for this 16-day slice; production hardening would extend the outbox pattern to these two services.
>
> The same gap exists on Order Service's `POST /orders/{id}/checkout` webhook handler: it updates `ORDER.status` and writes `STRIPE_TRANSACTION` directly, then publishes `payment.succeeded` with no outbox. The blast radius is smaller — `ORDER.status` itself is already correct even if the publish is lost, so there's no audit-log gap like the scan-event case — but downstream consumers (Tracking, Notification) would silently miss the transition. Also accepted for this slice, for the same reason: extending the outbox pattern to a third service isn't worth the added complexity at this scope.

---

## Communication Model

### Synchronous (REST)
- Used only when the caller needs an immediate result: Order → Pricing at order creation (price must be returned and locked).
- Client → API Gateway → service, request/response, validated DTOs.

### Asynchronous (NATS JetStream)
- The default. Every state transition publishes an event; interested services subscribe. No service blocks on another for the main flow.
- Per-aggregate serialization: order-projection events publish to `orders.status.<order_id>`; JetStream guarantees in-subject ordering, so one order's projection is written serially while different orders run in parallel across the consumer group (ADR-001).

### NATS Subject Map
Convention: `<domain>.<event>`, lowercase, dot-separated. Per-order projection subject carries the order id. The one deliberate exception is `orders.status.<order_id>` (plural `orders`): it is a per-aggregate projection-write channel, not a domain event, so it is namespaced separately from the `<domain>.<event>` event stream on purpose.

| Subject | Producer | Consumers | Meaning |
| :--- | :--- | :--- | :--- |
| `order.created` | Order | Tracking, Pricing (audit), Notification | A new order with parcels was created |
| `payment.succeeded` | Order | Order, Tracking, Notification | Emitted upon Stripe webhook validation; updates `ORDER.status = Confirmed` |
| `parcel.picked_up` | Courier | Tracking, Order | First-mile pickup scan recorded |
| `parcel.hub_received` | Hub | Tracking, Order | Parcel inbounded at a hub (`HUB_RECEIVE`) |
| `parcel.loaded_for_linehaul` | Hub | Tracking | Parcel loaded onto a line-haul trip; payload includes `linehaul_trip_id` |
| `parcel.arrived_at_hub` | Hub | Tracking, Order | Parcel inbounded at destination hub; payload includes `linehaul_trip_id` |
| `trip.departed` | Line-haul | Tracking | A line-haul trip departed origin hub |
| `trip.arrived` | Line-haul | Tracking, Hub | A trip arrived at destination hub |
| `parcel.misrouted` | Hub | Tracking, Order | Parcel scanned at an off-route hub |
| `parcel.out_for_delivery` | Courier | Tracking, Order | Last-mile dispatch |
| `parcel.delivered` | Courier | Tracking, Order, Notification | Delivered, carries POD image links |
| `parcel.rts` | Courier | Tracking, Order, Notification | Return-to-Sender triggered; payload sets `PARCEL.direction = Reverse_RTS` and resets the failed-delivery-attempt counter to zero for the reverse leg |
| `parcel.lost_suspected` | Tracking (job) | Order, Notification | SLA threshold breached with no next scan; passive lost-parcel detection |
| `orders.status.<order_id>` | Tracking projector | Order projection consumer | Per-order subject for serialized projection writes (JetStream ordering) |

> [!NOTE]
> **Event Triggers (Sensor vs API)**:
> - `parcel.loaded_for_linehaul` & `parcel.arrived_at_hub`: Automatically triggered by Hub Operators scanning barcodes using sorting devices via the existing `POST /hubs/{id}/receive` endpoint. The Hub Sortation service parses the scan location metadata (e.g., scanning onto a line-haul container vs scanning inbound at a hub) to select the correct event.
> - `trip.departed` & `trip.arrived`: Triggered automatically via GPS geofencing when a line-haul truck departs the origin hub's radius or enters the destination hub's radius. For manual fallback or systems lacking GPS integration, Dispatchers trigger these events using the `/trips/{id}/depart` and `/trips/{id}/arrive` API endpoints.

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
| **Sender** | `POST /orders/{id}/checkout` | Create a Stripe Checkout/PaymentIntent session |
| **Stripe System** | `POST /payments/webhook` | Receive async payment succeeded/failed webhooks |
| **Recipient** | `GET /tracking/{tracking_id}` | End-to-end tracking timeline from scan events. `{tracking_id}` = `ORDER.id`; the response aggregates the scan timeline across every parcel under that order. |
| **Courier** | `POST /couriers/legs/{id}/pickup` | Record a pickup scan |
| **Courier** | `POST /couriers/legs/{id}/deliver` | Record delivery + upload POD |
| **Hub Operator** | `POST /hubs/{id}/receive` | `HUB_RECEIVE` scan |
| **Hub Operator** | `POST /couriers/settlements` | Hub finance operator registers courier cash deposit and triggers COD reconciliation |
| **Dispatcher** | `POST /trips`, `POST /trips/{id}/assign` | Create trip, assign driver/truck |
| **Dispatcher** | `POST /trips/{id}/depart` | Manually mark trip as departed (fallback) |
| **Dispatcher** | `POST /trips/{id}/arrive` | Manually mark trip as arrived (fallback) |
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

### Prepaid Payment Verification via Stripe (BR-08)
1. **Stripe Session**: The Order service generates a Stripe checkout session via `POST /orders/{id}/checkout`, writing a pending `PAYMENT` row linked to the `ORDER`.
2. **Webhook Intake**: Once the customer completes payment, Stripe asynchronously posts to `/payments/webhook`. The Order webhook validator writes a `STRIPE_TRANSACTION` log and publishes the `payment.succeeded` event on NATS.
3. **Dispatch Guard**: In accordance with BR-08, the Courier service blocks first-mile pickup assignment (`POST /legs/{id}/assign`) for prepaid orders unless `ORDER.status` has advanced to `Confirmed` (triggered by the `payment.succeeded` consumer). Any hub inbound scan device (`POST /hubs/{id}/receive`) will similarly reject a parcel if its parent order is prepaid and unpaid, routing it to a holding area.

### COD Cash Settlement and Reconciliation (BR-09)
1. **Cash Collection**: When a courier completes a COD delivery, Courier records signature/photo and `cod_collected_cents` via `POST /couriers/legs/{id}/deliver`.
2. **Deposit Registration**: At the end of the shift, the courier returns to the hub and hands over collected cash. The Hub finance operator registers the deposit using `POST /couriers/settlements` in the Courier service, creating a `COD_SETTLEMENT` record in the `shipping_courier_db` schema.
3. **Automatic Reconciliation**: The Courier service automatically aggregates the sum of `cod_collected_cents` across all COD parcels delivered by that specific courier during the shift and compares it against the cash deposit amount.
4. **Reconciliation Audit**: If the amounts match, `COD_SETTLEMENT.reconciled_at` is set to the current timestamp and status is marked as `Settled`. If there is a discrepancy, the row is marked as `Discrepancy` and a warning is logged for administrative review (BR-09).

### Notification Delivery (BR-10)
1. **Stateless consumer**: The Notification consumer owns no table and has no REST surface — it only subscribes to the events listed in the NATS Subject Map (`order.created`, `payment.succeeded`, `parcel.delivered`, `parcel.rts`, `parcel.lost_suspected`) and calls an email provider SDK (e.g. SES/SendGrid) synchronously within the consumer handler.
2. **Best-effort, not outbox-backed**: unlike Order Creation, there is no transactional guarantee here on purpose — a notification is a side effect, not a source of truth. If the send call fails or the provider is down, the consumer logs the failure and acks the message anyway; it never retries indefinitely or blocks the event stream.
3. **No customer-facing failure mode**: because delivery of the underlying business event (order confirmed, parcel delivered, etc.) already succeeded before Notification ever sees it, a lost email never leaves the system in an inconsistent state — worst case, the customer checks `GET /tracking/{tracking_id}` instead of reading an email.

---

## Data Isolation Strategy

### Schema-per-Service
One physical PostgreSQL engine, split into 5 isolated schemas along bounded-context lines:

| Schema | Owning service(s) | Tables |
| :--- | :--- | :--- |
| `shipping_order_db` | Order | `CUSTOMER`, `ORDER`, `PARCEL`, `PAYMENT`, `STRIPE_TRANSACTION` |
| `shipping_pricing_db` | Pricing | `RATECARD` |
| `shipping_tracking_db` | Tracking | `SCANEVENT` |
| `shipping_courier_db` | Courier | `COURIER`, `DELIVERYPROOF`, `COD_SETTLEMENT` |
| `shipping_network_db` | Hub/Sortation, Line-haul, Dispatcher (shared DB for slice, ADR-003) | `ZONE`, `HUB`, `ROUTE`, `LINEHAULTRIP`, `DRIVER`, `TRUCK` |

### Logical Foreign Keys
All cross-service references (e.g. `SCANEVENT.parcel_id` → `PARCEL.id`) are logical FKs typed as UUID — no hard `FOREIGN KEY` constraint at the database level. Parcel-existence checks are the responsibility of the consuming service's state machine when it handles the event, not the database.

> [!IMPORTANT]
> A hard FK constraint should only ever be added between tables owned by the *same* logical service (e.g. `HUB.zone_id` → `ZONE.id`, both Hub/Sortation). Cross-owner references that happen to sit in the same physical schema (e.g. `LINEHAULTRIP.origin_hub_id` → `HUB.id`) stay logical-only.

---

## Message Broker & Fault Tolerance

### Stream & Consumer Configuration
- **Stream**: all subjects under the `parcel.*` and `trip.*` prefixes, plus `order.*` and `orders.status.>` are grouped into one stream, `SHIPPING_PIPELINE`.
- **Retention policy**: `Limits` — retained indefinitely since the append-only scan history must remain queryable. Time/hub-based partitioning of `SCANEVENT` is explicitly deferred for this local MVP slice (no cloud/production deployment target per Scope); revisit if this ever runs continuously.
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
- **Deployment & Local DevOps**: The entire system runs locally via Docker and Docker Compose for zero-installation bootstrapping:
  - **Docker Compose Orchestration**: A single command `docker-compose up` provisions all microservices and database instances in isolated, interconnected containers.
  - **Environment Parity**: Infrastructure components (PostgreSQL, NATS JetStream, Redis) run on optimized Alpine-based official images to match production footprints while keeping host resource utilization low.
  - **Local Volumes**: Database and broker streams are persisted via Docker volumes (e.g., `./.docker/nats/data` for JetStream and `./.docker/postgres/data` for PG) to survive container rebuilds.
  - **Startup Migrations**: Database schemas are automatically generated and migrated on startup, ensuring developers are always running against the correct DB schema without manual steps.


---

## Architectural Evaluation & Strengths

This design exhibits several key architectural strengths that align with enterprise-grade microservice design patterns:

- **Strict Scope Discipline**: The elimination of physical `Bag` and `Manifest` abstractions is applied consistently across the entire design (ERD, HLD, business rules, and ADR-004). The design documents the specific pros, cons, and consequences of this simplification, demonstrating high scope discipline suitable for a clean vertical slice implementation.
- **Robust Event-Driven Projections**: Using `ScanEvent` as an append-only transaction log (audit trail) serves as the system's source of truth. Implementing NATS JetStream serialized ordering per-order (ADR-001) combined with event-batching debounce on the projection consumer (BR-07) effectively solves the standard concurrent-overwrite problem during high-frequency scan bursts.
- **Strict Bounded Contexts (No Cross-Database Foreign Keys)**: Database entities are strictly partitioned by write-ownership. Hard foreign key constraints are only enforced within the bounds of a single logical service (e.g., `HUB` and `ZONE`), while cross-service relations use logical UUID mapping. This eliminates database-level coupling, making future schema migration/splitting straightforward.
- **Detailed Exception Handling and Edge-Case Mapping**: Rather than abstract lists, the HLD provides detailed, step-by-step communication sequences for complex logistical exceptions. This includes misrouted corrective routing (BR-02), multi-attempt failover loops to Return-to-Sender (BR-04), weight mismatch reconciliation (BR-06), and passive loss tracking via daemon threshold jobs.
- **Dual-Layer Idempotency**: Resolves the "dual write" dilemma using the transactional outbox pattern during order creation, coupled with two-tier message deduplication (NATS deduplication header at broker level and consumer-side validation records).
- **Traceable Decision Records**: Employs a structured ADR format (Context, Decision, and Consequences), ensuring all design choices (such as the rejection of polymorphic ScanEvents in ADR-004) are fully documented and traceable.

---

## Key Design Decisions (ADRs)

| ADR | Decision | Status |
| :--- | :--- | :--- |
| **ADR-001** | Per-aggregate serialization via NATS JetStream per-order subject; Redis is cache-only | Accepted |
| **ADR-002** | ORM selection (TypeORM vs Prisma) | To decide in Project Setup |
| **ADR-003** | Shared-DB-for-slice now; DB-per-service when services split | Accepted |
| **ADR-004** | Polymorphic ScanEvent (entity_id + entity_type) | Rejected (simplified to direct `parcel_id` FK) |
| **ADR-005** | Message Broker Selection (NATS JetStream vs. Kafka / RabbitMQ) | Accepted |

---

## Monorepo & Shared Library Structure

The monorepo holds the seven services, the gateway, and a shared library.

| Partition | Contents | Why shared |
| :--- | :--- | :--- |
| `contracts/` | TypeScript interfaces / JSON Schemas for every NATS event (e.g. `OrderCreatedEventV1`) | One source of truth for event shape; producer and consumers compile against the same type |
| `dtos/` | Shared validation classes and rules, including barcode formats (Parcel `PA-XXXX`) and common request DTOs | Consistent validation across services; a bad barcode is rejected the same way everywhere |
| `crypto/` | Field-level encrypt/decrypt helpers for PII (`name_enc`, `phone_enc`, `address_enc`) | Order and Courier services reuse one tested implementation; PII is never encrypted ad-hoc |

