# Analysis

> This document captures the **original, pre-scope-cut** analysis of the problem space — including the Bag/Manifest consolidation model that was later removed. It exists to preserve *why* the system was designed the way it was before being descoped. For the current, authoritative design, see [docs/06-specification.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/06-specification.md), [docs/01-ERD.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/01-ERD.md), and [docs/04-business-rules.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/04-business-rules.md).

## Overview

The Domestic Parcel Shipping System is engineered based on the Hub-and-Spoke Consolidation Model utilizing a NestJS microservices architecture and a NATS event backbone.

In domestic logistics, directly transporting a small parcel from a Sender in Province A to a Recipient in Province B on a point-to-point basis is economically unviable and structurally unscalable. This system is specifically designed to solve the core operational bottleneck: coordinating a Many-to-One-to-Many physical flow.

The system optimizes network efficiency and minimizes per-unit logistics costs through a structured three-phase pipeline:

- **Consolidation**: Local pickup drivers gather individual parcels and bring them to a local Origin Hub. Here, parcels sharing the same destination corridor are aggregated and packed into a single larger physical container or pallet (referred to as a Bag or Manifest).
- **Line-Haul Transport**: High-capacity long-haul trucks transport these sealed Manifests over long distances between major inter-provincial hubs (Origin Hub → Destination Hub).
- **Deconsolidation & Last-Mile**: At the destination hub, the Manifest is unsealed, and individual parcels are separated and assigned to local delivery drivers (vans or motorcycles) for final delivery to the end recipient.

## Physical Flow

### Aggregation Hierarchy

To eliminate structural ambiguity between physical entities, the system enforces a strict data topology:

`Parcel → Bag → Manifest → Trip (LineHaulTrip)`

- **Parcel**: the individual unit of shipment (a pallet is modeled as a large parcel).
- **Bag**: a physical container grouping parcels for the same destination corridor.
- **Manifest**: a sealed unit (one or more bags) loaded onto a line-haul truck, with a manifest document.
- **Trip (LineHaulTrip)**: the scheduled journey of a vehicle carrying one or more manifests between hubs.

Relational mapping: `Parcel.bag_id → Bag.manifest_id → Manifest.trip_id`.

> **Cut from scope**: Bag and Manifest were later removed from the database model (see ADR-004 and `docs/01-ERD.md`). Tracking moved to direct parcel-level scan events; the hierarchy above no longer reflects the implemented system.

## Business Rules (original analysis)

Rules are grouped by area. Each has an enforcement point: a database constraint, service-layer logic, or a state-machine guard.

### Order & Parcel
- An order must have a verified sender, a recipient, valid addresses, and at least one parcel before transitioning to an Active state.
- Each parcel must have a recorded weight and dimensions; pallets are flagged as a distinct type to route away from standard conveyor sortation lines.
- A fixed price is assigned to each order at creation; changes are barred unless a physical dimension/weight discrepancy is flagged during initial hub ingestion.
- An order reaches a terminal Complete state only when all its constituent parcels are marked as Delivered or Returned to Sender.

### Consolidation & Sortation
- A parcel belongs to at most one bag at a time; a bag belongs to at most one LineHaulTrip at a time.
- A parcel must be scanned into a physical hub (`HUB_RECEIVE`) before it can change status to bagged or sorted.
- At sorting centers, parcels are dynamically routed to target delivery hubs based on the destination postal code/province matrix.
- A parcel cannot be loaded onto a line-haul vehicle unless it is associated with a sealed, valid manifest matching the vehicle's assigned destination.

### Transport & Legs
- A LineHaulTrip is bound to exactly one driver and one truck asset for its duration.
- First-mile and last-mile pickup/delivery legs are assigned exclusively to active, verified couriers.
- A parcel's state can only transition to Out for Delivery if its current location matches the designated destination hub of its route.

### Tracking & Scan Events
- Every state transition must produce an immutable, timestamped scan event payload.
- Scan events are strictly append-only; corrections require a new compensatory event record, never a database UPDATE.
- An order's master visibility status is computed from the least-advanced status among its constituent parcels' latest scan events, and is stored as a materialized projection (read model) rather than aggregated live on every read to satisfy the latency target.

### Delivery & Exceptions
- Failed deliveries may be re-attempted up to a system-configured threshold (default: 3). Exceeding this limit triggers an automatic Return to Sender (RTS) sub-flow.
- Returned parcels travel backward through the reverse path of the network and require scan tracking at every hub.
- Cash-on-delivery (COD) collections must be captured, signed, and reconciled.

> **Rule Catalogue**: see [docs/04-business-rules.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/04-business-rules.md) for the current, authoritative BR-01–BR-10 catalogue. The original BR-01–BR-10 numbering used during this early analysis phase (Bag uniqueness, manifest reconciliation, etc.) was superseded and is not reproduced here to avoid two catalogues sharing the same IDs with different meanings.

## Requirements (original analysis)

> **Original capability list before scope reduction** — Bulk Consolidation and Deconsolidation Engine were later cut. See [docs/06-specification.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/06-specification.md) for the current scoped Functional Requirements.

- Order Management: Capture order payloads containing sender/recipient profiles, multi-parcel manifests, and standardized address formats.
- First-Mile Dispatch: Route and dispatch first-mile collection requests to local couriers based on proximity.
- Bulk Consolidation: Support the virtual grouping of parcels into bags and assign those bags to cross-province line-haul vehicle manifests.
- Sortation Routing: Calculate and display sorting lanes at the transfer center based on parcel destination maps.
- Deconsolidation Engine: Unseal bags at target delivery hubs, auto-updating child parcel arrays, and partition them into last-mile courier queues.
- Real-Time Tracking Ledger: Emit and persist timestamped events at every network node scan.
- Upfront Quoting Engine: Resolve fixed pricing using active rate card tables cross-referencing route distance, volumetric metrics, and premium attributes at creation.
- Visibility API: Calculate and serve unified tracking event streams for client-facing UIs.
- Exception Workflows: Orchestrate delivery retry logic, payment capture recording for COD, and automated reverse-routing loops for package returns.

> **Non-Functional Requirements**: see [docs/06-specification.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/06-specification.md) — kept in one place to avoid two copies drifting apart.
