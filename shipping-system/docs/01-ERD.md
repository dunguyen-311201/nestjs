# Entity-Relationship Diagram (ERD)

This document describes the PostgreSQL data model, aligned with the simplified NestJS microservice architecture, including payments, Stripe transaction tracking, COD settlements, and delivery attempts.

---

## Visual Diagram (Mermaid)

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : "sends/receives"
    ORDER ||--|{ PARCEL : "contains"
    ORDER ||--|| PAYMENT : "has"
    PAYMENT ||--o| STRIPE_TRANSACTION : "processed_by"
    PARCEL ||--o{ DELIVERY_ATTEMPT : "records"
    PARCEL ||--o{ SCANEVENT : "tracks"
    COURIER ||--o{ COD_SETTLEMENT : "settles"
    ROUTE ||--o{ PARCEL : "directs"
    HUB ||--o{ LINEHAULTRIP : "originates/terminates"
    DRIVER ||--o{ LINEHAULTRIP : "drives"
    TRUCK ||--o{ LINEHAULTRIP : "transports"
    ZONE ||--o{ HUB : "contains"
    ZONE ||--o{ ROUTE : "defines"
    ZONE ||--o{ RATECARD : "prices"
    ZONE ||--o{ COURIER : "deploys"
    SCANEVENT ||--o| DELIVERYPROOF : "attaches"
    PARCEL ||--o{ DELIVERYPROOF : "proves"
    HUB ||--o{ SCANEVENT : "records"
    COURIER ||--o{ SCANEVENT : "records"
    LINEHAULTRIP ||--o{ SCANEVENT : "associates"
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

### ORDER
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
| `order_id` | uuid FK | The order this parcel belongs to. |
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
| `failure_reason` | string | Reason for delivery failure (e.g. customer absent, rejected). |
| `created_at` | timestamp | Timestamp when the attempt was made. |

### PAYMENT
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of the payment record. |
| `order_id` | uuid FK | References the ORDER this payment is for. |
| `type` | enum | `PREPAID_STRIPE`, `COD`, `POSTPAID`. |
| `amount_cents` | int | Value of the payment in cents. |
| `status` | enum | `Unpaid`, `Paid`, `Awaiting_Settlement`. |

### STRIPE_TRANSACTION
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of the transaction. |
| `payment_id` | uuid FK | References the PAYMENT. |
| `stripe_intent_id` | string | Stripe PaymentIntent ID. |
| `stripe_charge_id` | string | Stripe Charge ID. |
| `status` | string | Stripe charge status (`succeeded`, `failed`, `pending`). |
| `created_at` | timestamp | Timestamp of the transaction. |

### COD_SETTLEMENT
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier. |
| `courier_id` | uuid FK | References the COURIER who collected the cash. |
| `total_collected_cents` | int | Total cash amount collected and verified. |
| `status` | enum | `Pending`, `Settled`. |
| `reconciled_at` | timestamp, nullable | Timestamp of financial settlement reconciliation. |

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

### SCANEVENT
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a scan event (append-only). |
| `parcel_id` | uuid FK | The parcel that was scanned. |
| `hub_id` | uuid FK, nullable | Hub where the scan happened; null for courier-side scans. |
| `courier_id` | uuid FK, nullable | Courier who recorded the scan; null for hub-side scans. |
| `linehaul_trip_id` | uuid FK, nullable | The line-haul trip the parcel was moving on; set for transit scans. |
| `event_type` | enum | Scan type (e.g. `PICKUP`, `HUB_RECEIVE`, `DEPARTED_LINEHAUL`, `ARRIVED_AT_HUB`, `OUT_FOR_DELIVERY`, `DELIVERY_FAILED`, `DELIVERED`, `MISROUTED`, `RTS`). |
| `created_at` | timestamp | Immutable event timestamp (UTC); the store is strictly append-only. |

### DELIVERYPROOF
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid PK | Unique identifier of a proof-of-delivery record. |
| `scan_event_id` | uuid FK | The `DELIVERED` scan event this proof is attached to. |
| `parcel_id` | uuid FK | The parcel that was delivered. |
| `signature_url` | string, nullable | Stored recipient signature image URL. |
| `photo_url` | string, nullable | Stored delivery photo URL. |
| `cod_collected_cents` | int, nullable | Cash-on-delivery amount collected, if order is COD. |

---

## 2. Relationships

| From | To | Cardinality | Meaning |
| :--- | :--- | :--- | :--- |
| CUSTOMER | ORDER | 1 : N | A customer sends/receives many orders |
| ORDER | PARCEL | 1 : N | An order contains one or more parcels |
| ORDER | PAYMENT | 1 : 1 | An order has one payment record |
| PAYMENT | STRIPE_TRANSACTION | 1 : 0..1 | Processed by Stripe transaction |
| PARCEL | DELIVERY_ATTEMPT | 1 : N | A parcel has many delivery attempts |
| PARCEL | SCANEVENT | 1 : N | Each parcel has many scan events (tracking timeline) |
| COURIER | COD_SETTLEMENT | 1 : N | A courier has many cash settlements |
| ROUTE | PARCEL | 1 : N | A parcel travels along one corridor/route |
| HUB | LINEHAULTRIP | 1 : N | Hub as origin / destination of trips |
| DRIVER / TRUCK | LINEHAULTRIP | 1 : N | Assigned to trips |
| HUB / COURIER | SCANEVENT | 1 : N | A scan is recorded at a hub or by a courier |
| SCANEVENT | DELIVERYPROOF | 1 : 0..1 | A `DELIVERED` scan captures one proof of delivery |
| PARCEL | DELIVERYPROOF | 1 : N | Proof of delivery is linked to the parcel |
| ZONE | HUB / ROUTE / RATECARD / COURIER | 1 : N | Zone groups hubs, routes, rate cards, and couriers |
