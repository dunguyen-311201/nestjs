# Shipping System — Estimation (16-day scoped slice)

## Overview
A domestic parcel shipping system built on a hub-and-spoke network with NestJS microservices and a NATS event backbone. This estimation covers one end-to-end vertical slice with full workflow coverage for every actor: Sender, Recipient, Courier, Hub Operator, Dispatcher, and System.

## Timeline
- Estimated time: 16 days
- Actual time: *(track as work progresses)*

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
| — | **Total** | **16.0** |

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

### Phase 6 — Operational Services (2.5d)
- **6.1** Courier Service: pickup/delivery legs + scan events
- **6.2** Hub/Sortation: HUB_RECEIVE, parcel inbound/outbound scan at hub
- **6.3** PII field-level encryption (shared crypto helper)
- **6.4** Line-haul: trip creation, depart/arrive hooks, deconsolidation
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

