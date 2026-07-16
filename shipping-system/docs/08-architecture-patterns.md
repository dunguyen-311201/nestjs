# Architecture Patterns & Design Decisions

This document details the architectural patterns, design principles, and engineering decisions implemented throughout this domestic parcel shipping system slice. Rather than building a typical, monolithic REST CRUD API, this system is designed as a production-grade, event-driven microservices monorepo that solves complex distributed systems problems (data isolation, eventual consistency, concurrency, idempotency, and security).

---

## 1. Ports & Adapters (Hexagonal Architecture)

Each microservice in the `apps/` directory is structured around **Hexagonal Architecture** principles, ensuring that core domain logic remains decoupled from external technologies (such as TypeORM, Redis, Stripe, or NATS).

```
         ┌──────────────────────────────────────────────────┐
         │                  External World                  │
         │  (HTTP Clients, Stripe Webhooks, NATS Broker)    │
         └────────┬────────────────────────────────┬────────┘
                  │                                │
                  ▼ (Inbound Adapter)              ▼ (Outbound Adapter)
         ┌───────────────────┐            ┌───────────────────┐
         │    Controllers    │            │    Repositories   │
         └────────┬──────────┘            └────────▲──────────┘
                  │                                │
                  ▼                                │ (Implements)
         ┌─────────────────────────────────────────┴────────┐
         │                  Domain Port                     │
         │           (Abstract Repository Class)            │
         └────────────────────────▲─────────────────────────┘
                                  │
                                  │ (Invokes)
         ┌────────────────────────┴─────────────────────────┐
         │                Domain Service / FSM              │
         │          (Core Business Logic - Pure TS)         │
         └──────────────────────────────────────────────────┘
```

