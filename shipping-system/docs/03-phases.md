# Shipping System — Estimation (16-day scoped slice)

## Overview
A domestic parcel shipping system built on a hub-and-spoke network with NestJS microservices and a NATS event backbone. This estimation covers one end-to-end vertical slice with full workflow coverage for every actor: Sender, Recipient, Courier, Hub Operator, Dispatcher, and System.

## Timeline
- Estimated time: 16 days (original slice) + 4 days Auth & RBAC extension (Phase 9) + 2 days shipper per-resource ownership (Phase 10) = 22 days
- Actual time: *(track as work progresses; Phase 9.1 done 16 Jul)*

## Actor Coverage
| Actor | Operational Workflow | Covered Component |
| :--- | :--- | :--- |
| **Sender** | Create order, get rate quotation, complete payment (Stripe checkout) | Customer Order Form + Checkout |
| **Recipient** | Receive parcel, view end-to-end tracking | Tracking Timeline / Shared Link |
| **Courier** | Pickup & last-mile, scanning, Proof of Delivery | Courier Service + Mobile UI |
| **Hub Operator** | Inbound scan, network topology (zone/route) | Hub Service + Scan Station UI |
| **Dispatcher** | Route planning, vehicle & driver assignment | Dispatcher Service + Trip Board UI |
| **System** | Event-driven status & automated tracking, best-effort notifications | NATS Events, Projections, Outbox, Notification Consumer |

## Roadmap Summary
| Period | Milestone |
| :--- | :--- |
| **25–26 Jun** | Analysis + design docs complete (done) |
| **Week 1** | HLD finalized, ADRs written, project scaffolded (local Docker), core backend event chain working |
| **Week 2** | Exception states + state machine; operational services (Courier, Hub, Line-haul, Dispatcher); Payment (Stripe) + PII |
| **Week 3** | Slice wired end to end; full workflow documented; critical-path tests; unit tests, demo (all actors via API), defer-list |
| **14–17 Jul (ext.)** | Auth & RBAC extension: Clerk authentication at the gateway (done 16 Jul) + 3-day role-based authorization ([docs/10-authz-plan.md](./10-authz-plan.md)) |
| **17 Jul → (ext.)** | Phase 10 — shipper per-resource ownership (2.0d): courier↔Clerk identity link, persisted parcel assignment, Courier-endpoint enforcement, per-actor E2E |

## Details Estimation

> Each bullet below is numbered `<phase>.<task>` (e.g. `5.1`) so `/begin-task`
> and `/wrap-task` can address one task at a time instead of an entire
> multi-day phase. Numbering is for reference, not a mandated sequence within
> a phase unless a dependency is noted.

### Summary

| # | Phase | Est (d) |
|---|---|---|
| 1 | Analysis | 1.0 |
| 2 | Design Docs | 1.0 |
| 3 | HLD + ADRs | 1.5 |
| 4 | Project Setup | 1.5 |
| 5 | Core Backend | 6.0 |
| 6 | Operational Services | 3.0 |
| 7 | Integration & E2E | 1.0 |
| 8 | Testing, Demo & Docs | 1.0 |
| — | **Subtotal (original slice)** | **16.0** |
| 9 | Auth & RBAC (extension) | 4.0 |
| 10 | Shipper per-resource ownership | 2.0 |
| — | **Total** | **22.0** |

### Phase 1 — Analysis (1.0d)
- **1.1** Domain research & actor mapping
- **1.2** Finalize business rules + functional/non-functional requirements

### Phase 2 — Design Docs (1.0d)
- **2.1** Review ERD, cross-service communication schemas, physical data flows
- **2.2** Define problems, approaches, baseline plans

### Phase 3 — HLD + ADRs (1.5d)
- **3.1** Service boundaries & per-service data ownership (incl. ZONE/ROUTE → Hub, DELIVERYPROOF → Courier)
- **3.2** NATS subjects/patterns + event contracts
- **3.3** API Gateway REST endpoints outline
- **3.4** Write ADRs: ADR-001 (NATS JetStream serialization), ADR-002 (ORM), ADR-003 (shared-DB-for-slice)

### Phase 4 — Project Setup (1.5d)
- **4.1** Initialize Monorepo & NestJS service scaffolds
- **4.2** Configure local docker-compose (NATS JetStream + Postgres + Redis cache)
- **4.3** Build shared libs (DTOs, event schemas, global config)

### Phase 5 — Core Backend (6.0d)
- **5.1** Order Service: entities, DTOs, order-creation logic
- **5.2** Parcel State Machine + guard conditions
- **5.3** Terminal exception states (Partially_Delivered, Lost, Damaged, Misrouted) + RTS flags
- **5.4** Pricing Service: rate-card matrix + Order-to-Pricing sync
- **5.5** Tracking Service: append-only event store + consumers
- **5.6** Status projection (read model, <300ms) + Transactional Outbox
- **5.7** Per-aggregate serialization: NATS JetStream per-order subject + event-batching
- **5.8** Payment: Stripe Checkout session + webhook handler + `PAYMENT_TRANSACTION` log + prepaid dispatch guard (BR-08)

