# Progress Log

> Updated after every task/session. The **Resume point** is the first thing to
> read at the start of a session (`/recap` reads this automatically). Newest
> log entries on top. This is a session-handoff pointer, not a duplicate of
> `TASKS.md` (daily log) — `TASKS.md` wins for detailed history, this file
> wins for "what's next."

## Resume point

- **Current phase:** Phase 5 — Core Backend (6.0d), in progress. See
  `docs/03-phases.md`.
- **Next task:** `5.6` Status projection (read model, <300ms) +
  Transactional Outbox. Run `/begin-task 5.6` to start it.
- **Branch:** `feat/shipping-system` (tracks `github/feat/shipping-system`;
  see `CLAUDE.md` § Git Remotes for the dual-remote setup).
- **State:** Task `5.5` (Tracking Service: append-only event store +
  consumers) complete, committed as 4 logical commits (`270bd52` schema
  fix — `event_id` added to `TRACKING_EVENT` for consumer-side dedup —
  + ERD/seed regen, `dc8bd0e` `TrackingEvent` entity + repository/
  order-lookup ports, `211a72a` NATS consumer + `GET /tracking/:trackingId`
  wiring, `3eab552` backfilled 5.3/5.4 walkthrough docs). This is the
  **first real NATS consumer in the codebase** — built directly on the
  raw `nats` client, not `@nestjs/microservices` (no new dependency).
  Subscribes to the 8 parcel-lifecycle subjects that map onto
  `TRACKING_EVENT.event_type`; `trip.departed`/`trip.arrived` (no
  `parcel_id`) and `DELIVERY_FAILED` (no NATS contract yet) are
  deliberately not consumed. `GET /tracking/:trackingId` resolves parcel
  ids/states via a new read-only `'order'` connection into
  `shipping_order_db` (same pattern as 5.4's `network` connection) and
  returns the real Postgres timeline; `status` is `null` until 5.6 wires
  the Redis cache-write. 18 new tests (85 total); `pnpm build`/`pnpm
  lint`/`pnpm test` all green. **Live-verified**: real seeded order's
  timeline returned correctly, unknown order 404s, and a duplicate
  `event_id` published twice over NATS produced exactly one DB row
  (BR-03 dedup confirmed end-to-end, not just mocked). Task `5.4`
  (Pricing Service: rate-card matrix +
  Order-to-Pricing sync) complete, committed as 3 logical commits
  (`2a188a9` schema/ERD/seed regen, `27e0e41` `RateCard`/`Zone` entities +
  `network` connection, `cf874dc` `RateCardPricingAdapter` + wiring +
  `PricingStubAdapter` removal). BR-01's price lookup is now real:
  resolves `region_code → zone_id` via a read-only `Zone` mapping, queries
  the currently-effective `RATECARD` row, returns `null` (→ `404`) when
  either doesn't resolve. `RATECARD` gained an `sla_days` column (a real
  schema gap, fixed — see Log). Task `5.3` (Terminal exception states +
  RTS flags) complete, committed as one commit (`4d0a23f` + a post-review
  fix `4282fd1`), extending `ParcelStateMachine` with: Misrouted in/out
  (BR-02, transient state), `markLostSuspected` (passive SLA-timeout
  detection), `applyRts` (BR-04 direction flip), `markDamaged` (generic
  administrative action, no documented trigger exists for it in this
  scoped slice), and a `DELIVERY_FAILED` self-transition. Task `5.2`
  (Parcel State Machine + guard conditions) complete, committed as 2
  logical commits (`b37e8a2` shared `BusinessRuleException` in
  `libs/dtos`, `2ff2075` `ParcelStateMachine` + BR-02 guard). Task `5.1`
  (Order Service: entities, DTOs, order-creation logic) complete,
  committed as 6 logical commits (`b5a2abe` entities, `aff2516` DTO,
  `103f158` ports, `c6b78b7` adapters/repository, `95e2098` service,
  `f338233` controller/module wiring), preceded by `759cb4c` (ADR-006 for
  `ioredis`). `pnpm build`/`pnpm lint`/`pnpm test` all green (67 tests:
  the 9 from Phase 4 + 14 from 5.1 + 14 from 5.2 + 26 from 5.3 + 4 from
  5.4). **Post-task manual verification** (`1689a2b`, `e88fe50`): running
  `order` end-to-end against the live Postgres/Redis found 2 real bugs
  invisible to unit tests — entity table names didn't match the live
  schema's lowercase names, and `ValidationPipe` was never registered
  globally. Both fixed. Also, at user request (`f557713`): every code
  comment across `apps/`+`libs/` that referenced a `docs/*.md` path was
  rewritten to be self-contained — those paths don't exist on the GitLab
  code-only remote.
