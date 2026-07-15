# Architecture Patterns Used in This Project

A catalogue of the recognized architecture/design patterns actually implemented
in this codebase, with the concrete file each one lives in. Written after a
pass through *Scalable Application Development with NestJS* (Packt) and
*Become an Awesome Software Architect: Book 1 — Foundation* (Volkhover) to
cross-check this project's choices against established patterns — every entry
below is verified against real code, not aspirational.

## Dependency Inversion / Ports & Adapters

Business logic never imports a concrete persistence/messaging implementation
— it depends on an abstract `I<Name>` port; a concrete adapter implements
that port and is bound in the module's `providers`.

- Convention: [`docs/lld/00-conventions.md`](lld/00-conventions.md) § Dependency Injection — Ports & Adapters
- Example: `apps/order/src/ports/order-repository.port.ts` (`IOrderRepository`, abstract) +
  `apps/order/src/repositories/order.repository.ts` (`OrderRepository`, TypeORM adapter, concrete)

Why it matters (per *Become an Awesome Software Architect*, Ch.3/6): the
Datastore should depend on interfaces the Business Logic defines, never the
other way around — this is what makes swapping TypeORM for another store, or
mocking persistence in a unit test, possible without touching business logic.

## Event Store / CQRS (append-only, computed state)

`TRACKING_EVENT` is the append-only source of truth; `PARCEL.state` and
`SHIPMENT_ORDER.status` are never directly edited — they're computed by
replaying/folding the event sequence.

- `apps/order/src/domain/parcel-state-machine.ts` — pure state machine, `transition(currentState, event)`
- `apps/order/src/parcel-event.consumer.ts` — folds incoming events onto `PARCEL.state`
- `docs/04-business-rules.md` BR-03 (append-only), BR-05 (status = least-advanced projection)

Matches the classic Event Store pattern (Volkhover Ch.3): the Query Model
(`SHIPMENT_ORDER.status`) is a materialized projection over the Command Model
(the event log), not the system of record itself.

## Transactional Outbox

Every write that must also publish an event does both in one DB transaction
(write the row + a `PENDING` outbox row), then a separate poller publishes
asynchronously and marks `PUBLISHED`. Decouples "commit succeeded" from
"NATS is reachable right now."

- `apps/hub/src/entities/outbox.entity.ts`, `apps/hub/src/outbox-poller.service.ts` (and the identical shape in `linehaul`, `dispatcher`, `courier`, `order`)
- `docs/02-HLD.md` § Idempotency and outbox mechanics

## Idempotency-Key (Request Journal)

Every mutating `POST` requires a client-generated `Idempotency-Key`; the
service checks Redis (`idem:{service}:{key}`) before processing and replays
the cached response on a retry instead of reprocessing.

- Convention: `docs/lld/00-conventions.md` § Idempotency-Key
- Example: `apps/dispatcher/src/dispatcher.service.ts` `assignLeg()` — cache check first, cache write last

Matches the Request Journal pattern (Volkhover Ch.8: *Error Recovery*) almost
exactly — a `requestId` (here, `Idempotency-Key`) keyed record that lets a
retried call return the original result instead of re-executing side effects.

## Circuit Breaker (task: this session)

`OutboxPollerService` in every service wraps its NATS publish calls in a
`CircuitBreaker` (CLOSED → OPEN → HALF_OPEN). After 5 consecutive publish
failures it stops attempting entirely for a cooldown (5s, doubling to a 60s
cap on repeated failure) instead of hammering a downed NATS every 500ms.

- `apps/hub/src/circuit-breaker.ts` (and the identical copy in `linehaul`, `dispatcher`, `courier`, `order`)
- `apps/hub/src/outbox-poller.service.ts` — integration point

## Two-Layer Idempotent Event Dedup

Layer 1 (broker): the outbox poller sets NATS header `Nats-Msg-Id = event_id`,
so JetStream's dedup window drops duplicate publishes. Layer 2 (consumer):
each consumer also tracks processed `event_id`s independently, so even a
duplicate delivery that got past the broker is a no-op.

- `apps/hub/src/adapters/nats-event-publisher.adapter.ts` — sets `Nats-Msg-Id`
- `docs/02-HLD.md` § Idempotency and outbox mechanics

## API Gateway (reverse proxy)

Clients only ever call `api-gateway`; it forwards to the right downstream
service by matching the request path against a route table, piping the raw
request/response bytes through unparsed (so a Stripe webhook signature still
verifies on the far side).

- `apps/api-gateway/src/proxy/proxy.service.ts`, `proxy.config.ts`

## Database-per-Service (schema-per-service)

Each service owns its own Postgres schema; cross-service references are
plain UUIDs (logical FKs), never a hard `FOREIGN KEY` across schema
boundaries. `shipping_network_db` is the one deliberate exception — Hub,
Line-haul, and Dispatcher share it (ADR-003), because splitting it further
wasn't worth the complexity for this scoped slice.

- ADR-003 (referenced from every LLD file's "Owns" section)
- `docs/02-HLD.md` § Data Isolation Strategy

## Saga-style Compensation (not formally named until now)

BR-02's misrouted-parcel handling is a compensating-action saga: a wrong-hub
scan doesn't roll back a distributed transaction (there isn't one) — it parks
the parcel in `Misrouted`, recomputes a corrective route, and re-emits the
scan event to resume the forward flow.

- `apps/hub/src/hub.service.ts` `buildTransitScanEvents()` — the misrouted branch
- `docs/02-HLD.md` § Misrouted handling and corrective re-route (BR-02)

## Per-Aggregate Serialization (concurrency control)

Rather than a database lock, writes to one order's projection are serialized
by publishing to a per-order NATS subject (`shipment_orders.status.<id>`);
JetStream's in-subject ordering guarantee does the serialization. Different
orders process fully in parallel.

- ADR-001
- `docs/02-HLD.md` § ORDER.status projection mechanics (BR-05, BR-07, ADR-001)

## Known gap: no formal backpressure / bulkhead pattern

Not yet implemented — flagged here rather than silently assumed. If one
downstream service's outbox backs up (e.g. a slow consumer), nothing in this
system currently isolates that from the rest of the pipeline beyond each
service's own circuit breaker. Acceptable for this scoped slice's traffic
volume; would need revisiting before a real production load.
