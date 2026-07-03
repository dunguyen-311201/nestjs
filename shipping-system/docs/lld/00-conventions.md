# LLD Conventions

## Versioning

| Version | Date | Author | Changes |
| :--- | :--- | :--- | :--- |
| v1.2 | 2026-07-03 | Du Nguyen | Removed the top-level `07-use-cases.md`/`08-sequence-diagrams.md` aggregate docs; each service file is now fully self-contained with its own Use Cases and Sequence Diagrams sections. Shared cross-service diagrams (pickup+hub inbound, line-haul+misrouted, trip creation+assignment) were split into per-service halves, each linking to its sibling rather than duplicating the diagram source. |
| v1.1 | 2026-07-03 | Du Nguyen | Added Idempotency-Key convention; per-service files now carry their own Versioning + Key Design Decisions sections |
| v1.0 | 2026-07-03 | Du Nguyen | Split from monolithic `09-lld.md` into one file per service |

Shared across every service-level LLD in this folder — not repeated per file.

- **Money** = integer cents. **Weight** = integer grams. **Timestamps** = UTC, ISO-8601.
- **Error envelope**: every write endpoint returns `422 Unprocessable Entity` with `{ "rule": "BR-XX", "message": "..." }` for business-rule guard failures — distinct from `400 Bad Request` (malformed/missing fields) and `404 Not Found` (referenced entity doesn't exist).
- **Idempotency-Key**: every `POST` endpoint that mutates state (create, transition, or record an outcome) requires a client-generated `Idempotency-Key` header (UUID). The service checks a Redis key (`idem:{service}:{key}`, 24h TTL) before processing; on a hit, it replays the cached response instead of reprocessing. This is a REST-layer safeguard against network-retry duplicates, separate from and in addition to the NATS-layer `event_id` dedup described in [docs/02-HLD.md § Idempotency and outbox mechanics](file:///home/dunguyen/Training/nestjs/shipping-system/docs/02-HLD.md). Missing header → `400 Bad Request`.
- **Cross-service references** are plain UUIDs, validated by the consuming service's own state machine when it handles the event — never a DB-level `FOREIGN KEY` across service schemas. See [docs/02-HLD.md § Data Isolation Strategy](file:///home/dunguyen/Training/nestjs/shipping-system/docs/02-HLD.md).
- **Scope of this LLD layer**: API request/response DTOs + validation + error codes, and DB indexes/constraints. Class/module structure and method-level pseudocode are explicitly out of scope — left to implementation.

## Files

Each file below is self-contained: Versioning, Key Design Decisions, Use Cases, Sequence Diagrams, API Contracts, and DB Schema Detail all live together per service — no separate top-level use-case or sequence-diagram document exists anymore.

| Service | File | Owns (from HLD) |
| :--- | :--- | :--- |
| Order | [order-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/order-service.md) | `CUSTOMER`, `ORDER`, `PARCEL`, `PAYMENT`, `STRIPE_TRANSACTION` |
| Pricing | [pricing-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/pricing-service.md) | `RATECARD` |
| Tracking | [tracking-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/tracking-service.md) | `SCANEVENT` |
| Courier | [courier-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/courier-service.md) | `COURIER`, `DELIVERYPROOF`, `COD_SETTLEMENT`, `DELIVERY_ATTEMPT` |
| Hub / Sortation | [hub-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/hub-service.md) | `ZONE`, `ROUTE`, `HUB` |
| Line-haul | [linehaul-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/linehaul-service.md) | `LINEHAULTRIP` |
| Dispatcher | [dispatcher-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/dispatcher-service.md) | `DRIVER`, `TRUCK` (assignment) |
| Notification | [notification-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/notification-service.md) | *(none — stateless)* |