- **Notes:** Pricing is in-process inside `order` (own named TypeORM
  connection, not its own app — see `apps/order/src/app.module.ts` and
  `docs/lld/pricing-service.md`), now joined by a third, read-only
  `network` connection (Hub Service's `ZONE` table — Order/Pricing never
  writes there; Hub Service, task 6.2, remains its sole owner/writer).
  `ParcelStateMachine` is feature-complete for Order-owned FSM logic and
  is now actually wired to real scan events: Tracking's NATS consumer
  (task 5.5) appends `TRACKING_EVENT` rows, but nothing yet calls
  `ParcelStateMachine.transition()` off those rows to update
  `PARCEL.state` in Order — that projection/consumer wiring, plus the
  `orders.status.<order_id>` recompute trigger and Transactional Outbox,
  is task **5.6**. Courier Service's own side of BR-04 (counting 3 failed
  `DELIVERY_FAILED` attempts and publishing `parcel.rts`) is task **6.1**,
  not yet built — so `parcel.rts`/`parcel.delivered`/etc. currently have
  no real producer either; Tracking's consumer can only be exercised by
  hand-publishing test messages until Phase 6 lands. Known open items
  carried forward unchanged: `docs/lld/order-service.md`'s "abandoned
  prepaid payment" gap, `Damaged`'s complete lack of a documented trigger
  event, UC-15's passive lost-parcel SLA sweep job (unassigned to any
  task), and the HLD listing `trip.departed`/`trip.arrived` as Tracking
  inputs despite neither carrying a `parcel_id` (no task assigned).

## Log

### 2026-07-10 — Task 5.5: Tracking Service append-only event store + consumers
- **Schema fix** (confirmed with user, same class of gap as 5.4's
  `sla_days`): `TRACKING_EVENT` had no `event_id` column, so consumers had
  no way to satisfy `CLAUDE.md`'s "(2) consumers also de-dup on event_id"
  idempotency layer. Added `event_id UUID NOT NULL UNIQUE`, updated
  `docs/01-ERD.md`, regenerated `event_id` per scan event in
  `generate_seed.py`/`db/seed.sql` (`270bd52`).
- Added `TrackingEvent` entity + `ITrackingEventRepository`/
  `TrackingEventRepository`: append-only insert via
  `ON CONFLICT (event_id) DO NOTHING`, timeline query ordered
  oldest-first. Added a read-only cross-schema lookup into Order's
  `shipping_order_db` (minimal `ShipmentOrder`/`Parcel` entities, new
  named `'order'` connection — same pattern as 5.4's `network`
  connection) via `IOrderLookupPort`/`OrderLookupAdapter`, to resolve a
  `tracking_id` to its parcel ids/states (`dc8bd0e`).
- Added `TrackingEventConsumer` — the first real NATS consumer in the
  codebase, built directly on the raw `nats` client rather than adding
  `@nestjs/microservices` as a new dependency (confirmed with user).
  Subscribes to the 8 parcel-lifecycle subjects that map onto
  `TRACKING_EVENT.event_type`. Subject-to-event mapping is a pure,
  separately unit-tested function (`map-subject-to-tracking-event.ts`),
  kept apart from the NATS connection/subscription wiring itself (which,
  like other bootstrap code in this repo, isn't unit-tested — it was
  live-verified instead, see below). Added `TrackingService`/
  `TrackingController`: `GET /tracking/:trackingId`, 404 on unknown order
  id, `status: null` pending task 5.6's Redis cache-write (`211a72a`).
- TDD: 18 new tests, all written and confirmed red before implementation
  (repository dedup + timeline ordering, order-lookup adapter 404/happy
  path, 11 subject-mapping cases in the pure mapper — including
  unrecognized-subject and missing-`event_id`/`parcel_id` guards —
  service 404 + per-parcel grouping, thin controller delegation). 85/85
  total passing; `pnpm build`/`pnpm lint` clean.
