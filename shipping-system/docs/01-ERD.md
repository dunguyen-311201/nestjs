# Entity-Relationship Diagram (ERD)

This document describes the PostgreSQL data model, aligned with the simplified NestJS microservice architecture, including payments, payment transaction tracking, and delivery attempts.

---

## Visual Diagram (Mermaid)

```mermaid
erDiagram
    CUSTOMER ||--o{ SHIPMENT_ORDER : "sends/receives"
    SHIPMENT_ORDER ||--|{ PARCEL : "contains"
    SHIPMENT_ORDER ||--|| PAYMENT : "has"
    PAYMENT ||--o| PAYMENT_TRANSACTION : "processed_by"
    PARCEL ||--o{ DELIVERY_ATTEMPT : "records"
    PARCEL ||--o{ TRACKING_EVENT : "tracks"
    ROUTE ||--o{ PARCEL : "directs"
    HUB ||--o{ LINEHAULTRIP : "originates/terminates"
    DRIVER ||--o{ LINEHAULTRIP : "drives"
    TRUCK ||--o{ LINEHAULTRIP : "transports"
    ZONE ||--o{ HUB : "contains"
    ZONE ||--o{ ROUTE : "defines"
    ZONE ||--o{ RATECARD : "prices"
    ZONE ||--o{ COURIER : "deploys"
    TRACKING_EVENT ||--o| PROOF_OF_DELIVERY : "attaches"
    PARCEL ||--o{ PROOF_OF_DELIVERY : "proves"
    HUB ||--o{ TRACKING_EVENT : "records"
    COURIER ||--o{ TRACKING_EVENT : "records"
    LINEHAULTRIP ||--o{ TRACKING_EVENT : "associates"
```

---

## 1. Entities & Fields

### CUSTOMER
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of the customer (sender or recipient). |
| `name_enc` | string | Full name, stored with field-level encryption (PII). |
| `phone_enc` | string | Phone number, field-level encrypted (PII). |
| `address_enc` | string | Full street address, field-level encrypted (PII). |
| `region_code` | string | Plaintext postal/region code kept in plaintext for sorting/routing without decrypting PII. |

### SHIPMENT_ORDER
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of the shipment order. |
| `sender_id` | uuid FK | References the CUSTOMER who sends the order. |
| `recipient_id` | uuid FK | References the CUSTOMER who receives the order. |
| `rate_card_id` | uuid FK | The rate card used to price the order at creation. |
| `price_cents` | int | Fixed price in minor units (cents), locked at order creation. |
| `expected_delivery_at` | timestamp | Locked calculated ETA. |
| `status` | enum | Projections status (Draft, Created, Confirmed, Active, Complete, Partially_Delivered, Lost, Damaged, Cancelled). |

### PARCEL
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of an individual parcel (a pallet is a large parcel). |
| `shipment_order_id` | uuid FK | The order this parcel belongs to. |
| `route_id` | uuid FK, nullable | The corridor/route this parcel travels; set once routing is known. |
| `declared_weight_grams` | int | Weight declared by the sender at order creation. |
| `actual_weight_grams` | int, nullable | Weight measured at hub inbound; null until scanned. |
| `type` | enum | parcel or pallet; pallets route away from standard conveyor sortation lines. |
| `direction` | enum | Forward or Reverse_RTS; the routing engine uses this with location to avoid RTS loops. |
| `state` | enum | Parcel lifecycle: Created, InHub, InTransit, Misrouted, OutForDelivery, Delivered, Lost, Damaged. |
| `sla_expected_delivery` | timestamp, nullable | Target delivery deadline; computed from RATECARD lookup at order creation. |

### DELIVERY_ATTEMPT
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of the attempt. |
| `parcel_id` | uuid FK | References the PARCEL being delivered. |
| `attempt_number` | int | Delivery attempt number (1, 2, or 3). Max of 3 failed attempts triggers automatic RTS (BR-04). |
| `outcome` | enum | `Failed` or `Succeeded`. |
| `failure_reason` | string, nullable | Reason for delivery failure (e.g. customer absent, rejected); null when `outcome = Succeeded`. |
| `created_at` | timestamp | Timestamp when the attempt was made. |

### PAYMENT
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of the payment record. |
| `shipment_order_id` | uuid FK | References the SHIPMENT_ORDER this payment is for. |
| `type` | enum | `PREPAID_STRIPE`, `POSTPAID`. |
| `amount_cents` | int | Value of the payment in cents. |
| `status` | enum | `Unpaid`, `Paid`, `Awaiting_Settlement`. |

