# Progress Log

> Updated after every task/session. The **Resume point** is the first thing to
> read at the start of a session (`/recap` reads this automatically). Newest
> log entries on top. This is a session-handoff pointer, not a duplicate of
> `TASKS.md` (daily log) — `TASKS.md` wins for detailed history, this file
> wins for "what's next."

## Resume point

- **Current phase:** Phase 5 — Core Backend (6.0d), in progress. See
  `docs/03-phases.md`.
- **Next task:** `5.3` Terminal exception states (`Partially_Delivered`,
  `Lost`, `Damaged`, `Misrouted`) + RTS flags. Run `/begin-task 5.3` to
  start it.
- **Branch:** `feat/shipping-system` (tracks `github/feat/shipping-system`;
  see `CLAUDE.md` § Git Remotes for the dual-remote setup).
- **State:** Task `5.2` (Parcel State Machine + guard conditions) complete,
  committed as 2 logical commits (`b37e8a2` shared `BusinessRuleException`
  in `libs/dtos`, `2ff2075` `ParcelStateMachine` + BR-02 guard in
  `apps/order/src/domain/`). Task `5.1` (Order Service: entities, DTOs,
  order-creation logic) complete, committed as 6 logical commits
  (`b5a2abe` entities, `aff2516` DTO, `103f158` ports, `c6b78b7`
  adapters/repository, `95e2098` service, `f338233` controller/module
  wiring), preceded by `759cb4c` (ADR-006 for `ioredis`).
  `Customer`/`ShipmentOrder`/`Parcel` entities, `CreateOrderDto`,
  `OrderService.createOrder` (UC-02, price/ETA locked via a stubbed
  `IPricingPort` pending task 5.4's real `RATECARD` lookup), thin
  `OrderController` (`POST /orders`, `GET /orders/:id/quote`), Redis-backed
  Idempotency-Key replay, and `ParcelStateMachine.transition()` (happy-path
  transitions + BR-02 guard). `pnpm build`/`pnpm lint`/`pnpm test` all
  green (37 tests: the 9 from Phase 4 + 14 from 5.1 + 14 from 5.2).
- **Notes:** Pricing is in-process inside `order` (own named TypeORM
  connection, not its own app — see `apps/order/src/app.module.ts` and
  `docs/lld/pricing-service.md`). `ParcelStateMachine` is a pure module —
  no REST endpoint, no NATS wiring yet; those land in tasks 5.3/5.5/5.6.
  It deliberately does NOT implement `Misrouted`/`Lost`/`Damaged`/RTS
  transitions (BR-04, second half of BR-02) — that's task 5.3's job,
  since it needs cross-service hub-identity data (`route_id` → Hub
  Service) this module doesn't have. Known open item carried forward
  unchanged: `docs/lld/order-service.md`'s "abandoned prepaid payment"
  gap (no task assigned yet).

## Log

### 2026-07-09 — Task 5.2: Parcel State Machine + guard conditions
- Added shared `BusinessRuleException` in `libs/dtos/src/business-rule.exception.ts`
  (extends `UnprocessableEntityException`, `{ rule, message }` per
  `docs/lld/00-conventions.md`'s error envelope) — confirmed with the user
  first, since this touches a second project (`libs/dtos`) beyond
  `apps/order`, per `docs/lld/00-conventions.md`'s "one shared exception
  class... not a new pattern per service" (`b37e8a2`).
- Added `ParcelStateMachine.transition(currentState, eventType)` in
  `apps/order/src/domain/parcel-state-machine.ts`: a pure lookup table
  covering the happy-path forward transitions (`Created → InTransit →
  InHub → InTransit → InHub → OutForDelivery → Delivered`) plus the
  **BR-02** guard (`Out_for_Delivery` blocked unless arriving from
  `InHub`) (`2ff2075`).
- TDD throughout: `business-rule.exception.spec.ts` (3 tests) and
  `parcel-state-machine.spec.ts` (11 tests: every happy-path transition,
  BR-02 guard-failure from every non-`InHub` state, one generic
  invalid-transition case) — all written and confirmed red before
  implementation. 14 new tests, 37/37 total passing; `pnpm build`/`pnpm
  lint` clean.
- **Deliberate scope boundary**: `Misrouted`/`Lost`/`Damaged`/RTS
  transitions (BR-04, second half of BR-02) are explicitly out of scope
  here — task 5.3's job, since determining "wrong hub" needs
  cross-service hub-identity data (`route_id` → Hub Service) this pure
  module doesn't have. No REST endpoint or NATS wiring yet either — those
  land in tasks 5.3/5.5/5.6.
- **Self-caught mistake, fixed before commit**: an early draft tagged
  *every* invalid transition as `BR-02`, which would have mislabeled
  unrelated FSM edges (e.g. `Delivered` + `PICKUP`) under a rule that
  doesn't describe them. Fixed so only the documented `Out_for_Delivery`
  case throws `BusinessRuleException('BR-02', ...)`; any other
  undefined transition throws a plain `Error` instead.

### 2026-07-09 — Task 5.1: Order Service entities, DTOs, order-creation logic
- Added `ioredis` as a new dependency (approved by user) to back the
  Idempotency-Key store per `docs/lld/00-conventions.md`; documented the
  choice in `docs/adrs/ADR-006-redis-client-selection.md` and registered it
  in `docs/02-HLD.md`'s decision index (`759cb4c`).
- Added `Customer`, `ShipmentOrder`, `Parcel` TypeORM entities
  (`apps/order/src/entities/`) matching `db/init-db.sql`'s
  `shipping_order_db` schema field-for-field, including enum values.
- Added `CreateOrderDto`/`AddressDto`/`OrderParcelDto`
  (`apps/order/src/dto/`) per `docs/lld/order-service.md`'s `POST /orders`
  contract.
- Implemented UC-02 order creation in `OrderService` (Ports & Adapters:
  `IOrderRepository`/`OrderRepository`, `IPricingPort`/`PricingStubAdapter`,
  `IIdempotencyStore`/`RedisIdempotencyAdapter`) — price/ETA locked
  (BR-01), PII encrypted via `@app/crypto` before persisting, one DB
  transaction for order+parcels, Idempotency-Key replay-cache.
- Added thin `OrderController` (`POST /orders`, `GET /orders/:id/quote`),
  wired via `order.module.ts` into `apps/order/src/app.module.ts`.
- TDD throughout: DTO validation spec, service spec (BR-01 price lock,
  Pricing-404, idempotent replay + cache-write), controller spec — all
  written and confirmed red before implementation. 14 new tests, 23/23
  total passing; `pnpm build`/`pnpm lint` clean, split across 6 logical
  commits per file/layer for easier review (see State above).
- **Deliberate scope boundary**: `IPricingPort` uses a fixed-price stub
  (`PricingStubAdapter`) rather than a real `RATECARD` lookup — that's
  task 5.4's job. The real adapter can be swapped in later without
  touching `OrderService`.
- **No new BR guard-failure test needed**: BR-01's "locked, no edits"
  clause is enforced by the absence of a `PATCH /orders/{id}` route
  (405 by design), not a runtime `422` guard — confirmed this isn't a
  coverage gap.
- **Known gap, unchanged**: `docs/lld/order-service.md`'s "abandoned
  prepaid payment" open item still has no assigned task.

### 2026-07-08 — Session tooling
- Added `/begin-task`, `/wrap-task`, `/recap` slash commands
  (`.claude/commands/`) to enforce the `CLAUDE.md` Workflow section
  (read→state scope→build→lint→test→commit) and the TDD rule in
  `docs/lld/00-conventions.md` without relying on remembering it each session.
  Added numbered sub-tasks (`5.1`, `5.2`, ...) to every phase in
  `docs/03-phases.md` so the commands address one concrete task instead of an
  entire multi-day phase.
- Added this file (`docs/PROGRESS.md`) as the session resume-point,
  complementing `TASKS.md`'s daily log.
- Added `docs/reference/` for raw/original design artifacts, kept separate
  from the synthesized docs in `docs/`.
- Documented the Ports & Adapters DI convention in `docs/lld/00-conventions.md`
  for Phase 5+ service implementation, plus a `.claude/skills/nest-service-module/`
  skill to scaffold new modules against it.
- Moved `init-db.sql`/`seed.sql`/`queries.sql` from repo root into `db/`;
  deleted `demo_queries.sql` (superseded draft of `queries.sql`, unused by any
  tooling). Updated every reference (docker-compose mount, verify-local.sh,
  generate_seed.py, consistency-auditor agent, ADR-003, seeding-analysis doc,
  `.idea` datasource mapping) and confirmed the stack still boots/seeds/queries
  clean from the new path.

### 2026-07-07 — Phase 4 complete
- All 8 apps + 3 libs scaffolded, schema-scoped TypeORM connections wired,
  `/health` endpoints added. See `TASKS.md` 2026-07-07 entry and
  `docs/reference/phase-4-implementation-checklist.md` for the full
  breakdown (6 sequential MRs/branches, TDD for `libs/crypto` and `libs/dtos`).
