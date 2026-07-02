# Updated High-Level Design (HLD)

This document provides the high-level system topology, microservice divisions, NATS event patterns, and REST endpoints for the Shipping System, including Stripe payments and Email notifications.

---

## 1. Microservice Scopes

We divide the shipping vertical slice into four distinct physical services:

| Service | Bounded Context | Database Schema | Primary Role |
| :--- | :--- | :--- | :--- |
| **Order Service** | `order-service` | `db_order` | Owns order creation, pricing calculation/locking, client visibility status projections. |
| **Tracking Service** | `tracking-service` | `db_tracking` | Owns the append-only scan event store, location tracking, and state machine validation. |
| **Payment Service** | `payment-service` | `db_payment` | Integrates with Stripe SDK to handle PaymentIntent creations, webhooks, and refund flows. |
| **Notification Service** | `notification-service` | None (Stateless) | Listens to NATS events and sends automated email notifications using SMTP. |

---

## 2. NATS JetStream Event Map

The asynchronous communication between services uses the following subjects:

| Subject | Publisher | Consumer | Payload Details |
| :--- | :--- | :--- | :--- |
| `order.created` | `order-service` | `payment-service`, `notification-service` | Emitted when a new order is saved via transaction outbox. Triggers Stripe session creation and mail confirmation. |
| `payment.succeeded` | `payment-service` | `order-service`, `notification-service` | Emitted on successful Stripe charge webhook. Updates order status to `Confirmed`. |
| `parcels.events.scanned` | `tracking-service` | `order-service`, `notification-service` | Carries tracking updates: `parcel_id`, `status` (Picked_Up, In_Transit, Out_for_Delivery, etc.), `location_hub_id`, `timestamp`. |
| `orders.status.<order_id>` | `order-service` (internal) | `order-service` | Debounces and serializes state update triggers per order. |

---

## 3. REST API Endpoints

### 3.1 Order Service API
*   `POST /orders`: Create new order and child parcels. Returns the order payload, locked price, and expected ETA.
*   `GET /orders/:id`: Query the materialized status projection of the order.
*   `POST /settlements`: Finance controller reconciles and registers driver cash deposits.

### 3.2 Payment Service API
*   `POST /payments/checkout`: Create a Stripe Checkout/PaymentIntent session for an order.
*   `POST /payments/webhook`: Receive async payment confirmations from Stripe Webhooks.

### 3.3 Tracking Service API
*   `POST /scans`: Register a parcel scan (Picked Up, Hub Receive, In Transit).
*   `POST /scans/deliver`: Complete last-mile delivery and upload proof-of-delivery (signature/photo).
*   `GET /tracking/:tracking_id`: Access the full chronological scan timeline of a parcel.