- **Live-verified** (not just unit tests): reseeded `shipping_postgres`
  from scratch, ran `tracking` for real against the live NATS container.
  `GET /tracking/:id` against a real seeded order returned its actual
  6-event Postgres timeline (PICKUP → HUB_RECEIVE → DEPARTED_LINEHAUL →
  ARRIVED_AT_HUB → OUT_FOR_DELIVERY → DELIVERED); an unknown order id
  404s. Published a real `parcel.picked_up` message twice over NATS with
  the same `event_id` and confirmed exactly one `TRACKING_EVENT` row
  landed — BR-03's dedup guarantee holding end-to-end, not just against
  a mock.
- Backfilled `docs/reference/task-5.3-walkthrough.md` and
  `task-5.4-walkthrough.md`, which were never written when those tasks
  were completed on 2026-07-09, unlike 5.1/5.2 (`3eab552`).

### Decisions / open questions
- Confirmed with the user: `trip.departed`/`trip.arrived` are not
  consumed by this task's `TrackingEventConsumer` — neither carries a
  `parcel_id`, so there is no `TRACKING_EVENT` row they could produce.
  The HLD's subject-map table lists Tracking as a consumer of both
  anyway; that's flagged as a documentation/schema mismatch, not
  resolved here.
- Confirmed with the user: UC-15 (passive lost-parcel SLA sweep — a
  scheduled job/producer, not a consumer) stays out of scope for a task
  titled "event store + consumers." Still has no assigned task number.
- Confirmed with the user: `GET /tracking/:id`'s `status` field returns
  `null` for every order until task 5.6 wires the
  `SHIPMENT_ORDER.status` Redis cache-write — documented interim
  behavior, not a bug to fix now.
- `DELIVERY_FAILED`'s missing NATS contract (flagged during the Phase 6
  LLD review, 2026-07-08) remains unassigned — Courier Service (task 6.1)
  is still the one that would need to publish it.

### 2026-07-09 — Task 5.4: Pricing Service rate-card matrix + Order-to-Pricing sync
- **Schema fix** (confirmed with user before implementing): `docs/01-ERD.md`
  describes `PARCEL.sla_expected_delivery` as "computed from RATECARD
  lookup at order creation," but `RATECARD` had no column to compute it
  from — a genuine gap, not a deferred item. Added
  `sla_days INT NOT NULL CHECK (sla_days > 0)` to `db/init-db.sql`'s
  `shipping_pricing_db.RATECARD`, updated `docs/01-ERD.md`, and corrected
  a stale "mutate-in-place, one row per lane × type" description in
  `docs/lld/pricing-service.md` that predated the schema's actual
  `effective_from`/`effective_to` versioning columns.
- Updated `generate_seed.py` to generate `sla_days` per rate card
  (`parcel` 2–5 days, `pallet` 4–7 days) and derive each generated
  order's `expected_delivery_at` from its rate card's `sla_days` instead
  of an unrelated random 1–3 day value. Regenerated `db/seed.sql`
  (`2a188a9`).
