# ADR-004: Non-Polymorphic ScanEvent (Parcel-Level Tracking)

## Status
Accepted

## Context
In large-scale logistics networks, scan events can be polymorphic, referencing either a `parcel_id`, a `bag_id`, or a `manifest_id` (representing nested groups of parcels loaded onto trucks). Implementing polymorphic scan models requires complex database relations and recursive queries to resolve the location and history of individual parcels.

## Decision
For this vertical slice, we will implement a **strictly non-polymorphic, parcel-level `ScanEvent` structure**:

1.  The `scan_events` table will reference `parcel_id` directly as a plain UUID foreign key.
2.  Bags, manifests, and multi-level scanning are cut from the scope of database tables.
3.  Any physical grouping of packages (loading onto trucks, etc.) is tracked in-transit by linking the `linehaul_trip_id` directly to each parcel's `ScanEvent` during inbounding/outbounding.
4.  A parcel's location is resolved by querying its latest scan event directly, without traversing nested bag or manifest tables.

## Consequences
*   **Pros**:
    *   Significantly simplifies the database schema and query logic for end-user tracking timelines.
    *   Eliminates recursive database traversal, keeping response times under the `300ms` target.
*   **Cons**:
    *   The database does not maintain physical container/bag audit trails (shortage/overage reconciliation must be handled by passive SLA tracking).
