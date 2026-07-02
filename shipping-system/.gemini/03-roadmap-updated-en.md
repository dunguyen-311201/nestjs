# Implementation Roadmap & Estimation

This document defines the structured timeline and milestones for implementing the simplified Shipping System vertical slice.

---

## 1. Milestone Overview

We allocate a **9-day execution timeline** for local development, testing, and documentation, structured around the 5 progressive modules.

| Period | Milestone | Core Focus | Est (Days) |
| :--- | :--- | :--- | :--- |
| **Day 1** | **M1: Core Order Intake** | Scaffolding, Postgres setup, and `CreateOrder` logic (flat rate locking). | 1.5 |
| **Day 2-3** | **M2: Scan Ledger & State Machine** | Append-only `ScanEvent` logging, transition guards, and current state resolution. | 2.0 |
| **Day 4-5** | **M3: NATS Event chain** | NATS JetStream integration, event contracts, async status projections (`orders.status.<id>`). | 2.0 |
| **Day 6-7** | **M4: Courier Delivery & RTS** | Dispatch legs, counting delivery attempts, automatic return-to-sender loops. | 1.5 |
| **Day 8** | **M5: COD Payment Settlement** | COD transaction tracking, end-of-day finance cash reconciliation. | 1.0 |
| **Day 9** | **Integration & E2E Demo** | Full local system tests, demo simulations, and final API validation. | 1.0 |

---

## 2. Detailed Task Breakdown

### Day 1-2: Core Order & Data Setup
*   Create local `docker-compose.yml` and database schemas for `db_order` and `db_tracking` (Completed).
*   Scaffold NestJS services: `order-service` and `tracking-service`.
*   Develop TypeORM entities for `Order` and `Parcel`.
*   Implement `POST /orders` REST API and RateCard pricing lookup logic.

### Day 3-4: Scanning & State Machine Validation
*   Implement TypeORM entities for `ScanEvent` and `DeliveryAttempt`.
*   Develop the `ParcelStateMachine` validation guard to intercept invalid transitions.
*   Implement `POST /scans` API to append scan logs.

### Day 5-6: NATS JetStream Communication
*   Establish NATS JetStream connection module inside NestJS.
*   Implement Event publishing for `parcels.events.scanned`.
*   Build the async subscription consumer in `order-service` to recompute order status.

### Day 7-8: Last-Mile Delivery & Return to Sender (RTS)
*   Implement failed attempts logger.
*   Build the auto-RTS trigger when `attempt_number` reaches 3.
*   Implement `POST /scans/deliver` capturing POD signatures/photos and cash details.

### Day 9: COD Settlement & E2E Validation
*   Implement `POST /settlements` for the Finance Controller.
*   Write an integration test/script simulating the full happy-path flow and RTS flow.