- **Integration gap fix** (confirmed with user before implementing):
  `POST /orders`'s `sender`/`recipient` only carry `region_code`, but
  `RATECARD` (and Pricing's documented internal contract) key off
  `zone_id` — owned by Hub/Sortation Service (`shipping_network_db.ZONE`),
  not yet built (task 6.2). Added a read-only `Zone` entity mapped onto
  `ZONE`, via a new `network` TypeORM connection (`27e0e41`) — used only
  to resolve `region_code → zone_id`; `IPricingPort`'s signature and
  `CreateOrderDto`'s contract stayed unchanged, so nothing built in task
  5.1 needed touching.
- Added `RateCard` entity (`apps/order/src/entities/rate-card.entity.ts`)
  and `RateCardPricingAdapter implements IPricingPort`
  (`apps/order/src/adapters/rate-card-pricing.adapter.ts`): resolves
  both region codes to zone ids, queries the currently-effective
  `RATECARD` row (`effective_from <= now`, `effective_to` null or in the
  future) for `(origin_zone_id, dest_zone_id, parcel_type)`, returns
  `{ rateCardId, priceCents, slaExpectedDelivery }` or `null`. Wired into
  `order.module.ts` in place of task 5.1's `PricingStubAdapter`, which is
  now deleted (`cf874dc`).
- TDD: 4 new tests (happy path, unresolvable region_code, zones resolve
  but no matching rate card, query includes the effective-date
  condition), all written and confirmed red before implementation.
  67/67 total passing; `pnpm build`/`pnpm lint` clean.
- **Live-verified**, per the standing practice from tasks 5.1/5.2:
  reseeded `shipping_postgres` from scratch (`docker compose down -v &&
  up -d`, reseed), ran `order` for real, confirmed `POST /orders` with
  `REG-100`/`REG-101` returns the actual seeded price (`2809` cents) and
  a matching 2-day ETA — not the old stub's fixed `5000`/3-days.
  Unresolvable `region_code` correctly 404s; `GET /orders/:id/quote`
  confirmed on a second lane (pallet, `8204` cents/6-day ETA). Checked
  the DB rows directly, not just HTTP responses.

### Decisions / open questions
- Confirmed with the user: `sla_days` added to `RATECARD` — a real
  schema gap (the ERD's own description implied the field should exist),
  not a deferred/open item.
- Confirmed with the user: the `region_code → zone_id` resolution gap is
  solved via a read-only cross-schema connection (`network`) rather than
  changing `IPricingPort`'s signature or `POST /orders`'s API contract.
  This is a one-way read dependency from Order/Pricing onto Hub-owned
  data — acceptable since it's read-only and Hub Service hasn't been
  built yet to own the lookup itself; worth revisiting once task 6.2
  exists, in case Hub Service should own resolving this instead.

### 2026-07-09 — Task 5.3: Terminal exception states + RTS flags
- Extended `ParcelStateMachine` (`apps/order/src/domain/parcel-state-machine.ts`),
  built in task 5.2, with the transitions that task deliberately left out:
  - **Misrouted** (BR-02, second half): `MISROUTED` event blocks the
    forward flow from `InTransit`/`InHub`, parking the parcel in
    `Misrouted`. It's transient — `HUB_RECEIVE`/`ARRIVED_AT_HUB` (the
    same events used by the normal forward flow) resume it back into
    `InHub` once Hub/Sortation applies a corrective re-route.
  - **`markLostSuspected`**: a dedicated method rather than a
    `TrackingEventType` table entry, since this is triggered by
    Tracking's internal passive SLA-timeout sweep, not a real scan
    event. Valid from any actively-moving state (`InTransit`, `InHub`,
    `OutForDelivery`, `Misrouted`); rejects `Created` (never dispatched)
    and the terminal states.
  - **`applyRts`** (BR-04): flips `direction = Reverse_RTS` and resets
    `state = InTransit`, valid only from `OutForDelivery`. This is a
    defensive re-assertion, not BR-04's actual enforcement point —
    Courier Service (task 6.1, not yet built) is the one that counts 3
    consecutive `DELIVERY_FAILED` events and decides to call this.
  - **`markDamaged`**: generic administrative transition, allowed from
    any non-terminal state. No `TrackingEventType`/BR backs it — see
    Decision below.
  - `Delivered`/`Lost`/`Damaged` remain true terminal states throughout
    — no outgoing transition is ever defined for them, so any further
    event correctly throws.
- TDD: 25 new tests (Misrouted in/out, `markLostSuspected` happy +
  reject, `applyRts` happy + reject, `markDamaged` happy + reject,
  terminal-state rejection of `transition()`), all written and
  confirmed red before implementation. 62/62 total passing; `pnpm
  build`/`pnpm lint` clean. One commit (`4d0a23f`) — small enough not to
  need splitting the way task 5.1 was.
- **Reviewed and fixed, at user request**: every code comment across
  `apps/`+`libs/` that referenced a `docs/*.md` path (13 files total,
  including 9 pre-existing Phase-4 files not touched this session) —
  rewrote each to be self-contained, since those paths don't exist on
  the GitLab `supporter-review` remote (`f557713`).
- Added a verified "How to run/test" section to the root `README.md`
  (previously doc-index only) with the actual `docker compose`/`pnpm`/
  `curl` commands re-run to confirm they work, and fixed a stale
  `ADR-001 through ADR-004` reference to `ADR-006` (`0a01e52`).
- **Post-wrap code review fix**: `DELIVERY_FAILED` (a valid
  `TRACKING_EVENT.event_type`) had no `TRANSITIONS` table entry, so
  `transition()` threw on it even though a failed delivery attempt
  doesn't change `PARCEL.state` (it stays `OutForDelivery` until the
  3rd failure triggers `applyRts`, BR-04). Left unfixed, a future
  event-replay/projection consumer (task 5.6) would have had to filter
  `DELIVERY_FAILED` out before folding over a parcel's events. Added a
  self-transition (`OutForDelivery` + `DELIVERY_FAILED` →
  `OutForDelivery`); 1 new test, 63/63 total passing (`4282fd1`). Also
  verified `ParcelState.OUT_FOR_DELIVERY`'s `'OutForDelivery'` string
  matches `db/init-db.sql`'s `CHECK` constraint exactly.