### Phase 6 — Operational Services (3.0d)
- **6.1** Courier Service: pickup/delivery legs + scan events
- **6.2** Hub/Sortation: HUB_RECEIVE, parcel inbound/outbound scan at hub
- **6.3** PII field-level encryption (shared crypto helper)
- **6.4** Line-haul: trip creation, depart/arrive hooks (consolidation/deconsolidation stays cut — physical-only, not modeled)
- **6.5** Dispatcher Service: driver/truck-to-trip + courier-to-leg assignment
- **6.6** Notification consumer: stateless email dispatcher on order/payment/delivery/RTS/lost events (BR-09)

### Phase 7 — Integration & E2E (1.0d)
- **7.1** Wire the full vertical slice in local docker-compose
- **7.2** Document the full end-to-end workflow walkthrough
- **7.3** Automate 1 happy-path integration test

### Phase 8 — Testing, Demo & Docs (1.0d)
- **8.1** Unit tests for rule guards & state-machine transitions
- **8.2** Concrete demo script (Order -> Track simulation, single happy path)
- **8.3** Final README

### Phase 9 — Auth & RBAC extension (4.0d)

Added after the original 16-day slice. Goal: every main actor authenticates
(Clerk) and operates within their role — customer places/tracks own orders and
receives notifications; shipper picks up/delivers; hub staff runs warehouse
scans; dispatcher assigns; admin sees all. Full design + permission matrix in
[docs/10-authz-plan.md](./10-authz-plan.md).

- **9.1** ✅ Authentication at the gateway (1.0d, done 16 Jul): global
  `ClerkAuthGuard` (Clerk session JWT, `ITokenVerifier` port +
  `@clerk/backend` adapter), public exceptions (health/docs/Stripe webhook),
  spoof-proof `x-user-id`/`x-session-id` propagation, gateway CORS,
  Turborepo + `apps/web` React sign-in/token app.
- **9.2** Role in the token (1.0d): `Role` contract, `VerifiedToken.role`
  from Clerk `publicMetadata` session claim, per-role test users, token
  panel shows role.
- **9.3** Gateway RBAC (1.0d): `ROUTE_ACCESS` map (401 vs 403),
  `x-user-role` injection/strip, per-role smoke tests.
- **9.4** Customer ownership + E2E (1.0d):
  `SHIPMENT_ORDER.created_by_user_id` (nullable, no backfill — legacy orders
  admin-only), `GET /orders` filtering, tracking restricted to own orders
  (fallback: any authenticated customer), per-actor E2E, docs sync.

Out of scope (explicit cuts): per-resource ownership for shipper/hub
(assignee columns), role-management UI, Clerk→DB user sync, multi-role users.

### Phase 10 — Shipper per-resource ownership (2.0d)

First Phase 9 follow-up (was an explicit Phase 9 cut). Goal: a shipper
sees/acts on only work assigned to them. There is no `LEG` table (Dispatcher's
`/legs/{id}/assign` is validation-only and publishes `parcel.out_for_delivery`
with `parcel_id` + `courier_id`), so ownership anchors on `PARCEL` plus a
Clerk-account link on `COURIER`; the assignment is persisted by Order Service
consuming the existing event — no cross-schema write, same convention Hub set.

- **10.1** Identity link + assignment persistence (0.75d):
  `COURIER.user_id` (varchar 64, nullable, unique index) linking the
  shipper's Clerk account to a courier row (DDL + live ALTER + provisioning
  script); `PARCEL.assigned_courier_id` (uuid, nullable) written by Order's
  `ParcelEventConsumer` on `parcel.out_for_delivery`; ERD/LLD/authz-plan
  docs updated — including `dispatcher-service.md`'s v1.1 rationale, whose
  "nothing downstream reads a persisted assignment" clause stops being true
  here (the no-cross-schema-write-by-Dispatcher part still stands).
- **10.2** Enforcement in Courier Service (0.75d): on
  `POST /couriers/legs/{id}/pickup|deliver` with `x-user-role: shipper`,
  resolve the caller's `COURIER` via `x-user-id` and reject a `courier_id`
  that isn't their own; `/deliver` additionally requires
  `PARCEL.assigned_courier_id` to match. Admin bypasses. Pickup happens
  before any assignment exists (assignment is last-mile only), so pickup
  enforces only courier-identity, not parcel assignment. TDD red-first.
- **10.3** Per-actor E2E + docs sync (0.5d): link `shipper.test@example.com`
  to a seed courier; E2E — shipper delivers an assigned parcel (2xx),
  another courier's parcel (403), admin bypass; update
  `docs/07-e2e-walkthrough.md` § actors, `docs/10-authz-plan.md`.

Out of scope (explicit cuts, unchanged): per-resource ownership for
hub_staff, reassignment / multi-courier flows, role-management UI,
Clerk→DB user sync.

