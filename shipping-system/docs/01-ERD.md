# Shipping System — ERD v4 (Scoped Slice)

_Reduced scope for the 16-day slice — bags & manifests are physical-only (not modeled); tracking is parcel-level_

## Entities

### CUSTOMER

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of the customer (sender or recipient). |
| `name_enc` | string | Full name, stored with field-level encryption (PII). |
| `phone_enc` | string | Phone number, field-level encrypted (PII). |
| `address_enc` | string | Full street address, field-level encrypted (PII). |
| `region_code` | string | Postal/region code kept in plaintext so the sortation engine can route without decrypting PII. |

### ORDER

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of the shipment order. |
| `sender_id` | uuid FK | References the CUSTOMER who sends the order. |
| `recipient_id` | uuid FK | References the CUSTOMER who receives the order. |
| `rate_card_id` | uuid FK | The rate card used to price the order at creation. |
| `price_cents` | int | Fixed price in minor units (cents), locked at order creation. |
| `status` | enum | Write-back projection target, NOT a directly-edited column. Computed as the least-advanced status of the order's parcels and written back asynchronously by the NATS consumer (see Design Notes). |

### PARCEL

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of an individual parcel (a pallet is a large parcel). |
| `order_id` | uuid FK | The order this parcel belongs to. |
| `route_id` | uuid FK, nullable | The corridor/route this parcel travels; set once routing is known. |
| `declared_weight_grams` | int | Weight declared by the sender at order creation (basis for the initial price). |
| `actual_weight_grams` | int, nullable | Weight measured at hub inbound; null until scanned. Compared against declared weight for the BR-06 pricing audit. |
| `type` | enum | parcel or pallet; pallets route away from standard conveyor lines. |
| `direction` | enum | Forward or Reverse_RTS; the routing engine uses this with location to avoid RTS loops. |
| `state` | enum | Parcel lifecycle: Created, InHub, InTransit, Misrouted, OutForDelivery, Delivered, Lost, Damaged. RTS is not a separate state — it's `direction=Reverse_RTS` combined with the same InTransit/InHub/OutForDelivery states, so the two flags never contradict each other. |
| `sla_expected_delivery` | timestamp, nullable | Target delivery deadline; computed from the RATECARD lookup at order creation. Baseline for the passive lost-parcel SLA-breach check (see Design Notes). |

### LINEHAULTRIP

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of a line-haul journey between hubs. |
| `origin_hub_id` | uuid FK | Hub where the trip departs. |
| `dest_hub_id` | uuid FK | Hub where the trip arrives. |
| `driver_id` | uuid FK | Driver assigned to the trip by the dispatcher. |
| `truck_id` | uuid FK | Truck asset assigned to the trip. |

### HUB

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of a physical hub (origin, sorting, or delivery). |
| `zone_id` | uuid FK | The zone this hub serves. |
| `name` | string | Human-readable hub name. |

### ZONE

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of a geographic zone. |
| `region_code` | string | Plaintext routing key used by the sortation engine. |

### ROUTE

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of a corridor between two zones. |
| `origin_zone_id` | uuid FK | Origin zone of the route. |
| `dest_zone_id` | uuid FK | Destination zone of the route. |

### RATECARD

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of a pricing entry. |
| `origin_zone_id` | uuid FK | Origin zone the rate applies to. |
| `dest_zone_id` | uuid FK | Destination zone the rate applies to. |
| `parcel_type` | enum | Parcel type the rate applies to. |
| `price_cents` | int | Fixed price in cents for this route × type. |

### COURIER

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of a first/last-mile courier. |
| `zone_id` | uuid FK | The zone the courier operates in. |
| `role` | enum | RBAC role separating Courier from Hub Operator, Dispatcher, Admin. |

### DRIVER

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of a line-haul driver. |
| `name_enc` | string | Driver name, field-level encrypted (PII). |

### TRUCK

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of a line-haul truck asset. |
| `plate` | string | License plate / registration of the truck. |