### Decisions / open questions
- Confirmed with the user: `Damaged` has zero documented trigger in this
  scoped slice — no BR describes it, no `DAMAGED` value exists in
  `TRACKING_EVENT.event_type`'s `CHECK` constraint, and it's not in the
  "Deferred" list either. Implemented as a generic, always-available
  administrative transition rather than inventing a business rule to
  back it. Flagged as an open gap, not assigned to any task.
- Confirmed with the user: code comments must never cite `docs/*.md` (or
  `TASKS.md`/`IMPLEMENTATION_CHECKLIST.md`) file paths — the GitLab
  `supporter-review` remote strips `docs/`/`.claude/`/`.gemini/` before
  every push, so such references become dangling for reviewers there.
  BR-XX/UC-XX/ADR IDs are fine to keep (portable identifiers, not file
  paths) — saved as a standing rule for future sessions.

### 2026-07-09 — Post-task manual verification (tasks 5.1/5.2)
- At user request, manually "tested around" after 5.1/5.2 were marked
  done rather than trusting `pnpm test` alone: brought up
  `docker compose` (Postgres/Redis already running), started the `order`
  app for real (`PII_ENCRYPTION_KEY=... npx nest start order`), and hit
  `POST /orders`/`GET /orders/:id/quote` with `curl`.
- Found and fixed 2 real bugs, both invisible to the existing unit tests:
  - `1689a2b` — `Customer`/`ShipmentOrder`/`Parcel` entities declared
    `@Entity({ name: 'CUSTOMER' })` etc. (quoted uppercase), but
    `db/init-db.sql` declares table names unquoted, so Postgres folds
    them to lowercase (confirmed via `\dt`: `customer`, `shipment_order`,
    `parcel`). Every real query failed with `relation "CUSTOMER" does
    not exist` (`42P01`). `order.service.spec.ts` mocks
    `IOrderRepository`, so it never touched the real DB and never caught
    this.
  - `e88fe50` — `apps/order/src/main.ts` never called
    `app.useGlobalPipes(new ValidationPipe(...))`. `CreateOrderDto`'s
    `class-validator` decorators were correct but never actually ran on
    a real request; an invalid `POST /orders` body reached
    `OrderService` and crashed with `500` (calling `encrypt(undefined)`)
    instead of the documented `400`. `create-order.dto.spec.ts` calls
    `class-validator`'s `validate()` directly, bypassing the NestJS
    request pipeline entirely, so it never caught this either.
- Corrected a false claim in `docs/reference/task-5.1-walkthrough.md`
  that said `ValidationPipe` was "already configured project-wide" — it
  wasn't, until this fix.
- Added verified "Cách tự chạy test / thử nghiệm" (how to test around)
  sections — with the actual commands run above, not hypothetical ones —
  to both `task-5.1-walkthrough.md` (full `curl` walkthrough against a
  running app) and `task-5.2-walkthrough.md` (unit tests +
  `ts-node -r tsconfig-paths/register` one-liner, since that task has no
  REST endpoint yet).
- **Takeaway, worth repeating for future tasks**: a fully-mocked unit
  test suite can be green while the real DB/HTTP pipeline is broken.
  Any task that adds a real DB schema mapping or a validated REST
  endpoint should get at least one live smoke test before being
  considered done, not just `pnpm test`.

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
