# LLD — Pricing Service

## Versioning

| Version | Date | Author | Changes |
| :--- | :--- | :--- | :--- |
| v1.0 | 2026-07-03 | Du Nguyen | Initial split from monolithic LLD |

Owns: `RATECARD`. Conventions in [00-conventions.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/00-conventions.md) apply. No REST surface, so the `Idempotency-Key` convention doesn't apply here — see Key Design Decisions.

## Key Design Decisions

- **No public REST surface**: this service is never called through the API Gateway; it's invoked synchronously, in-process-boundary, by Order Service only. There is nothing here for a client to retry, so no idempotency key is needed.
- **Mutate-in-place pricing**: a `RATECARD` row is updated directly rather than versioned/appended. RateCard history (needed to answer "what was the price on date X") is an explicit open decision, deferred — see below.

## Use Cases

No dedicated UC — this service only supports UC-01 (Get Rate Quote) and UC-02 (Create Order) as an internal call from Order Service. Full use case detail lives in [order-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/order-service.md) since that's where the client-facing flow is.

## Sequence Diagrams

Pricing appears only as the synchronous call target inside **Diagram 1 — Order Creation & Pricing**, owned by [order-service.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/lld/order-service.md) (not duplicated here since this service has no independent flow of its own — every call into it originates from that diagram).

## API Contracts

Pricing has **no REST endpoint exposed via the API Gateway** — it is called synchronously, internally, by Order Service at order creation and quote time (see [docs/02-HLD.md § Synchronous (REST)](file:///home/dunguyen/Training/nestjs/shipping-system/docs/02-HLD.md)). The internal call contract:

### `price(origin_zone_id, dest_zone_id, parcel_type)` — internal sync call

| Field | Type | Validation |
| :--- | :--- | :--- |
| `origin_zone_id` | uuid | required |
| `dest_zone_id` | uuid | required |
| `parcel_type` | enum | `parcel`, `pallet` |

**Returns**: `{ price_cents, sla_expected_delivery }`. **Failure**: no matching `RATECARD` row → caller (Order Service) surfaces this as `404` on `POST /orders` / `GET /orders/{id}/quote`.

## Database Schema Detail

| Entity | Indexes | Constraints |
| :--- | :--- | :--- |
| `RATECARD` | — | PK `id` · UNIQUE `(origin_zone_id, dest_zone_id, parcel_type, effective_from)` (one rate-card version per lane × type × start date; the currently-effective row is the one where `effective_from <= now` and `effective_to` is null or in the future) |

## Open Decision

RateCard versioning (append-only history vs. mutate-in-place) is deferred — see [docs/02-HLD.md § Weight mismatch reconciliation](file:///home/dunguyen/Training/nestjs/shipping-system/docs/02-HLD.md) and `CLAUDE.md § Open decisions`. Current LLD assumes mutate-in-place (single row per lane × type, no history).
