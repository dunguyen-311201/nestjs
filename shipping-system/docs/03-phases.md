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
- Domain research & actor mapping
- Finalize business rules + functional/non-functional requirements

### Phase 2 — Design Docs (1.0d)
- Review ERD, cross-service communication schemas, physical data flows
- Define problems, approaches, baseline plans

### Phase 3 — HLD + ADRs (1.5d)
- Service boundaries & per-service data ownership (incl. ZONE/ROUTE → Hub, DELIVERYPROOF → Courier)
- NATS subjects/patterns + event contracts
- API Gateway REST endpoints outline
- Write ADRs: ADR-001 (NATS JetStream serialization), ADR-002 (ORM), ADR-003 (shared-DB-for-slice)

### Phase 4 — Project Setup (1.5d)
- Initialize Monorepo & NestJS service scaffolds
- Configure local docker-compose (NATS JetStream + Postgres + Redis cache)
- Build shared libs (DTOs, event schemas, global config)

### Phase 5 — Core Backend (6.0d)
- Order Service: entities, DTOs, order-creation logic
- Parcel State Machine + guard conditions
- Terminal exception states (Partially_Delivered, Lost, Damaged, Misrouted) + RTS flags
- Pricing Service: rate-card matrix + Order-to-Pricing sync
- Tracking Service: append-only event store + consumers
- Status projection (read model, <300ms) + Transactional Outbox
- Per-aggregate serialization: NATS JetStream per-order subject + event-batching
- Payment: Stripe Checkout session + webhook handler + `STRIPE_TRANSACTION` log + prepaid dispatch guard (BR-08)

### Phase 6 — Operational Services (2.5d)
- Courier Service: pickup/delivery legs + scan events
- Hub/Sortation: HUB_RECEIVE, parcel inbound/outbound scan at hub
- PII field-level encryption (shared crypto helper)
- Line-haul: trip creation, depart/arrive hooks, deconsolidation
- Dispatcher Service: driver/truck-to-trip + courier-to-leg assignment
- Notification consumer: stateless email dispatcher on order/payment/delivery/RTS/lost events (BR-09)

### Phase 7 — Integration & E2E (1.0d)
- Wire the full vertical slice in local docker-compose
- Document the full end-to-end workflow walkthrough
- Automate 1 happy-path integration test

### Phase 8 — Testing, Demo & Docs (1.0d)
- Unit tests for rule guards & state-machine transitions
- Concrete demo script (Order -> Track simulation, single happy path)
- Final README

