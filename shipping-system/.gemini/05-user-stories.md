# User Stories & Use Cases (Shipping System)

This document outlines the user stories, use cases, and Gherkin-style acceptance criteria for the Shipping System vertical slice.

---

## 1. Actor Mapping
*   **Sender (Người gửi)**: Creates orders, manages ship requests, and views billing/pricing.
*   **Recipient (Người nhận)**: Tracks package delivery status.
*   **Courier (Nhân viên giao nhận)**: Handles first-mile pickup and last-mile delivery chặng cuối.
*   **Hub Operator (Nhân viên kho)**: Records inbound scans (`HUB_RECEIVE`), sorts parcels, and prepares transfers.
*   **Dispatcher (Người điều phối)**: Assigns drivers/trucks to trips and couriers to delivery legs.
*   **Finance Controller (Nhân viên tài chính)**: Audits shipping fees and reconciles/settles COD cash collected.

---

## 2. Core User Stories

### US-01: Order Creation and Price Locking (Sender)
**As a** Sender,
**I want to** create a shipping order and lock in the pricing immediately,
**So that** I have a guaranteed cost rate and my parcels are entered into the tracking queue.

*   **Acceptance Criteria 1: Successful Validation**
    *   **Given** a Sender has filled in valid sender address, recipient address, and parcel dimensions/weights.
    *   **When** they submit the order request.
    *   **Then** the system checks active RateCard mappings, calculates the cước phí (shipping fee), locks it in `price_cents`, and transitions the Order status to `Created`.
*   **Acceptance Criteria 2: Mandatory Parcel Constraints**
    *   **Given** an order has no associated parcels.
    *   **When** the Sender attempts to save the order.
    *   **Then** the system rejects the transaction with a validation error.

### US-02: Courier Assignment & Pickup Scan (Courier & Dispatcher)
**As a** Courier,
**I want to** perform a pickup scan at the sender's location,
**So that** the system registers that I have taken physical custody of the parcel.

*   **Acceptance Criteria 1: State Change to Picked Up**
    *   **Given** a parcel is in the `Awaiting_Pickup` state and assigned to a Courier.
    *   **When** the Courier scans the parcel at pickup.
    *   **Then** the system inserts a `PICKUP` `ScanEvent`, updates `PARCEL.state` to `Picked_Up`, and broadcasts a `parcel.picked_up` event via NATS JetStream.

### US-03: Hub Inbound Sortation (Hub Operator)
**As a** Hub Operator,
**I want to** scan incoming parcels (`HUB_RECEIVE`),
**So that** they are checked into the sorting hub and their physical weight is audited.

*   **Acceptance Criteria 1: Hub Inbound & Weight Audit**
    *   **Given** a parcel has been picked up or is in transit.
    *   **When** the operator performs a `HUB_RECEIVE` scan at the Origin Hub and enters the actual weight.
    *   **Then** the system logs the `HUB_RECEIVE` `ScanEvent`, sets `PARCEL.actual_weight_grams`, and flags any weight/cước audit discrepancies downstream without delaying the package journey.

### US-04: Multi-Attempt Delivery & RTS (Courier)
**As a** Courier,
**I want to** log a failed delivery attempt,
**So that** the system tracks retry limits and automatically routes the parcel back to the sender after 3 failures.

*   **Acceptance Criteria 1: Record Failed Attempt**
    *   **Given** a parcel is `Out_for_Delivery`.
    *   **When** the Courier reports a delivery failure (e.g. customer unavailable).
    *   **Then** the system logs a `DELIVERY_FAILED` `ScanEvent` and increments the failure counter.
*   **Acceptance Criteria 2: Auto-RTS on 3rd Failure**
    *   **Given** a parcel has 2 previous failure logs.
    *   **When** the Courier records the 3rd `DELIVERY_FAILED` event.
    *   **Then** the system transitions the parcel to `RTS` state, flips `direction` to `Reverse`, and clears the failure counter for the return leg.

### US-05: COD Collection and Financial Settlement (Courier & Finance)
**As a** Finance Controller,
**I want to** reconcile the cash collected by couriers against delivered COD orders,
**So that** driver accounts are settled and money is verified.

*   **Acceptance Criteria 1: Cash Reconciliation**
    *   **Given** a Courier has successfully delivered 3 COD parcels and collected the cash.
    *   **When** they return to the Hub at the end of the day and deposit the cash.
    *   **Then** the Finance Controller verifies the total cash matches the sum of `cod_collected_cents` in the `DELIVERYPROOF` database, marking the settlement transaction as `Settled`.
