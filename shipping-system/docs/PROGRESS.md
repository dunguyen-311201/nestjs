# Progress Log

> Updated after every task/session. The **Resume point** is the first thing to
> read at the start of a session (`/recap` reads this automatically). Newest
> log entries on top. This is a session-handoff pointer, not a duplicate of
> `TASKS.md` (daily log) — `TASKS.md` wins for detailed history, this file
> wins for "what's next."

## Resume point

- **Current phase:** Phase 7 — Integration & E2E (1.0d) **complete**
  (`7.1`-`7.3`, all tasks done). Next: Phase 8 — Testing, Demo & Docs
  (1.0d). See `docs/03-phases.md`.
- **Next task:** `8.1` Unit tests for rule guards & state-machine
  transitions. Run `/begin-task 8.1` to start it.
- **Task `7.3` (Automate 1 happy-path integration test) complete**: the
  pre-staged `apps/api-gateway/src/happy-path.integration.spec.ts` had a
  missing `uuid` dependency (swapped to `crypto.randomUUID()`, confirmed
  with user) and asserted an unreachable final state (`Delivered`) — task
  7.2 had already found this unreachable. **Confirmed with user first:
  fixed the underlying gap rather than adjusting the test's
  expectations.** `parcel.loaded_for_linehaul`/`parcel.out_for_delivery`
  had consumers but zero publishers anywhere: Line-haul's `/depart` now
  publishes the former (added `LINEHAULTRIP.parcel_ids`, real schema gap,
  same class as `status`); Dispatcher's `/legs/{id}/assign` now publishes
  the latter (Dispatcher gained a full Outbox, sharing the physical
  `shipping_network_db.outbox` table with Hub/Line-haul, same precedent
  as 6.4 — the 6.5 "no persistence" decision still stands for the
  assignment itself, only event publication was added). Fixed two stale
  contract docblocks misattributing the publisher (neither was ever
  implemented anywhere). Also fixed two real bugs in the pre-staged
  test's own script: wrong step order (leg-assign was called before
  Line-haul even ran, and the destination hub receive was missing
  entirely) and a race condition (leg-assign and deliver are both
  synchronous HTTP but trigger two independently-polled async outbox
  events with no ordering guarantee — added a poll-and-wait). 288/288
  unit tests passing (+9 new); `pnpm build`/`pnpm lint` clean.
  **Live-verified for real, three consecutive runs**: rebuilt the
  affected Docker images, ran `RUN_INTEGRATION_TEST=true` against the
  live stack — genuinely reaches `PARCEL.state = Delivered` with the
  full timeline. `docs/07-e2e-walkthrough.md`'s "Known gap" section
  updated with a note that it's now fixed (original write-up preserved
  for historical accuracy). **Phase 7 (Integration & E2E) complete.**