### SCANEVENT

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of a scan event (append-only). |
| `parcel_id` | uuid FK | The parcel that was scanned. Tracking is parcel-level only. |
| `hub_id` | uuid FK, nullable | Hub where the scan happened; null for courier-side scans. |
| `courier_id` | uuid FK, nullable | Courier who recorded the scan; null for hub-side scans. |
| `linehaul_trip_id` | uuid FK, nullable | The line-haul trip the parcel was moving on; set for `DEPARTED_LINEHAUL` / `ARRIVED_AT_HUB` scans, null otherwise. Lets a passive exception query (e.g. "which parcels were on the truck that broke down") join through the trip instead of only through hub/courier. |
| `event_type` | enum | Scan type (e.g. PICKUP, HUB_RECEIVE, DEPARTED_LINEHAUL, ARRIVED_AT_HUB, OUT_FOR_DELIVERY, DELIVERY_FAILED, DELIVERED, MISROUTED, RTS). `DELIVERY_FAILED` records one failed last-mile attempt; the 3rd occurrence for a parcel triggers RTS (BR-04). |
| `created_at` | timestamp | Immutable event timestamp (UTC); the store is strictly append-only. Parcel state and current location are derived from the event sequence. |

### DELIVERYPROOF

| Field | Type | Description |
|---|---|---|
| `id` | uuid PK | Unique identifier of a proof-of-delivery record. |
| `scan_event_id` | uuid FK | The DELIVERED scan event this proof is attached to. |
| `parcel_id` | uuid FK | The parcel that was delivered. |
| `signature_url` | string, nullable | Stored recipient signature image, if captured. |
| `photo_url` | string, nullable | Stored delivery photo, if captured. |
| `cod_collected_cents` | int, nullable | Cash-on-delivery amount collected, if the order is COD. |

## Relationships

| From | To | Cardinality | Meaning |
|---|---|---|---|
| CUSTOMER | ORDER | 1 : N | a customer sends / receives many orders |
| ORDER | PARCEL | 1 : N | an order contains one or more parcels |
| ORDER | RATECARD | N : 1 | each order is priced by one rate card |
| ROUTE | PARCEL | 1 : N | a parcel travels along one corridor/route |
| PARCEL | SCANEVENT | 1 : N | each parcel has many scan events (tracking timeline) |
| HUB | LINEHAULTRIP | 1 : N | hub as origin / destination of trips |
| DRIVER / TRUCK | LINEHAULTRIP | 1 : N | assigned to trips |
| HUB / COURIER | SCANEVENT | 1 : N | a scan is recorded at a hub or by a courier |
| SCANEVENT | DELIVERYPROOF | 1 : 0..1 | a DELIVERED scan captures one proof of delivery |
| PARCEL | DELIVERYPROOF | 1 : N | proof of delivery is linked to the parcel |
| ZONE | HUB / ROUTE / RATECARD / COURIER | 1 : N | zone groups hubs, routes, rate cards, couriers |

## Design Notes

### Physical consolidation is out of scope for the data model

Bags and manifests are physical actions performed by hub staff (parcels are placed in sacks and loaded onto trucks), but the system does NOT model them as entities. Tracking is parcel-level: each parcel's location and state are derived from its own scan-event sequence. This removes consolidation/deconsolidation, manifest reconciliation (shortage/overage), and multi-level scanning from the slice — a deliberate scope reduction to fit the 16-day timeline. Consequence: the system detects a lost parcel passively (it is simply never scanned at the next hub) rather than by an active manifest count.

### SCANEVENT is the source of truth

Parcel state (InHub, InTransit, Delivered, ...) and current location are NOT stored as columns; they are computed from the ordered sequence of scan events (append-only, BR-03). The latest event determines the current state. This powers the tracking timeline and the ORDER.status projection.

### ORDER.status — asynchronous write-back projection

ORDER.status is a materialized projection, not a directly-edited column. It is the least-advanced status among the order's parcels (BR-05), written back asynchronously by a consumer over a NATS JetStream per-order subject (ADR-001) with an event-batching debounce, so concurrent updates to one order are serialized while different orders run in parallel. Reads serve the cached projection for the < 300 ms P99 target.

### DELIVERYPROOF stays parcel-level, even for multi-parcel orders

An order with several parcels can still have each parcel delivered independently (that's what BR-05's `Partially_Delivered` status represents), so DELIVERYPROOF intentionally stays tied to `parcel_id` / `scan_event_id` rather than pivoting to `order_id` — an order-level proof would imply order-level scanning, which is cut (see "Multi-level scanning" in the scope note above). When a courier delivers several sibling parcels in one visit, the client captures the signature/photo once and writes the same `signature_url` / `photo_url` into each sibling parcel's own DELIVERYPROOF row — a workflow-level convenience, not a schema change.
