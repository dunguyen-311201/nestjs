# Scope & Business Rules Analysis Review

This document provides a comparative analysis between the general specification provided in the **Google Doc** and the **16-day Scoped Vertical Slice** defined in [CLAUDE.md](file:///home/dunguyen/Training/nestjs/shipping-system/CLAUDE.md) and [docs/04-business-rules.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/04-business-rules.md).

---

## 1. Scope Contradiction Analysis

The primary discrepancy between the Google Doc and the current workspace configuration is the inclusion of physical aggregation entities (**Bags** and **Manifests**).

| Feature / Concept | Google Doc (General Spec) | Active Workspace Scope ([CLAUDE.md](file:///home/dunguyen/Training/nestjs/shipping-system/CLAUDE.md)) | Implementation Consequence |
| :--- | :--- | :--- | :--- |
| **Bags & Manifests** | **Included**: Modeled as database entities. Toplogy: `Parcel -> Bag -> Manifest -> Trip`. | **CUT**: Physical-only actions. **Not modeled as tables/entities** in the DB. | Parcels are associated directly with Hubs and Trips. No nesting in bags/manifests. |
| **Consolidation / Deconsolidation Logic** | **Included**: Logic to group parcels into bags and unseal them at destination hubs. | **CUT**: The system does not write status updates or perform operations on intermediate groupings. | Parcel state transitions are triggered directly by individual parcel scans. |
| **Manifest Reconciliation** | **Included**: Audit logic for manifest shortages/overage checks at hubs. | **CUT**: Passive tracking only. | Lost parcels are detected passively (no scan at the next expected destination) rather than an active audit. |
| **Scan Events** | **Multi-level Scanning**: Scanning of manifests, bags, and parcels. | **Parcel-only**: `ScanEvent` references `parcel_id` only (non-polymorphic). | Simplified scan structure. Only single-level parcel scanning is supported. |

---

## 2. Business Rules Comparison

Here is the translation of the business rules between the general specification and the renumbered scoped slice:

### Locked & Constant Rules
*   **Pricing (BR-01)**: Price is locked at order creation via rate-card lookup. This matches the Google Doc rule.
*   **Scan Log (BR-03)**: The scan log is strictly append-only. Corrections emit compensating events (no database `UPDATE`s). This matches the Google Doc rule.
*   **Misrouted Parcels (BR-02)**: Last-mile delivery (`Out_for_Delivery`) is blocked if the current location does not match the destination hub. Scan at a wrong hub enters a terminal/exception `Misrouted` state and triggers corrective re-routing.

### Modified or Cut Rules
*   **RTS Flow (BR-04)**: After 3 failed delivery attempts, the parcel enters the `Return-to-Sender` flow. In the scoped slice, this keeps the original tracking ID and updates `direction = Reverse` to prevent routing loops. (Google Doc referenced reverse-routing generally but did not define the `direction` field constraint).
*   **Order Projections (BR-05 & BR-07)**:
    *   `ORDER.status` is a materialized projection computed as the *least-advanced status* among its constituent parcels.
    *   To satisfy the `<300ms` latency target under burst loads, updates are serialized per-aggregate via a NATS JetStream per-order subject (`orders.status.<order_id>`) and debounced/batched.
*   **Weight Reconciliation (BR-06)**: If the origin hub's measured weight differs from the declared weight, the parcel is *not* held. It continues transport, and the discrepancy is reconciled downstream (COD adjustments or post-delivery invoicing).

---

## 3. Recommended Design Actions

To align the codebase with the scoped slice, we must enforce the following rules during implementation:

1.  **Do NOT create tables** for `Bag`, `Manifest`, or `ManifestReconciliation`.
2.  **Ensure `ScanEvent` references `parcel_id`** directly as a single plain UUID. Do not support polymorphic references to bags or manifests.
3.  **Implement status resolution logic** where `Order.status = min(Parcels.status)`.
4.  **Enforce state machine transitions** on the `Parcel` model directly (e.g., `HUB_RECEIVE` -> `IN_TRANSIT` -> `DELIVERED`/`RTS`/`LOST`).