### PAYMENT_TRANSACTION
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of the transaction. |
| `payment_id` | uuid FK | References the PAYMENT. |
| `provider` | string | Payment provider (e.g. `STRIPE`, `PAYPAL`). |
| `external_transaction_id` | string | Provider's transaction/intent ID (e.g. Stripe PaymentIntent ID). |
| `external_reference_id` | string, nullable | Provider's secondary reference (e.g. Stripe Charge ID). |
| `status` | string | Provider transaction status (`succeeded`, `failed`, `pending`). |
| `created_at` | timestamp | Timestamp of the transaction. |

### LINEHAULTRIP
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a line-haul journey between hubs. |
| `origin_hub_id` | uuid FK | Hub where the trip departs. |
| `dest_hub_id` | uuid FK | Hub where the trip arrives. |
| `driver_id` | uuid FK | Driver assigned to the trip. |
| `truck_id` | uuid FK | Truck asset assigned to the trip. |

### HUB
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a physical hub. |
| `zone_id` | uuid FK | The zone this hub serves. |
| `name` | string | Human-readable hub name. |

### ZONE
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a geographic zone. |
| `region_code` | string | Plaintext routing key used by the sortation engine. |

### ROUTE
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a corridor between two zones. |
| `origin_zone_id` | uuid FK | Origin zone of the route. |
| `dest_zone_id` | uuid FK | Destination zone of the route. |

### RATECARD
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a pricing entry. |
| `origin_zone_id` | uuid FK | Origin zone the rate applies to. |
| `dest_zone_id` | uuid FK | Destination zone the rate applies to. |
| `parcel_type` | enum | Parcel type (`parcel` or `pallet`). |
| `price_cents` | int | Fixed price in cents for this route × type. |
| `effective_from` | timestamp | Start of this rate card version's validity window. |
| `effective_to` | timestamp, nullable | End of this rate card version's validity window; null while still current. |

### COURIER
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a first/last-mile courier. |
| `zone_id` | uuid FK | The zone the courier operates in. |
| `role` | enum | RBAC role separating Courier from Hub Operator, Dispatcher, Admin. |

### DRIVER
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a line-haul driver. |
| `name_enc` | string | Driver name, field-level encrypted (PII). |

### TRUCK
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a line-haul truck asset. |
| `plate` | string | License plate / registration of the truck. |

### TRACKING_EVENT
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a tracking event (append-only). |
| `parcel_id` | uuid FK | The parcel that was scanned. |
| `hub_id` | uuid FK, nullable | Hub where the scan happened; null for courier-side scans. |
| `courier_id` | uuid FK, nullable | Courier who recorded the scan; null for hub-side scans. |
| `linehaul_trip_id` | uuid FK, nullable | The line-haul trip the parcel was moving on; set for transit scans. |
| `event_type` | enum | Scan type (e.g. `PICKUP`, `HUB_RECEIVE`, `DEPARTED_LINEHAUL`, `ARRIVED_AT_HUB`, `OUT_FOR_DELIVERY`, `DELIVERY_FAILED`, `DELIVERED`, `MISROUTED`, `RTS`). |
| `created_at` | timestamp | Immutable event timestamp (UTC); the store is strictly append-only. |

### PROOF_OF_DELIVERY
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a proof-of-delivery record. |
| `scan_event_id` | uuid FK | The `DELIVERED` scan event this proof is attached to. |
| `parcel_id` | uuid FK | The parcel that was delivered. |
| `signature_url` | string, nullable | Stored recipient signature image URL. |
| `photo_url` | string, nullable | Stored delivery photo URL. |

---

## 2. Relationships

| From | To | Cardinality | Meaning |
| :--- | :--- | :--- | :--- |
| CUSTOMER | SHIPMENT_ORDER | 1 : N | A customer sends/receives many orders |
| SHIPMENT_ORDER | PARCEL | 1 : N | An order contains one or more parcels |
| SHIPMENT_ORDER | PAYMENT | 1 : 1 | An order has one payment record |
| PAYMENT | PAYMENT_TRANSACTION | 1 : 0..1 | Processed by a provider transaction |
| PARCEL | DELIVERY_ATTEMPT | 1 : N | A parcel has many delivery attempts |
| PARCEL | TRACKING_EVENT | 1 : N | Each parcel has many scan events (tracking timeline) |
| ROUTE | PARCEL | 1 : N | A parcel travels along one corridor/route |
| HUB | LINEHAULTRIP | 1 : N | Hub as origin / destination of trips |
| DRIVER / TRUCK | LINEHAULTRIP | 1 : N | Assigned to trips |
| HUB / COURIER | TRACKING_EVENT | 1 : N | A scan is recorded at a hub or by a courier |
| TRACKING_EVENT | PROOF_OF_DELIVERY | 1 : 0..1 | A `DELIVERED` scan captures one proof of delivery |
| PARCEL | PROOF_OF_DELIVERY | 1 : N | Proof of delivery is linked to the parcel |
| ZONE | HUB / ROUTE / RATECARD / COURIER | 1 : N | Zone groups hubs, routes, rate cards, and couriers |