- **Task `7.2` (Document the full end-to-end workflow walkthrough)
  complete**: new `docs/07-e2e-walkthrough.md`, linked from `CLAUDE.md`.
  Runs the complete current vertical slice through the API Gateway
  against the dockerized stack (both from task 7.1); every command's
  output is real, captured while actually running it, not hypothetical.
  **Real gap found while writing it, not fixed (out of scope for a docs
  task)**: `PARCEL.state` can never reach `Delivered` through the full
  multi-hub flow — `parcel.loaded_for_linehaul` and
  `parcel.out_for_delivery` have consumers in Order/Tracking but zero
  publishers anywhere in Hub/Line-haul/Dispatcher/Courier (confirmed via
  grep, re-verified independently). Line-haul's `/depart` has no
  per-parcel effect (no parcel-to-trip association exists in this
  schema); Hub's destination-scan publishes `ARRIVED_AT_HUB` directly,
  skipping the `DEPARTED_LINEHAUL` step Order's FSM requires first, so
  it's silently dropped — same for `DELIVERED` from Courier's
  `/deliver`. Tracking's append-only timeline, Courier's
  `PROOF_OF_DELIVERY` write, and Notification's email all still fire
  correctly regardless, since none of them depend on `PARCEL.state`.
  Flagged for a follow-up task (likely touching Hub's transit-scan event
  choice or Line-haul's `/depart`), not silently patched mid-walkthrough.
  Also fixed `CLAUDE.md`'s Docs list's same stale "BR-01–BR-10" →
  "BR-01–BR-09" already-approved correction from task 6.6. No code
  changes; `pnpm build`/`pnpm lint`/`pnpm test` unchanged from 7.1's
  last clean run (279/279).
- **Task `7.1` (Wire the full vertical slice in local docker-compose)
  complete**: switched `nest-cli.json` to the Webpack builder for all 8
  apps (confirmed with user first — plain `tsc` produced an inconsistent
  output shape once an app imports `libs/*`; webpack gives a uniform
  `dist/apps/<app>/main.js`, needed for a predictable Docker `CMD`; no
  new dependency, local `nest start`/`start:dev` unaffected). Added a
  root multi-stage `Dockerfile` (parameterized by build ARG `APP_NAME`,
  non-root `USER node`) and wired all 8 apps into `docker-compose.yml`
  alongside the existing infra (task 4.2), with `*_SERVICE_URL`/
  `POSTGRES_HOST`/`REDIS_HOST`/`NATS_URL` overridden to Docker-network
  service hostnames. **Live-verified end-to-end**: `docker compose
  build && up -d` — all 11 containers healthy, all 7 HTTP apps'
  `/health` returned `200` through their container ports, the gateway's
  proxy reached real downstream services through Docker hostnames (not
  `localhost`), and a host-published NATS event was correctly consumed
  by the containerized `notification` service. Named volumes/seed data
  confirmed to survive a `docker compose down` (no `-v`). `pnpm build`/
  `pnpm lint`/`pnpm test` all green (279/279). Left untouched (task
  7.3's scope): a pre-staged, `RUN_INTEGRATION_TEST`-gated
  `happy-path.integration.spec.ts` in `apps/api-gateway`.
- **Task `6.6` (Notification: stateless email dispatcher) complete**: new
  app logic in `apps/notification` — pure NATS consumer (`@EventPattern`
  on all 5 lifecycle events: `order.created`, `payment.succeeded`,
  `parcel.delivered`, `parcel.rts`, `parcel.lost_suspected`), no HTTP
  surface, no DB, no idempotency store (LLD accepts a duplicate email as
  cheaper than deduplicating). On send failure: log and swallow, never
  rethrow — the NATS ack still happens normally, matching BR-09's
  "never blocks the triggering transaction." **Two things fixed, both
  confirmed with user first**: (1) `docs/lld/notification-service.md`
  cited stale "BR-10" in 3 places — the authoritative catalogue's BR-09
  *is* Notifications; fixed all 3 to BR-09; (2) no event carries an email
  address and none exists anywhere in the project (`CUSTOMER`, seed
  script, docs) — rather than inventing a new PII field with no
  consumer, built `IEmailProvider` + `LoggingEmailAdapter`, a stub that
  logs using only the `order_id`/`parcel_id` already on each event, no DB
  read at all. 279/279 tests passing; `pnpm build`/`pnpm lint`/`pnpm
  test` all green. **Live-verified end-to-end**: booted as a real
  `NestMicroservice` (no HTTP port), published a real `order.created` and
  `parcel.rts` message against the dockerized NATS via a throwaway
  script, confirmed both were consumed and logged with correct
  subject/body text.
- **Task `6.5` (Dispatcher: driver/truck-to-trip + courier-to-leg
  assignment) complete**: new app logic in `apps/dispatcher` —
  `POST /trips/{id}/assign` (UC-09, in-schema write to Line-haul's
  `LINEHAULTRIP`, ADR-003) and `POST /legs/{id}/assign` (UC-10,
  validation-only, no persistence — confirmed with user, no `LEG`
  table/`PARCEL.courier_id` exists anywhere in the ERD and Courier's
  task-6.1 pickup/deliver already takes `courier_id` directly).
  **Two real gaps fixed, both confirmed with user first**: (1) `COURIER`
  had no `status` column — UC-10's `422` guard had nothing to check,
  added `status` (`Active`\|`Inactive`\|`Verified`) same as 6.4's
  `LINEHAULTRIP.status` fix; (2) API Gateway's `/trips` prefix was
  already claimed by Line-haul (6.4) but Dispatcher needed
  `/trips/{id}/assign` too — added a regex-pattern route checked before
  the generic prefix so both coexist. `DRIVER.name_enc` encryption gap
  (deferred since 6.3) stays open — neither 6.4 nor 6.5 actually creates
  `DRIVER` rows, only `generate_seed.py` writes `name_enc`, so it's still
  unowned by any live code path. 268/268 tests passing;
  `pnpm build`/`pnpm lint`/`pnpm test` all green. **Live-verified
  end-to-end**: real `psql`-confirmed `LINEHAULTRIP` write on assign,
  404/409/422 guards, idempotency replay, and gateway routing correctly
  disambiguating `/trips/{id}/assign` (→ Dispatcher) from
  `/trips/{id}/depart` (→ Line-haul).
- **Task `6.4` (Line-haul: trip creation, depart/arrive hooks) complete**:
  new app `apps/linehaul`. **Real gap fixed, confirmed with user first**:
  `LINEHAULTRIP` had no lifecycle column — added `status`
  (`Created`\|`Departed`\|`Arrived`) so the LLD's `/depart`/`/arrive` 409
  guard has something to check. **Skipped "deconsolidation"** (phase-doc
  task title lists it, `CLAUDE.md`'s SCOPE cuts it — treated as stale).
  Built with a Transactional Outbox from day 1; **shares
  `shipping_network_db` with Hub Service (task 6.2) by the original
  architecture** — Line-haul's `Outbox` entity maps onto the same
  physical table Hub already migrated, each app runs its own poller
  against it (harmless, absorbed by existing two-layer idempotency).
  247/247 total passing; `pnpm build`/`pnpm lint`/`pnpm test` all green.
  **Live-verified end-to-end**: a real trip's full lifecycle
  (`Created → Departed → Arrived`) wrote both `OUTBOX` rows into the
  shared table, both polled to `PUBLISHED`; all 409/404/400 guards and
  idempotency replay confirmed via real HTTP + `psql`.
- **Task `6.3` (PII field-level encryption) — confirmed already satisfied,
  no code changes**: `libs/crypto` (Phase 4) + `CUSTOMER`'s full
  encryption (task 5.1) already meet this task's requirement for every
  PII field in a currently-built service. Two known gaps intentionally
  left open: `decrypt()` is never called anywhere (no recipient/admin
  view exists — same pre-existing auth/RBAC gap noted in `docs/lld/
  order-service.md`), and `shipping_network_db.DRIVER.name_enc` is not
  actually encrypted (`generate_seed.py` writes plaintext) — deferred to
  whichever of tasks 6.4/6.5 builds `DRIVER` first, since no service
  reads/writes it yet.
- **Branch:** `feat/shipping-system` (tracks `github/feat/shipping-system`;
  see `CLAUDE.md` § Git Remotes for the dual-remote setup).
- **State:** Task `6.2` (Hub/Sortation: `HUB_RECEIVE`, parcel inbound/
  outbound scan at hub, UC-07/UC-12, BR-02/BR-06/BR-08) complete. New app
  `apps/hub` — `HubService.receive`, built with a Transactional Outbox
  from day 1 (confirmed with user, avoiding a repeat of Courier's
  synchronous-then-retrofit path from task 6.1). **Real gap found and
  fixed, confirmed with user first**: `PARCEL.route_id` was never
  populated at real order creation (only seed data had it) — this
  task's own misroute-detection logic depended on it, so `apps/order`'s
  `RateCardPricingAdapter`/`OrderService`/`OrderRepository` were
  extended to resolve and persist it via a new read-only `Route` entity.
  **Cross-schema write resolved via the established read-only
  convention**: Hub computes the corrective route but never writes
  `PARCEL` directly — it republishes the new `route_id` on a corrective
  `parcel.hub_received` event, and `apps/order`'s `ParcelEventConsumer`
  (extended this task, new `IOrderRepository.updateParcelWeightAndRoute`)
  applies it alongside `actual_weight_grams` (BR-06). 219/219 total
  passing; `pnpm build`/`pnpm lint`/`pnpm test` all green.
  **Live-verified end-to-end**: a real order's `PARCEL.route_id` resolved
  to a real `ROUTE` row for the first time; a real origin-hub scan wrote
  a real `OUTBOX` row that polled to `PUBLISHED` and landed as both a
  `PARCEL.actual_weight_grams` update and a `TRACKING_EVENT` row; a real
  misrouted scan produced both `OUTBOX` rows atomically, updated
  `PARCEL.route_id` to the real corrective route, and appended
  `MISROUTED` + corrective `HUB_RECEIVE` `TRACKING_EVENT` rows. `docs/
  lld/hub-service.md` bumped to v1.2; `docs/02-HLD.md`'s Accepted MVP
  risk note removed entirely (no service has this gap anymore).
- **State:** Task `6.1` (Courier Service: pickup/delivery legs + scan
  events, UC-05/UC-06/UC-13, BR-04/BR-08) complete. New app
  `apps/courier` — `CourierService.pickup`/`deliver`, Ports & Adapters
  (`IOrderLookupPort`, `ICourierRepository`, `IEventPublisher`,
  `IIdempotencyStore`), Idempotency-Key on both endpoints. **Real schema
  gap fixed, confirmed with user first**: `DELIVERY_ATTEMPT` gained a
  `direction` column (`Forward`|`Reverse_RTS`) and its `UNIQUE` constraint
  became `(parcel_id, direction, attempt_number)` — BR-04's "counter
  resets to zero for the reverse leg" would otherwise collide with the
  forward leg's own rows 1-3 under the old `UNIQUE(parcel_id,
  attempt_number)`. **Closed a gap flagged since task 5.5**: added
  `parcel.delivery_failed` to `libs/contracts`
  (`ParcelDeliveryFailedEventV1`) — no NATS contract existed for it
  before. **Extended scope, confirmed with user**: wired
  `apps/tracking`'s consumer to the new subject too, so a real
  `DELIVERY_FAILED` `TRACKING_EVENT` row gets appended — this is the
  first time that event type has ever been written in this codebase.
  20 new Courier tests + 1 new Tracking test, 183/183 total passing;
  `pnpm build`/`pnpm lint`/`pnpm test` all green. **Real bug caught only
  by live verification**: `DELIVERY_ATTEMPT.created_at` was missing
  `DEFAULT NOW()` (every other table's `created_at` has it) — TypeORM's
  `.insert()` relies on the DB default for `@CreateDateColumn`, so the
  very first real failed-delivery call hit a `NOT NULL` violation
  invisible to mocked tests. Fixed in `db/init-db.sql`. **Live-verified
  end-to-end**: real `pickup`/`deliver` calls against the dockerized
  stack — BR-08 422 on an unconfirmed order, a full 3-strike RTS sequence
  with real `DELIVERY_ATTEMPT` rows and a `parcel.rts` publish on the
  3rd, `422 BR-04` on a 4th attempt, the reverse leg's attempt counter
  independently restarting at 1 (confirmed via `psql`, no `UNIQUE`
  collision with the forward leg), and — running `courier` + `tracking`
  together — a real `parcel.delivery_failed` publish landing as an actual
  `TRACKING_EVENT` row.
- **Same-day follow-up: Courier gained a Transactional Outbox.** A
  supporter reviewer's question about retry/publish-failure/dedup
  surfaced a real gap in the original "no outbox" design: a publish
  failure permanently lost the event, and an `Idempotency-Key` retry
  after such a failure could re-run the DB write (`PROOF_OF_DELIVERY` has
  no uniqueness constraint, so a retry could silently duplicate it).
  Redis-as-outbox was considered and rejected (not atomic with the
  Postgres transaction; `CLAUDE.md` restricts Redis to read-cache-only).
  Added `shipping_courier_db.OUTBOX` (same shape as Order Service's,
  task 5.6) + `OutboxPollerService`; `CourierRepository` now writes each
  business row and its `OUTBOX` row atomically, `CourierService` no
  longer calls `IEventPublisher` directly. **API response shape changed,
  confirmed with user first**: `pickup`/`deliver` no longer return
  `event`/`event_id`/`published_at` (implied a synchronous publish that
  no longer happens) — now `{ status: "recorded", ... }`.
  `docs/lld/courier-service.md` bumped to v1.4; `docs/02-HLD.md`'s
  Accepted MVP risk note narrowed to Hub/Sortation only. 189/189 total
  passing; `pnpm build`/`pnpm lint` clean. **Live-verified end-to-end**:
  a real `pickup` wrote a `PENDING` `OUTBOX` row the poller flipped to
  `PUBLISHED` within ~500ms and Tracking appended from; a fresh 3-strike
  RTS sequence produced 4 real `OUTBOX` rows (3 `parcel.delivery_failed`
  + 1 `parcel.rts`), all polled and landing as real `TRACKING_EVENT`
  rows; the 4th attempt still correctly `422 BR-04`'d.
- **Ad-hoc fix since 5.8, not a numbered task**: closed a real
  customer-dedup gap found while prepping a supporter demo — every
  `POST /orders` silently created brand-new `CUSTOMER` rows for sender/
  recipient, even for a repeat phone number. Added `CUSTOMER.phone_hash`
  (deterministic HMAC-SHA256 via `libs/crypto`'s new `hashForLookup()`,
  since `phone_enc`'s random-IV encryption can't do equality lookups) and
  `OrderRepository.findOrCreateCustomer` reuses the match instead of
  inserting a duplicate. 162/162 tests, `pnpm build`/`pnpm lint` clean,
  live-verified (2 real orders from the same phone share one real
  `CUSTOMER.id`). Also documented (not implemented) a related gap found
  during the same investigation: recipients have no way to discover their
  own `tracking_id` today (only the sender gets it back), and there's no
  auth/RBAC anywhere in this codebase despite it being listed as an NFR —
  confirmed with the user this needs its own architecture decision, out
  of scope to bolt on ad hoc. See `docs/lld/order-service.md`/
  `tracking-service.md` § Known Open Items.
- **State:** Task `5.8` (Payment: Stripe Checkout session + webhook
  handler + `PAYMENT_TRANSACTION` log + prepaid dispatch guard, BR-08)
  complete, committed as 5 logical commits (`509bea8` `stripe` dependency,
  `745b538` `Payment`/`PaymentTransaction` entities + closes the
  order-creation gap where `payment_type` was accepted since task 5.1 but
  never written to a `PAYMENT` row, `f238fbe` `IPaymentRepository`/
  `PaymentRepository` webhook-idempotent confirmation, `9314a88`
  `IPaymentGateway`/`StripePaymentGateway`, `676437a`
  `POST /orders/{id}/checkout` + `POST /payments/webhook`). `stripe`
  added as a new dependency (confirmed with user). BR-08 fully
  tested both happy-path and `422` guard failure; `payment.succeeded` is
  published directly with no outbox, per `docs/02-HLD.md`'s pre-existing
  documented accepted-risk decision (not a new tradeoff this task
  introduced). 156/156 tests passing; `pnpm build`/`pnpm lint`/`pnpm test`
  all green. **Two real bugs caught only by live verification, invisible
  to mocked unit tests**: (1) `PaymentService`'s first constructor param
  was typed `Pick<IOrderRepository, 'findById'>` — a TS utility type, not
  the actual injectable class — which erases Nest's DI metadata at
  runtime (`UnknownDependenciesException` on boot); fixed by typing it as
  the real `IOrderRepository`. (2) `Payment`/`PaymentTransaction` were
  registered via `TypeOrmModule.forFeature()` in `OrderModule` but never
  added to the connection's own `entities: [...]` array in `AppModule` —
  TypeORM has no metadata for an entity outside that array
  (`EntityMetadataNotFoundError`), even though `forFeature()` alone builds
  a repository DI token that type-checks fine. Both fixed. **Live-verified
  end-to-end**: ran `order` for real against the dockerized Postgres/NATS
  with a fake Stripe key — `404`/`422 BR-08` guards confirmed on real
  seeded orders, the unpaid-order checkout path reached the real Stripe
  API (failed only on the fake key, `401`), and a validly Stripe-test-
  signed `checkout.session.completed` webhook payload
  (`Stripe.webhooks.generateTestHeaderString`) flipped a real order's
  `PAYMENT.status` to `Paid` and `SHIPMENT_ORDER.status` to `Confirmed`
  in Postgres, with a `PAYMENT_TRANSACTION` row written; replaying the
  same event was a no-op (no duplicate row); a bad signature 400s. Task
  `5.7` (Per-aggregate serialization: NATS JetStream
  per-order subject + event-batching) complete, committed as 2 logical
  commits (`cdc1b0d` Tracking's publish side onto real JetStream,
  `9c0cdca` Order's consume side onto a real JetStream ordered consumer).
  Closes a gap flagged since 5.6: `shipment_orders.status.<id>` (ADR-001's
  per-order recompute trigger) had been running over plain
  `@nestjs/microservices` NATS-core pub/sub, not JetStream — ADR-005
  explicitly notes the built-in transporter can't speak JetStream, so this
  was always deferred to this task, not a new feature. BR-07's
  event-batching (debounce) half, done in 5.6, is untouched.
  `IStatusTriggerPublisher`/`JetStreamStatusTriggerPublisher` (Tracking)
  publish over a dedicated raw-`nats`-package JetStream client (no new
  dependency — `nats` was already direct). `StatusProjectionConsumer`
  (Order) is no longer an `@nestjs/microservices` `@EventPattern`
  controller; it now opens its own JetStream connection on
  `OnModuleInit`, idempotently ensures the `SHIPMENT_ORDER_STATUS` stream
  (subjects `shipment_orders.status.>`) and a durable ordered consumer
  (`order-status-projection`, explicit-ack), and feeds messages into the
  same debounce/recompute logic built in 5.6 (unchanged). 137/137 tests
  passing; `pnpm build`/`pnpm lint`/`pnpm test` all green. **Live-verified
  end-to-end**: confirmed via the NATS monitoring API (`/jsz`) that the
  stream and durable consumer are real JetStream objects; published a
  real `parcel.picked_up` message for a real seeded parcel and confirmed
  the stream received/acked it (`ack_floor` caught up to `stream_seq: 1`)
  and the same Diagram 8 side effects as 5.6 (Postgres `PARCEL.state` +
  `SHIPMENT_ORDER.status`, Redis cache) landed correctly — now over real
  JetStream instead of NATS core. Both apps shut down cleanly (graceful
  JetStream connection close via `onModuleDestroy`). Task `5.6` (Status
  projection (read model, <300ms) + Transactional Outbox) complete,
  committed as 6 logical commits
  (`265ec0a` `OUTBOX` schema + BR-05 mapping doc + Redis key doc +
  `orderStatusSubject()` fix, `fc29f4f` `pnpm build` quality-gate fix +
  `@nestjs/microservices` dependency, `c24f040` Transactional Outbox for
  `order.created`, `03c8d07` `ParcelEventConsumer` +
  `StatusProjectionConsumer`, `9101890` Tracking's consumer refactored
  onto `@nestjs/microservices` + recompute-trigger publish, `0f238b7`
  `GET /tracking/:id` reads the real Redis status cache). **Two real
  bugs caught only by live verification, invisible to mocked unit
  tests**: (1) `pnpm build` (`nest build`, no args) silently only
  type-checked the default `api-gateway` project in this monorepo —
  every other app had never actually been type-checked by the quality
  gate; building each app individually surfaced 2 real type errors, now
  fixed, and the script is now `nest build --all`; (2)
  `NatsRecordBuilder.setHeaders()` needs a real `nats`-package `MsgHdrs`
  (via `headers()`), not a plain object — a plain object type-checks and
  passes mocked tests fine but fails at actual publish with `hdrs.encode
  is not a function`. Both fixed. **Live-verified end-to-end**: a real
  `POST /orders` → outbox row → poller published it for real; a real
  `parcel.picked_up` NATS message flipped `PARCEL.state` to `InTransit`
  (Order's own new consumer) and appended a `TRACKING_EVENT` row
  (Tracking's consumer) and recomputed `SHIPMENT_ORDER.status` to
  `Active` in Postgres and Redis and `GET /tracking/:id` returned that
  real non-null status alongside the timeline — the full Diagram 8 loop
  confirmed working, not just individually mocked pieces. 132/132 tests
  passing; `pnpm build`/`pnpm lint`/`pnpm test` all green across every
  app and lib. Task `5.5` (Tracking Service: append-only event store +
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
  `ParcelStateMachine` is now fully wired end to end: Tracking's consumer
  appends `TRACKING_EVENT` rows and publishes a recompute trigger; Order
  independently consumes the same events to update `PARCEL.state`; Order's
  `StatusProjectionConsumer` debounces the trigger and recomputes
  `SHIPMENT_ORDER.status` + Redis. Both Order and Tracking run as hybrid
  HTTP+NATS apps; parcel-lifecycle events (`parcel.*`) and the outbox's
  `order.created` still go over `@nestjs/microservices`' NATS-core
  transport, but the `shipment_orders.status.<id>` per-order trigger now
  runs over real JetStream (task **5.7**, done) per ADR-001 — a durable
  stream + explicit-ack ordered consumer, not just debounce-only ordering.
  Courier Service (task **6.1**, done) owns BR-04's own side (counting
  3 failed `DELIVERY_FAILED` attempts and publishing `parcel.rts`) and
  Hub Service (task **6.2**, done) owns `parcel.hub_received`/
  `parcel.arrived_at_hub`/`parcel.misrouted` — real producers now exist
  for every `parcel.*` event except `parcel.loaded_for_linehaul`/
  `trip.departed`/`trip.arrived`, still owned by the unbuilt Line-haul/
  Dispatcher (tasks 6.4/6.5), exercised only by hand-publishing test
  messages (see `scripts/publish-event.js`) until they land. `pnpm build` now
  actually validates every app/lib in the monorepo (`nest build --all`),
  not just `api-gateway` — worth double-checking this stays true if
  `nest-cli.json`'s project list ever changes. Known open items carried
  forward unchanged: `docs/lld/order-service.md`'s "abandoned prepaid
  payment" gap, `Damaged`'s complete lack of a documented trigger event,
  UC-15's passive lost-parcel SLA sweep job (unassigned to any task), the
  HLD listing `trip.departed`/`trip.arrived` as Tracking inputs despite
  neither carrying a `parcel_id` (no task assigned). `DELIVERY_FAILED`'s
  NATS contract (previously blocked on task 6.1) now exists and is
  consumed by Tracking.

## Log

### 2026-07-13 — Task 5.8: Payment (Stripe Checkout + webhook, BR-08) — Phase 5 complete
- **Real gap closed**: `CreateOrderDto.payment_type` (task 5.1) had been
  validated and accepted but never actually used — no `PAYMENT` row was
  written at order creation. `OrderRepository.createOrder` now writes an
  `Unpaid` `PAYMENT` row in the same transaction as `SHIPMENT_ORDER`/
  `PARCEL`. Added `Payment`/`PaymentTransaction` TypeORM entities — the DB
  schema already existed (`db/init-db.sql`/`docs/01-ERD.md`), no migration
  needed, just the missing entity mapping (`745b538`).
- **New dependency, confirmed with user**: `stripe` — Checkout Session
  creation and `Stripe-Signature` webhook verification have no path
  without the official SDK (`509bea8`).
- `IPaymentRepository`/`PaymentRepository` (`f238fbe`): `confirmPayment()`
  inserts `PAYMENT_TRANSACTION` via `.orIgnore()` on
  `external_transaction_id`'s UNIQUE constraint — a redelivered webhook
  event is a no-op (`'duplicate'`), never a second write; on a new event,
  updates `PAYMENT.status = Paid` and `SHIPMENT_ORDER.status = Confirmed`
  (BR-08) in one transaction.
- `IPaymentGateway`/`StripePaymentGateway` (`9314a88`): wraps the Stripe
  SDK directly (Ports & Adapters, per `docs/lld/00-conventions.md`).
  Checkout Sessions carry `client_reference_id = shipment_order_id` — a
  deliberate choice not to add a `stripe_session_id` column to `PAYMENT`,
  since the webhook can resolve the order from this field alone.
  `constructWebhookEvent` maps only `checkout.session.completed` to the
  service's narrow `WebhookEvent` shape; any other event type maps to a
  null `shipmentOrderId` so the caller acks it without acting (Stripe
  requires a 200 for event types an endpoint doesn't handle, or it
  retries assuming the endpoint is broken).
- `PaymentService`/`PaymentController`/`OrderController` (`676437a`):
  `checkout(shipmentOrderId)` — `404` unknown order, `409` already
  `Confirmed`, `BusinessRuleException('BR-08', ...)` (`422`) when a
  `PAYMENT` row already exists in a non-`Unpaid` state (a checkout retry
  on an in-progress/completed payment), else a real Checkout Session.
  `handleWebhookEvent()` — verifies signature, no-ops on any event type
  other than `checkout.session.completed`, calls `confirmPayment`,
  publishes `payment.succeeded` directly with **no outbox** only on a
  `'confirmed'` result (not on `'duplicate'`) — matching
  `docs/02-HLD.md`'s pre-existing "Accepted MVP risk" note for this
  specific webhook handler (smaller blast radius than the order-creation
  case, since `SHIPMENT_ORDER.status` is already correct even if this
  publish is lost). `main.ts` now boots with `rawBody: true` so the exact
  bytes Stripe signed are available for signature verification.
- TDD throughout, all written and confirmed red before implementation:
  order-creation `PAYMENT` row insert, `PaymentRepository.confirmPayment`
  (happy path + duplicate), `StripePaymentGateway` (session creation,
  event mapping, signature-error propagation), `PaymentService.checkout`
  (happy path, 404, 409, **422 BR-08 — both happy-path and
  guard-failure**), `PaymentService.handleWebhookEvent` (confirm +
  publish, duplicate → no publish, unrecognized event → no-op,
  signature-error propagation), `PaymentController`/`OrderController`
  (thin delegation, 400 mapping on signature failure). 156/156 total
  passing; `pnpm build`/`pnpm lint` clean.
- **Two real bugs, caught only by live verification** (both invisible to
  the fully-mocked unit test suite, which was green throughout):
  1. `PaymentService`'s first constructor parameter was typed
     `Pick<IOrderRepository, 'findById'>` — this type-checks fine and
     documents intent (only one method is used), but Nest's DI resolves
     constructor parameters from `design:paramtypes` metadata emitted for
     the actual referenced class; a TypeScript utility type like `Pick<>`
     erases that at runtime, so Nest saw the parameter's runtime type as
     plain `Object` and threw `UnknownDependenciesException` on boot.
     Fixed by typing the parameter as the real `IOrderRepository` class.
  2. `Payment`/`PaymentTransaction` were registered via
     `TypeOrmModule.forFeature([...])` in `OrderModule` (this builds the
     `@InjectRepository` DI tokens) but were never added to the default
     connection's own `entities: [...]` array in `AppModule`'s
     `TypeOrmModule.forRoot(...)` — that array is what tells the
     `DataSource` itself which entities exist; an entity missing from it
     has no metadata (`EntityMetadataNotFoundError`) even though
     `forFeature()` alone happily builds an injectable repository that
     looks correct until it's actually queried. Fixed by adding both to
     `AppModule`'s `entities` array.
- **Live-verified end-to-end** (not just unit tests): ran `order` for
  real against the dockerized Postgres/NATS with a placeholder Stripe key
  (`sk_test_fake`). Confirmed via real HTTP requests against real seeded
  orders: unknown order id → `404`; an order with an already-`Paid`
  `PAYMENT` row → `422` with `{"rule":"BR-08", ...}`; an order with an
  `Unpaid` `PAYMENT` row → request correctly reached the real Stripe API
  and failed only on the placeholder key (`401 Invalid API Key provided`,
  proving the checkout path is wired correctly up to the network call).
  For the webhook, built a validly Stripe-test-signed
  `checkout.session.completed` payload locally
  (`Stripe.webhooks.generateTestHeaderString`, no real Stripe account
  needed) and POSTed it to the real running `/payments/webhook` endpoint:
  confirmed via direct `psql` queries (not just the HTTP response) that
  `PAYMENT.status` flipped to `Paid`, `SHIPMENT_ORDER.status` flipped to
  `Confirmed`, and a `PAYMENT_TRANSACTION` row was written with the
  event's id; replaying the identical signed payload a second time
  produced no second row (webhook idempotency confirmed for real); a
  request with a deliberately wrong signature correctly returned `400`.

### Decisions / open questions
- Confirmed with the user: added `stripe` as a new dependency.
- No new ADR: the Stripe SDK choice and the no-outbox-on-webhook decision
  were both already specified in `docs/02-HLD.md`/`docs/lld/order-
  service.md` before this task started — implementing a pre-specified
  decision isn't a new architectural choice requiring its own ADR.
- Known gaps, unchanged, none newly introduced by this task:
  `docs/lld/order-service.md`'s "abandoned prepaid payment" open item (no
  auto-cancel for a Stripe checkout that's abandoned or permanently
  fails — the order just stays below `Confirmed` indefinitely) still has
  no assigned task; `DELIVERY_FAILED`'s missing NATS contract (task 6.1);
  UC-15's unassigned passive lost-parcel SLA sweep; `Damaged`'s
  undocumented trigger; the HLD's stale `trip.departed`/`trip.arrived`
  Tracking-input listing.
- **Phase 5 (Core Backend, 6.0d estimate) is now complete** — all of
  5.1–5.8 done. Next is Phase 6 (Operational Services, 3.0d), starting
  with task 6.1 (Courier Service).

### 2026-07-13 — Docs backfill: task 5.5/5.6/5.7 walkthroughs
- Added `docs/reference/task-5.5-walkthrough.md`,
  `task-5.6-walkthrough.md`, `task-5.7-walkthrough.md` — never written
  when those tasks were completed, unlike 5.1–5.4. Same convention:
  temporary Vietnamese-language review doc per task, per-commit
  breakdown, key code snippets with explanation, TDD summary, "how to
  test around" section, "why split commits" rationale. No code changes.

### 2026-07-13 — Task 5.7: JetStream per-order subject
- **Gap closed, not a new feature**: `shipment_orders.status.<id>` had run
  over `@nestjs/microservices` NATS-core pub/sub since 5.6, flagged in
  this file's Notes as deferred pending this task — ADR-005 already
  documents that the built-in NATS transporter can't speak JetStream.
- Added `IStatusTriggerPublisher`/`JetStreamStatusTriggerPublisher`
  (`apps/tracking/src/ports/status-trigger-publisher.port.ts`,
  `apps/tracking/src/adapters/jetstream-status-trigger.adapter.ts`) —
  publishes the per-order trigger over a raw `nats`-package JetStream
  client (`apps/tracking/src/nats/jetstream-client.provider.ts`, its own
  connection; no new dependency, `nats` already direct). Wired into
  `TrackingEventConsumer` in place of `ClientProxy.emit(...)` (`cdc1b0d`).
- Reworked `StatusProjectionConsumer`
  (`apps/order/src/status-projection.consumer.ts`) off `@EventPattern`
  onto `OnModuleInit`/`OnModuleDestroy`: opens its own JetStream
  connection, idempotently ensures the `SHIPMENT_ORDER_STATUS` stream
  (`apps/order/src/nats/ensure-shipment-order-status-stream.ts`, subjects
  `shipment_orders.status.>`) and a durable ordered consumer
  (`order-status-projection`, explicit-ack), then feeds messages through
  `handleMessage` → the unchanged `scheduleRecompute`/`recompute` debounce
  logic from 5.6, acking after scheduling. Moved from `order.module.ts`'s
  `controllers` into `providers` (`9c0cdca`).
- TDD: stream-bootstrap helper (create-if-absent, swallow "already in
  use", rethrow other errors), JetStream publisher (publishes `{}` to the
  per-order subject), `handleMessage` (schedules + acks; acks without
  scheduling on an empty trailing id) — all written and confirmed red
  first. 137/137 total passing; `pnpm build`/`pnpm lint` clean.
- **No BR-guard/422 test needed**: BR-07 is a transport/concurrency
  mechanism, not a business rule with a REST error envelope — confirmed
  not a coverage gap.
- **Live-verified end-to-end**: ran `order`/`tracking` for real against
  the dockerized NATS (already `-js`-enabled). Confirmed via
  `curl localhost:8222/jsz?streams=true&consumers=true` that
  `SHIPMENT_ORDER_STATUS` and `order-status-projection` are real
  JetStream objects created at startup. Published a real
  `parcel.picked_up` message for a real seeded `Created`-state
  parcel/order via `scripts/publish-event.js`; confirmed the stream
  received and the durable consumer acked exactly one message
  (`ack_floor` caught up to `stream_seq: 1`), and that `PARCEL.state`
  flipped to `InTransit`, `SHIPMENT_ORDER.status` recomputed to `Active`
  in Postgres, and Redis `order:status:{id}` was set to `Active` — same
  Diagram 8 effects as 5.6, now over real JetStream. Both apps shut down
  cleanly via `onModuleDestroy`'s graceful connection close.

### Decisions / open questions
- No new dependency: `nats` was already direct (used since 5.6's
  `NatsEventPublisher`); this task calls its JetStream API directly
  rather than through `@nestjs/microservices`, matching ADR-005's
  documented limitation — confirmed in scope, no separate approval
  needed since no new package was added.
- Known gaps carried forward unchanged: `DELIVERY_FAILED`'s missing NATS
  contract (task 6.1), UC-15's unassigned passive lost-parcel SLA sweep,
  `Damaged`'s undocumented trigger, the HLD's stale
  `trip.departed`/`trip.arrived` Tracking-input listing.

### 2026-07-10 — Task 5.6: Status projection + Transactional Outbox
- **Docs written before implementing** (confirmed with user): added the
  BR-05 status-projection mapping table to `docs/04-business-rules.md`
  (parcel-state combinations → `SHIPMENT_ORDER.status` — BR-05's
  one-line principle doesn't specify this) and the `order:status:{id}`
  Redis cache-key convention to `docs/lld/order-service.md`. Added the
  `OUTBOX` table to `db/init-db.sql`/`docs/01-ERD.md` (no ERD entity had
  existed for it — a genuine gap, same class as prior schema fixes).
  Fixed `orderStatusSubject()` in `libs/contracts/src/subjects.ts` from
  `orders.status.<id>` to `shipment_orders.status.<id>` to match
  ADR-001/Diagram 8 exactly (`265ec0a`).
- **New dependency, confirmed with user**: `@nestjs/microservices`, used
  for NATS transport in both Order (this task) and Tracking (refactored
  for consistency, see below).
- **Quality-gate gap found and fixed**: discovered `pnpm build` (`nest
  build` with no project arg) only builds/type-checks the default
  `api-gateway` project in this monorepo — every other app
  (`order`/`tracking`/`courier`/`hub`/`linehaul`/`dispatcher`/
  `notification`) had silently never been type-checked by the standard
  quality gate command since the monorepo was scaffolded in Phase 4.
  Running `nest build <project>` per-app caught 2 real type errors that
  had been passing undetected: `IOrderRepository.updateShipmentOrderStatus`
  typed its `status` param as a loose `string` instead of the entity's
  actual `ShipmentOrderStatus` enum column type, and a decorator-metadata
  type-import issue in Tracking's refactored consumer. Fixed both; the
  `build` script is now `nest build --all` (`fc29f4f`).
- **Transactional Outbox for `order.created`** (`c24f040`): `Outbox`
  entity, `IOutboxRepository`/`OutboxRepository` (`findPendingBatch`,
  `markPublished`), `IEventPublisher`/`NatsEventPublisher`
  (`ClientProxy`-backed). `OrderRepository.createOrder` now writes the
  outbox row in the same transaction as `SHIPMENT_ORDER`/`PARCEL` — this
  event was declared in task 5.1's design but never actually implemented
  until now, a real gap closed. `OutboxPollerService` polls `PENDING`
  rows on an interval (no new scheduler dependency) and publishes them.
  **Bug caught only by live verification**: `NatsRecordBuilder.setHeaders()`
  requires a real `nats`-package `MsgHdrs` object (built via `headers()`),
  not a plain object — a plain `{ 'Nats-Msg-Id': eventId }` passes
  TypeScript's structural typing and every mocked unit test, but fails at
  actual publish time with `hdrs.encode is not a function`. Fixed.
- **`ParcelEventConsumer` + `StatusProjectionConsumer`** (`03c8d07`):
  Order now independently consumes the same 8 `parcel.*` events Tracking
  consumes, to keep its own `PARCEL.state` in sync via `ParcelStateMachine`
  (built in tasks 5.2/5.3, unwired until now) — BR-02/invalid-transition
  failures are logged and dropped rather than thrown, since a NATS
  consumer has no HTTP response to return a `422` on.
  `StatusProjectionConsumer` debounces bursts of recompute triggers
  (`shipment_orders.status.>`, published by Tracking after each scan)
  per `shipment_order_id` (Diagram 8), recomputes `SHIPMENT_ORDER.status`
  via the new pure function `computeOrderStatus` (BR-05 mapping), and
  write-throughs to Redis. `apps/order/src/main.ts` is now a hybrid
  HTTP+NATS app.
- **Tracking refactored onto `@nestjs/microservices`** (`9101890`,
  confirmed with user for cross-service consistency): was built on the
  raw `nats` client in task 5.5; the subject→event mapping logic
  (`map-subject-to-tracking-event.ts`) is untouched, only the connection/
  subscription wiring moved. Also now publishes the per-order recompute
  trigger after appending each `TRACKING_EVENT` row
  (`IOrderLookupPort.findShipmentOrderIdByParcelId`, new) — the producer
  side of Diagram 8 that task 5.5 deliberately deferred.
- **`GET /tracking/:id` reads the real status cache** (`0f238b7`):
  `IStatusCachePort`/`RedisStatusCacheAdapter` reads `order:status:{id}`;
  a cache miss still returns `null` (documented transient state, not an
  error), but a populated order now returns its real, live status.
- Added `scripts/publish-event.js` (manual NATS test-publish CLI) and
  excluded `scripts/` from the TS-aware ESLint config (`2106cea`).
- TDD throughout, all written and confirmed red before implementation:
  BR-05 mapping (6 cases incl. empty-parcel-list guard), outbox insert/
  repository/poller (dedup-safe insert, continues past one failed
  publish, no concurrent double-poll), event-publisher header-setting,
  parcel-event consumer (state update, unknown parcel, BR-02 guard drop,
  malformed payload, one handler per subject), status-projection
  consumer (debounce collapses bursts, per-order isolation, Postgres+Redis
  write, cache-miss no-op, subject-parsing), Tracking's new lookup method
  + publish call (append-then-lookup-then-publish, skip-publish-on-
  unresolvable-order), Tracking's refactored consumer (all 8 subjects,
  malformed/unresolvable-order paths), status-cache adapter (key format,
  cache miss), `TrackingService`'s cache-read. 132/132 total passing;
  `pnpm build`/`pnpm lint` clean across every app and lib for the first
  time (see quality-gate fix above).
- **Live-verified end-to-end**, not just unit tests: reseeded
  `shipping_postgres` from scratch, ran `order` and `tracking` for real
  against live NATS/Redis. `POST /orders` → real outbox row (`PENDING`)
  → poller published it for real (flipped to `PUBLISHED` with a
  timestamp) — this is what caught the `MsgHdrs` bug above. Published a
  real `parcel.picked_up` NATS message for a real seeded parcel/courier
  and confirmed, by querying the actual DB/Redis (not just HTTP
  responses): `PARCEL.state` flipped `Created` → `InTransit` (Order's new
  consumer), a `TRACKING_EVENT` row was appended (Tracking's consumer),
  `SHIPMENT_ORDER.status` recomputed to `Active` in Postgres, Redis
  `order:status:{id}` populated with `Active`, and `GET /tracking/:id`
  returned that same real, non-null status alongside the timeline — the
  full Diagram 8 loop confirmed working end to end, across two services,
  not just individually mocked pieces.

### Decisions / open questions
- Confirmed with the user: `@nestjs/microservices` added as a new
  dependency.
- Confirmed with the user: refactored Tracking's task-5.5 consumer (raw
  `nats` client) onto `@nestjs/microservices` too, so both services use
  the same NATS technique — supersedes task 5.5's original "no new
  dependency" call now that 5.6 needs it anyway for Order.
- Confirmed with the user: documented the `OUTBOX` schema addition, the
  BR-05 mapping table, and the Redis key convention *before* writing any
  implementation code.
- Confirmed with the user: fixed `pnpm build` to `nest build --all`.
- Kept in scope for 5.6 (per user): Order's own `parcel.*` consumer
  wiring `ParcelStateMachine` — not itemized in `docs/03-phases.md`'s
  5.6 description, but necessary for the status projection to have real
  `PARCEL.state` data to compute from.
- Known accepted design gap, not a bug: Order's `parcel.*` consumer and
  its `StatusProjectionConsumer` both subscribe independently with no
  coordination between them, so in principle a recompute could run
  against a not-yet-updated `PARCEL.state` for the same burst of events —
  this is exactly why Diagram 8 debounces (~a few hundred ms) rather than
  recomputing synchronously inline. True ordering guarantees arrive with
  task 5.7's JetStream per-aggregate serialization.

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
