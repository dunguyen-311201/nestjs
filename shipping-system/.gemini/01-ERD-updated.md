# Updated Entity-Relationship Diagram (ERD)

This document describes the updated PostgreSQL data model, aligned with the simplified NestJS microservice architecture, including payments, Stripe transaction tracking, COD settlements, and delivery attempts.

---

## Visual Diagram (Mermaid)

```mermaid
erDiagram
    CUSTOMER {
        uuid id PK
        string name_enc
        string phone_enc
        string address_enc
        string region_code
    }
    ORDER {
        uuid id PK
        uuid sender_id FK
        uuid recipient_id FK
        int price_cents
        timestamp expected_delivery_at
        enum status
    }
    PARCEL {
        uuid id PK
        uuid order_id FK
        int declared_weight_grams
        int actual_weight_grams
        enum direction
        enum state
    }
    DELIVERY_ATTEMPT {
        uuid id PK
        uuid parcel_id FK
        int attempt_number
        string failure_reason
        timestamp created_at
    }
    PAYMENT {
        uuid id PK
        uuid order_id FK
        enum type
        int amount_cents
        enum status
    }
    STRIPE_TRANSACTION {
        uuid id PK
        uuid payment_id FK
        string stripe_intent_id
        string stripe_charge_id
        string status
        timestamp created_at
    }
    COD_SETTLEMENT {
        uuid id PK
        uuid courier_id FK
        int total_collected_cents
        enum status
        timestamp reconciled_at
    }
    SCANEVENT {
        uuid id PK
        uuid parcel_id FK
        uuid hub_id FK
        enum event_type
        timestamp created_at
    }

    CUSTOMER ||--o{ ORDER : "sends/receives"
    ORDER ||--|{ PARCEL : "contains"
    ORDER ||--|| PAYMENT : "has"
    PAYMENT ||--o| STRIPE_TRANSACTION : "processed_by"
    PARCEL ||--o{ DELIVERY_ATTEMPT : "records"
    PARCEL ||--o{ SCANEVENT : "tracks"
```

---

## 1. Entities

### CUSTOMER
*   `id` (UUID PK): Unique identifier.
*   `name_enc` (VARCHAR): Encrypted name (PII).
*   `phone_enc` (VARCHAR): Encrypted phone (PII).
*   `address_enc` (VARCHAR): Encrypted address (PII).
*   `region_code` (VARCHAR): Plaintext zone routing key.

### ORDER
*   `id` (UUID PK): Unique identifier.
*   `sender_id` (UUID FK): References `CUSTOMER`.
*   `recipient_id` (UUID FK): References `CUSTOMER`.
*   `price_cents` (INT): Locked cước phí.
*   `expected_delivery_at` (TIMESTAMP): Locked calculated ETA.
*   `status` (ENUM): Projections status (`Draft`, `Created`, `Confirmed`, `Awaiting_Pickup`, `Picked_Up`, `In_Transit`, `Delivered`, etc.).

### PARCEL
*   `id` (UUID PK): Unique identifier.
*   `order_id` (UUID FK): References `ORDER`.
*   `declared_weight_grams` (INT): Weight declared.
*   `actual_weight_grams` (INT, Nullable): Measured weight at hub inbound.
*   `direction` (ENUM): `Forward` or `Reverse` (RTS).
*   `state` (ENUM): Current status state machine.

### DELIVERY_ATTEMPT
*   `id` (UUID PK): Unique identifier.
*   `parcel_id` (UUID FK): References `PARCEL`.
*   `attempt_number` (INT): 1, 2, or 3.
*   `failure_reason` (VARCHAR): Detail (e.g. customer absent, rejected by recipient).
*   `created_at` (TIMESTAMP): Time of attempt.

### PAYMENT
*   `id` (UUID PK): Unique identifier.
*   `order_id` (UUID FK): References `ORDER`.
*   `type` (ENUM): `PREPAID_STRIPE`, `COD`, `POSTPAID`.
*   `amount_cents` (INT): Value.
*   `status` (ENUM): `Unpaid`, `Paid`, `Awaiting_Settlement`.

### STRIPE_TRANSACTION
*   `id` (UUID PK): Unique identifier.
*   `payment_id` (UUID FK): References `PAYMENT`.
*   `stripe_intent_id` (VARCHAR): Stripe PaymentIntent ID.
*   `stripe_charge_id` (VARCHAR): Stripe Charge ID.
*   `status` (VARCHAR): `succeeded`, `failed`, `pending`.
*   `created_at` (TIMESTAMP): Stripe event timestamp.

### COD_SETTLEMENT
*   `id` (UUID PK): Unique identifier.
*   `courier_id` (UUID FK): References `COURIER`.
*   `total_collected_cents` (INT): Verified cash amount.
*   `status` (ENUM): `Pending`, `Settled`.
*   `reconciled_at` (TIMESTAMP): Reconciled time.

### SCANEVENT (Tracking Database)
*   `id` (UUID PK): Unique identifier.
*   `parcel_id` (UUID FK): Logical key.
*   `hub_id` (UUID, Nullable): Location hub.
*   `event_type` (ENUM): Scan action (`PICKUP`, `HUB_RECEIVE`, `OUT_FOR_DELIVERY`, etc.).
*   `created_at` (TIMESTAMP): Log timestamp.

---

## 2. Entity Relationships (Crow's Foot Notation)

*   `CUSTOMER` has many `ORDER` (1 : N)
*   `ORDER` has many `PARCEL` (1 : N)
*   `ORDER` has one `PAYMENT` (1 : 1)
*   `PAYMENT` has one `STRIPE_TRANSACTION` (1 : 0..1)
*   `PARCEL` has many `DELIVERY_ATTEMPT` (1 : N)
*   `PARCEL` has many `SCANEVENT` (1 : N logical correlation)
*   `COURIER` has many `COD_SETTLEMENT` (1 : N)
