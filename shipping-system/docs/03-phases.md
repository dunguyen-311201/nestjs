# Shipping System — Implementation Phases (16-day scoped slice)

| # | Phase | Est (d) | Tasks |
|---|---|---|---|
| 1 | Analysis | 1.0 | Domain research & actor mapping; Finalize business rules + functional/non-functional requirements |
| 2 | Design Docs | 1.0 | Review ERD, cross-service communication schemas, physical data flows; Define problems, approaches, baseline plans |
| 3 | HLD + ADRs | 2.0 | Service boundaries & per-service data ownership (incl. ZONE/ROUTE → Hub, DELIVERYPROOF → Courier); NATS subjects/patterns + event contracts; API Gateway REST endpoints outline; Write ADRs: ADR-001 (NATS JetStream serialization), ADR-002 (ORM), ADR-003 (shared-DB-for-slice) |
| 4 | Project Setup | 1.5 | Initialize Monorepo & NestJS service scaffolds; Configure local docker-compose (NATS JetStream + Postgres + Redis cache); Build shared libs (DTOs, event schemas, global config) |
| 5 | Core Backend | 5.5 | Order Service: entities, DTOs, order-creation logic; Parcel State Machine + guard conditions; Terminal exception states (Partially_Delivered, Lost, Damaged, Misrouted) + RTS flags; Pricing Service: rate-card matrix + Order-to-Pricing sync; Tracking Service: append-only event store + consumers; Status projection (read model, <300ms) + Transactional Outbox; Per-aggregate serialization: NATS JetStream per-order subject + event-batching |
| 6 | Operational Services | 2.0 | Courier Service: pickup/delivery legs + scan events; Hub/Sortation: HUB_RECEIVE, parcel inbound/outbound scan at hub; PII field-level encryption (shared crypto helper); Line-haul: trip creation, depart/arrive hooks, deconsolidation; Dispatcher Service: driver/truck-to-trip + courier-to-leg assignment |
| 7 | Integration & E2E | 1.5 | Wire the full vertical slice in local docker-compose; Document the full end-to-end workflow walkthrough; Automate 1-2 happy-path integration tests; stub edge cases |
| 8 | Testing, Demo & Docs | 1.5 | Unit tests for rule guards & state-machine transitions; Concrete demo script (Order -> Track simulation); Phase-2 Defer-List + final README |