### Implementation Reference
* **Ports**: Declared as TypeScript abstract classes (e.g., [IOrderRepository](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/ports/order-repository.port.ts)).
* **Adapters**: Concrete implementations utilizing external libraries (e.g., [OrderRepository](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/repositories/order.repository.ts) using TypeORM, or [RedisIdempotencyAdapter](file:///home/dunguyen/Training/nestjs/shipping-system/apps/courier/src/adapters/redis-idempotency.adapter.ts) using Redis).
* **Domain Service**: Core logic invoking the ports (e.g., [OrderService](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/order.service.ts)).

### Decisions & Trade-offs
* **Decision**: Enforce abstract classes instead of plain interfaces for Ports, enabling NestJS's Dependency Injection container to bind concrete Adapters dynamically.
* **Pros**: 
  - Domain code has zero dependencies on databases or network protocols, making it future-proof.
  - Unit tests require no database connection; they simply mock the abstract classes.
* **Cons**:
  - Increases boilerplate code (requires defining ports, duplicate model definitions for database entities vs. domain aggregates, and manual data mappers).

---

## 2. Logical Data Isolation (Schema-per-Service)

To prepare for a distributed microservices environment while keeping local development overhead low, the system utilizes a **Shared Database, Isolated Schemas** pattern on PostgreSQL.

### Implementation Reference
* The database contains independent schemas: `shipping_order_db`, `shipping_tracking_db`, `shipping_courier_db`, `shipping_hub_db`, `shipping_linehaul_db`, and `shipping_dispatcher_db`.
* Services only connect to their own logical schema. Cross-service database joins, foreign keys, or database constraints are strictly forbidden. Service-to-service correlations are made using plain UUIDs.

### Decisions & Trade-offs
* **Decision**: Group all microservice schemas into a single PostgreSQL container but isolate them logically, rather than provisioning separate database engines.
* **Pros**:
  - Ensures schema independence. Migrating a service to its own physical database in the future is a zero-code change, only requiring a configuration update.
  - Lowers local development CPU/memory footprints compared to running 6 separate database containers.
* **Cons**:
  - Development teams must remain disciplined; importing chéo TypeORM Entities from other schemas is blocked only by lint checks and code reviews, not by hard network isolation.

---

## 3. API Gateway & Raw HTTP Proxying

All client requests target the **API Gateway** (`port 3000`), which acts as a reverse proxy routing requests to internal microservices.

### Implementation Reference
* **Catch-All Routing**: [ProxyController](file:///home/dunguyen/Training/nestjs/shipping-system/apps/api-gateway/src/proxy/proxy.controller.ts) intercepts requests and routes them dynamically using [proxy.config.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/api-gateway/src/proxy/proxy.config.ts).
* **Streaming Service**: [ProxyService](file:///home/dunguyen/Training/nestjs/shipping-system/apps/api-gateway/src/proxy/proxy.service.ts) pipes the raw incoming request stream directly to the target service.

### Decisions & Trade-offs
* **Decision**: Disable global NestJS body-parsers on the API Gateway and stream raw HTTP buffers directly.
* **Pros**:
  - Protects webhook signatures. Third-party integrations (like Stripe Webhooks) rely on exact byte-for-byte payloads to verify cryptographically signed headers (`stripe-signature`). Pre-parsing the JSON payload on the Gateway would strip whitespaces or alter newlines, causing verification failures at the destination service.
  - High performance with minimal memory overhead.
* **Cons**:
  - Request filtering, path manipulations, and request logging at the Gateway level must deal with raw streams rather than high-level JSON objects.

---

## 4. Transactional Outbox Pattern

To achieve reliable event publishing without introducing complex distributed transaction managers, the system implements the **Transactional Outbox** pattern.

### Implementation Reference
1. **DB Transaction**: When placing an order, the system saves the `ShipmentOrder` entity and inserts an event record into the local `Outbox` table within the same ACID transaction (e.g., [order.repository.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/repositories/order.repository.ts#L25)).
2. **Background Polling**: An [OutboxPollerService](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/outbox-poller.service.ts) runs in the background (every 500ms), querying `PENDING` outbox records, publishing them to NATS, and marking them as `PUBLISHED` upon acknowledgement.

```
┌──────────────────────────────────────────────┐
│             NestJS HTTP Request              │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│           TypeORM ACID Transaction           │
│  ├─► Save ShipmentOrder / Parcel             │
│  └─► Insert Event into Outbox Table (PENDING)│
└──────────────────────┬───────────────────────┘
                       │ (Commit Success)
                       ▼
┌──────────────────────────────────────────────┐
│    Background OutboxPollerService (500ms)    │
│  ├─► Query PENDING Events                    │
│  ├─► Publish to NATS Broker                  │
│  └─► Update Status to PUBLISHED              │
└──────────────────────────────────────────────┘
```

### Decisions & Trade-offs
* **Decision**: Use a poll-based model (`OutboxPollerService`) rather than log tailing (Debezium/CDC).
* **Pros**:
  - Extremely simple to implement, test, and debug. No external CDC infrastructure is required.
  - Guarantees **At-Least-Once** message delivery. If the NATS broker goes down, events remain in the Outbox database and will be retried automatically.
* **Cons**:
  - Introduces a minor event publishing latency (up to 500ms).
  - Outbox tables grow rapidly and require a data purging (pruning) strategy.

---

## 5. Dual-Layer Idempotency (REST API & Message Queue)

In logistics, network jitter often causes handheld devices to retry scans, or message brokers to redeliver events when network acknowledgements are lost. To maintain a consistent state, the system employs idempotency at two separate layers.

### Implementation Reference
1. **Synchronous HTTP Layer**:
   - The client provides a unique `Idempotency-Key` header (intercepted via [CourierController](file:///home/dunguyen/Training/nestjs/shipping-system/apps/courier/src/courier.controller.ts)).
   - In [CourierService](file:///home/dunguyen/Training/nestjs/shipping-system/apps/courier/src/courier.service.ts#L50-L54), the system tries to acquire a lock in Redis using `SET lock:idem:<key> "processing" EX 10 NX`.
   - If the lock is acquired, the service processes the request, caches the response, and releases the lock. If another request arrives while processing, it waits/polls the cache or returns a HTTP conflict code, avoiding concurrent writes.
2. **Asynchronous Message Queue Layer**:
   - NATS JetStream messages include a `Nats-Msg-Id` header (mapped to the unique `event_id`). NATS uses this to deduplicate publishes.
   - At the Database level, consumer repositories enforce a `UNIQUE(event_id)` constraint and perform `INSERT ... ON CONFLICT DO NOTHING` (`orIgnore()` in TypeORM), ensuring duplicate events are discarded safely without throwing errors (e.g., [TrackingEventRepository](file:///home/dunguyen/Training/nestjs/shipping-system/apps/tracking/src/repositories/tracking-event.repository.ts#L41-L45)).

---

## 6. State Machine Pattern (FSM)

Parcel lifecycles are strictly governed by a Finite State Machine to block invalid operations (such as attempting last-mile delivery for a parcel that was never picked up).

### Implementation Reference
* **FSM Definition**: Configured inside [parcel-state-machine.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/domain/parcel-state-machine.ts) as a static lookup map of valid source-to-destination state transitions based on scan events.
* **Administrative Exceptions**: Special pathways like Return-to-Sender (RTS) and Lost-Suspected are administrative actions that transition state directly (using `applyRts()` and `markLostSuspected()`) and adjust routing directions.

### Decisions & Trade-offs
* **Decision**: Centralize state transitions inside a pure, unit-testable class rather than scattering state transition validation checks across multiple controller services.
* **Pros**:
  - Business rules regarding parcel flows (such as BR-02 and BR-08) are fully documented in code and verified by over 50 unit tests.
* **Cons**:
  - Rigid structure. Adding new custom operations requires modifying the transition map and ensuring downstream projection consumers support the new states.

---

## 7. Write-Back Status Projections (Eventual Consistency)

Rather than performing costly database joins and aggregation queries (`COUNT`, `AVG`) at read time to get shipment statuses, the system separates write models from read projections.

### Implementation Reference
* When a parcel is scanned (e.g., `HUB_RECEIVE` or `DELIVERED`), the event is consumed asynchronously by the Order Service.
* The [StatusProjectionConsumer](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/status-projection.consumer.ts) computes the new aggregate order status based on all its parcels (per **BR-05**).
* It updates the order's state in Postgres and simultaneously updates the **Redis read-through cache** (`order:status:<id>`).
* API tracking calls (`GET /tracking/<id>`) fetch status directly from Redis, bypass database queries, and achieve low response times.

### Decisions & Trade-offs
* **Decision**: Materialize status updates dynamically (Write-Back) instead of computing them on-the-fly (Read-time aggregation).
* **Pros**:
  - Extremely fast read latency. Local load tests using Artillery show P99 response times of ~**40ms** under concurrent loads.
* **Cons**:
  - Eventual consistency. There is a slight propagation delay (under 1 second) between a parcel scan happening and the final tracking page showing the updated status.

---

## 8. Cryptographic PII Protection (AES-256-GCM & HMAC Hashing)

To comply with data privacy regulations, all Personally Identifiable Information (PII) like names, phones, and addresses are encrypted at rest.

### Implementation Reference
* **Encryption**: Done in [pii-crypto.ts](file:///home/dunguyen/Training/nestjs/shipping-system/libs/crypto/src/pii-crypto.ts) using `aes-256-gcm` with a unique random IV generated per invocation. Output is stored in database columns like `phone_enc`.
* **Deterministic Hashing**: Because random IVs prevent direct SQL index lookups (`WHERE phone_enc = '...'`), the system computes a cryptographic HMAC-SHA256 hash using the same `PII_ENCRYPTION_KEY` and stores it in `phone_hash`. Lookups are executed against this hash.

### Decisions & Trade-offs
* **Decision**: Keep the HMAC key outside the database (managed via environment variables).
* **Pros**:
  - Prevents rainbow-table dictionary attacks. If the database leaks, an attacker cannot reverse the hash to find out the phone numbers because they lack the key to pre-compute matching hashes.
* **Cons**:
  - Prevents partial search queries (such as searching for phone numbers starting with "090" using `LIKE`). Only exact match lookups are supported.
