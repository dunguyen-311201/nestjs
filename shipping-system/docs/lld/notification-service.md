# LLD — Notification Service

## Versioning

| Version | Date | Author | Changes |
| :--- | :--- | :--- | :--- |
| v1.0 | 2026-07-03 | Du Nguyen | Initial split from monolithic LLD |

Owns: nothing (stateless). Conventions in [00-conventions.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/00-conventions.md) apply. No REST surface, so `Idempotency-Key` doesn't apply — see Key Design Decisions for why a duplicate send isn't guarded against at all.

## Key Design Decisions

- **Best-effort, not idempotent by design**: unlike every other service in this system, a duplicate `payment.succeeded` delivery (within the JetStream dedup window or after redelivery) may cause a duplicate email. This is accepted — the cost of a duplicate email is far lower than the engineering cost of deduplicating a non-critical side effect (BR-09).
- **Never on the critical path**: no outbox, no DLQ, no retry loop. A failure here can never cause a `SCANEVENT` gap or block another service — it only means one fewer email sent.

## Use Cases

| UC | Use Case | Actor | Trigger | Main Outcome | Related BR |
| :--- | :--- | :--- | :--- | :--- | :--- |
| UC-16 | Send Notification | System | Key lifecycle event fires | Best-effort email sent (never blocks the source transaction) | BR-09 |

## Sequence Diagrams

No dedicated diagram — this service only ever appears as a side-note consumer (`NATS--)Notification: consume ... (best-effort email)`) inside diagrams owned by other services: [order-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/order-service.md) Diagram 2, [courier-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/courier-service.md) Diagrams 5 & 6, and [tracking-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/tracking-service.md) Diagram 9. It never initiates a flow of its own.

## API Contracts

None — this service has no REST surface. It is a pure NATS consumer subscribed to `order.created`, `payment.succeeded`, `parcel.delivered`, `parcel.rts`, `parcel.lost_suspected` (see [docs/02-HLD.md § NATS Subject Map](file:///home/dunguyen/Training/nestjs/shipping-system/docs/02-HLD.md)).

## Behavior Contract (BR-09)

- On message received: call the email provider SDK synchronously within the handler.
- On send success: ack the message, done.
- On send failure: log the failure and **ack anyway** — never retry indefinitely, never nack/requeue, never block the consumer group's progress on other messages.
- No outbox, no dead-letter handling specific to this service (it is not on the `SHIPPING_DLQ` critical path — a lost notification does not require operator intervention, unlike a lost `SCANEVENT`).

## Database Schema Detail

None — this service owns no tables.
