# Daily Task Log

One entry per day. Add a new `## YYYY-MM-DD` section at the top (newest first).
End of day, copy the "Done" bullets straight into your report.

## 2026-07-09

### Done
- Completed task **5.3** (Terminal exception states + RTS flags, `docs/03-phases.md`):
  - Extended `ParcelStateMachine` (`apps/order/src/domain/parcel-state-machine.ts`) with the transitions task 5.2 deliberately left out:
    - **Misrouted** (BR-02, second half): `MISROUTED` event blocks the forward flow from `InTransit`/`InHub` into `Misrouted`; `HUB_RECEIVE`/`ARRIVED_AT_HUB` resume forward flow back to `InHub` once corrected — matches BR-02's "transient state" design.
    - **`markLostSuspected`**: dedicated method (not a `TrackingEventType` entry) for Tracking's passive SLA-timeout sweep; valid from any actively-moving state, rejects `Created`/terminal states.
    - **`applyRts`** (BR-04): flips `direction = Reverse_RTS`, resets `state = InTransit`, only valid from `Out_for_Delivery`; a defensive check, not BR-04's actual enforcement point (that's Courier Service, task 6.1, out of scope).
    - **`markDamaged`**: generic administrative action, no BR/event backing it in this scoped slice (confirmed with user — no `DAMAGED` value exists in `TRACKING_EVENT.event_type`, no BR describes a trigger); allowed from any non-terminal state.
  - `Delivered`/`Lost`/`Damaged` remain true terminal states — no transition out of them defined, so any further event throws.
  - TDD: 25 new tests, all written and confirmed red before implementation. 62/62 total passing; `pnpm build`/`pnpm lint` clean. Single commit (`4d0a23f`) — small enough not to need splitting like 5.1.
  - Reviewed and fixed, at user request: every code comment across `apps/`+`libs/` that referenced a `docs/*.md` path (13 files, including 9 pre-existing Phase-4 files) — those paths don't exist on the GitLab code-only remote, so they'd be dangling references for reviewers there. Rewrote each comment to be self-contained (`f557713`).
  - Added a verified "How to run/test" section to the root `README.md` (was doc-index only) and fixed a stale `ADR-001 through ADR-004` reference to `ADR-006` (`0a01e52`).

### Decisions / open questions
- Confirmed with the user: code comments must never cite `docs/*.md` (or `TASKS.md`/`IMPLEMENTATION_CHECKLIST.md`) paths, since the GitLab `supporter-review` remote strips `docs/`/`.claude/`/`.gemini/` before every push — such comments become dangling references there. BR-XX/UC-XX/ADR IDs are fine to keep (portable identifiers, not file paths).
- Confirmed with the user: `Damaged` has no documented trigger in this scoped slice (no BR, no `event_type`, not in the "Deferred" list) — implemented as a generic, always-available administrative transition rather than inventing a business rule for it.

### Next
- Task **5.4** Pricing Service: rate-card matrix + Order-to-Pricing sync (`docs/03-phases.md`), via `/begin-task 5.4`.

- Manually ran the `order` app end-to-end (`docker compose up -d` +
  `PII_ENCRYPTION_KEY=... npx nest start order` + `curl`) to "test around"
  after tasks 5.1/5.2 were marked done, per user request. Found and fixed
  2 real bugs unit tests hadn't caught:
  - `1689a2b` — entities used `@Entity({ name: 'CUSTOMER' })` (quoted
    uppercase) but the live schema's actual table names are lowercase
    (`customer`, `shipment_order`, `parcel` — `db/init-db.sql` declares
    them unquoted, so Postgres folds to lowercase). Every real query
    failed with `relation "CUSTOMER" does not exist` (42P01).
  - `e88fe50` — `apps/order/src/main.ts` never called
    `app.useGlobalPipes(new ValidationPipe(...))`, so `CreateOrderDto`'s
    validation decorators were never enforced on a real request; an
    invalid `POST /orders` body crashed with `500` instead of the
    documented `400`.
  - Both bugs were invisible to `pnpm test` because the service/DTO
    specs mock the repository layer / call `class-validator` directly,
    bypassing the real DB and the NestJS request pipeline respectively.
  - Corrected a false claim in `docs/reference/task-5.1-walkthrough.md`
    that said `ValidationPipe` was "already configured project-wide" —
    it wasn't; fixed the doc alongside the code.
  - Added "Cách tự chạy test / thử nghiệm" (how to test around) sections
    with the actual verified `curl`/`docker`/`ts-node` commands to both
    `task-5.1-walkthrough.md` and `task-5.2-walkthrough.md`.
  - Noticed (unrelated to 5.1/5.2, not fixed): `libs/crypto/src/pii-crypto.spec.ts`'s
    "throws instead of returning garbage when ciphertext is tampered with"
    test failed once out of ~6 runs (`Received function did not throw`).
    Pre-existing from Phase 4, not caused by this session's changes —
    flagged for a future look, not investigated further here.

- Reviewed the decision to add a Redis client dependency and created [ADR-006: Redis Client Selection](file:///home/dunguyen/Training/nestjs/shipping-system/docs/adrs/ADR-006-redis-client-selection.md) to document choosing `ioredis` for API idempotency-key checks and projection caching.
- Registered [ADR-006](file:///home/dunguyen/Training/nestjs/shipping-system/docs/adrs/ADR-006-redis-client-selection.md) in the Key Design Decisions index table of [docs/02-HLD.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/02-HLD.md).

- Completed task **5.1** (Order Service: entities, DTOs, order-creation logic, `docs/03-phases.md`):
  - Added `Customer`, `ShipmentOrder`, `Parcel` TypeORM entities under `apps/order/src/entities/` matching `db/init-db.sql`'s `shipping_order_db` schema exactly (columns, indexes, enum values).
  - Added `CreateOrderDto` (+ `AddressDto`, `OrderParcelDto`) in `apps/order/src/dto/` per the `POST /orders` contract in `docs/lld/order-service.md`.
  - Implemented `OrderService.createOrder` (UC-02): locks price/ETA via a stubbed `IPricingPort` (`PricingStubAdapter`, placeholder for the real `RATECARD` lookup landing in task 5.4), persists `SHIPMENT_ORDER` + `PARCEL` in one TypeORM transaction (BR-01), encrypts PII via `@app/crypto` before persisting.
  - Added Idempotency-Key enforcement + replay-cache for `POST /orders` via `IIdempotencyStore` backed by Redis (`ioredis`, see ADR-006 above).
  - Added thin `OrderController` for `POST /orders` and `GET /orders/:id/quote`, wired through `order.module.ts` (Ports & Adapters bindings) into `apps/order/src/app.module.ts`.
  - TDD: 14 new specs across `create-order.dto.spec.ts`, `order.service.spec.ts` (price lock, Pricing-404, idempotent replay, cache-write), `order.controller.spec.ts` — all written red-first. Full suite: 23/23 passing; `pnpm build`/`pnpm lint` clean.
  - Known gap carried forward (not a regression): `POST /orders/{id}/checkout` abandoned-payment handling is still the documented open item in `docs/lld/order-service.md`; untouched by this task.

- Completed task **5.2** (Parcel State Machine + guard conditions, `docs/03-phases.md`):
  - Added shared `BusinessRuleException` in `libs/dtos/src/business-rule.exception.ts` (extends `UnprocessableEntityException`, `{ rule, message }` per `docs/lld/00-conventions.md`'s error envelope) — one class reused across every service's business-rule guards, not a per-service subclass.
  - Added `ParcelStateMachine.transition(currentState, eventType)` in `apps/order/src/domain/parcel-state-machine.ts`: a pure lookup table for the happy-path forward transitions (`Created → InTransit → InHub → InTransit → InHub → OutForDelivery → Delivered`) plus the **BR-02** guard (`Out_for_Delivery` blocked unless arriving from `InHub`, throws `BusinessRuleException('BR-02', ...)`).
  - TDD: 14 new specs (`business-rule.exception.spec.ts` — 3; `parcel-state-machine.spec.ts` — 11: every happy-path transition, BR-02 guard-failure from every non-`InHub` state, and one generic invalid-transition case) — all written red-first. Full suite: 37/37 passing; `pnpm build`/`pnpm lint` clean.
  - **Deliberate scope boundary**: `Misrouted`/`Lost`/`Damaged`/RTS transitions (BR-04, second half of BR-02) are explicitly NOT implemented here — task 5.3's job, since they need cross-service hub-identity data (`route_id` → Hub Service) this pure FSM module doesn't have.
  - Caught and fixed a mislabeling during implementation: initially tagged *every* invalid transition as `BR-02`, which would have been wrong (BR-02 only covers the `Out_for_Delivery` case) — a generic invalid transition (e.g. `Delivered` + `PICKUP`) now throws a plain `Error`, not a mislabeled BR.

### Decisions / open questions
- Confirmed with the user that `ioredis` is approved as a new dependency to satisfy the Idempotency-Key and caching requirements for task 5.1 and future tasks.
- BR-01's "no post-creation edit" clause is enforced structurally (no `PATCH /orders/{id}` route exists, would be 405) rather than via a runtime `422` guard — so no guard-failure test was added for it; confirmed this isn't a coverage gap, just a different enforcement mechanism than a Business-Rule-Guard exception.
- Confirmed with the user: `BusinessRuleException` belongs in `libs/dtos` (shared across services) rather than staying local to `apps/order`, per `docs/lld/00-conventions.md`'s "one shared exception class... not a new pattern per service" — touches a second project beyond `apps/order`, flagged and approved before implementing.

### Next
- Task **5.3** Terminal exception states (`Partially_Delivered`, `Lost`, `Damaged`, `Misrouted`) + RTS flags (`docs/03-phases.md`), via `/begin-task 5.3`.

## 2026-07-08

### Done
- Reviewed current project structure (apps/libs/docs layout, build/lint/test all green) at user's request.
- Explored sibling practice repo `../nhat.duong/facebook-creator-platform` (separate git repo, unrelated to this project) to extract structure/AI-agent-config ideas; reads of its `CLAUDE.md`/`.claude/settings.json`/`.mcp.json`/`docs/CODING-STANDARDS.md` were blocked by a safety hook (likely foreign-instruction guard) — worked from `docs/DECISIONS.md`, `docs/PROGRESS.md`, `.claude/commands/*`, `.claude/skills/*` instead.
- Asked and confirmed with user: keep the current NestJS Standard Monorepo mode (single `package.json` + `nest-cli.json` projects map) rather than converting to a true per-app pnpm workspace — avoids contradicting the already-accepted Phase 4 ADR/checklist.
- Added `.claude/commands/begin-task.md`, `wrap-task.md`, `recap.md` — slash commands enforcing the `CLAUDE.md` Workflow section and the TDD rule in `docs/lld/00-conventions.md`. Added numbered sub-tasks (`5.1`, `5.2`, ...) to every phase in `docs/03-phases.md` so the commands address one concrete task, not a whole multi-day phase.
- Added `docs/PROGRESS.md` with a "Resume point" section (current phase, next task, branch, state) plus a dated log — session-handoff pointer complementing `TASKS.md`.
- Added `docs/reference/` (with `README.md`) for raw/original design artifacts, kept separate from the synthesized numbered docs.
- Added "Dependency Injection — Ports & Adapters" convention to `docs/lld/00-conventions.md` (v1.3): repository/event-publisher ports as abstract classes, TypeORM/NATS confined to adapters, BR guard failures stay exceptions (no Result pattern, no new dependency).
- Added `.claude/skills/nest-service-module/SKILL.md` to scaffold new Phase 5+ feature modules against that convention (port/adapter/entity/dto/service/module templates using `@app/contracts`/`@app/dtos`).
- Added `.husky/pre-commit` (`pnpm lint && pnpm test`) + `husky@9.1.7` dev dependency at user's request (flagged per `CLAUDE.md`'s new-dependency gate). Did NOT run `git config core.hooksPath` myself (hard rule) — user needs to run `pnpm install` once to activate it locally.
- Clarified DI port naming in `docs/lld/00-conventions.md` (v1.4): `I` prefix (`IOrderRepository`, `IEventPublisher`) marks injectable ports specifically, distinct from `libs/contracts`'s unprefixed data-shape interfaces — kept at user's explicit preference.
- Deleted `demo_queries.sql` — a stale draft fully superseded by `queries.sql` (same 5 queries, minus bug fixes, minus 6 later-added queries), unreferenced by any script/hook. Moved `init-db.sql`, `seed.sql`, `queries.sql` into `db/`; updated all references (`docker-compose.yml` volume mount, `scripts/verify-local.sh`, `generate_seed.py`, `.claude/agents/consistency-auditor.md`, `docs/adrs/ADR-003-shared-db-for-slice.md`, `docs/05-database-seeding-analysis.md`, `.idea/{data_source_mapping,sqldialects}.xml`). Verified end-to-end via `scripts/verify-local.sh` (container recreated on the new mount path, seed + queries ran clean).
- Moved `IMPLEMENTATION_CHECKLIST.md` (100% checked off, Phase 4 archive) from root to `docs/reference/phase-4-implementation-checklist.md`; kept `TASKS.md` at root (deliberate per this file's own header, unlike the checklist). Updated `docs/PROGRESS.md` and `docs/reference/README.md` to match.
- Fixed `docs/01-ERD.md` PAYMENT:PAYMENT_TRANSACTION cardinality — was documented `1:0..1`, but `db/init-db.sql` has no `UNIQUE` on `payment_id` (only on `external_transaction_id`, for webhook idempotency) and BR-08's retried-checkout flow can legitimately produce more than one transaction row per payment; corrected to `1:N` in both the Mermaid diagram and relationship table. Also fixed `PAYMENT.type` field description (said `PREPAID_STRIPE, POSTPAID`; schema `CHECK` only allows `PREPAID_STRIPE` — POSTPAID/COD was cut from scope).
- Reviewed the `docs/01-ERD.md` cardinality fix and payment auto-cancel open item.
- Removed `PROOF_OF_DELIVERY.tracking_event_id` — a real architecture bug, not just a mislabeled cardinality: per `docs/lld/courier-service.md`'s own sequence diagram, Courier writes `PROOF_OF_DELIVERY` synchronously *before* Tracking (a different, async, cross-schema service) has even consumed `parcel.delivered` and appended the `DELIVERED` row, so `tracking_event_id UNIQUE NOT NULL` could never be correctly populated — confirmed it would throw a NOT NULL violation once Phase 6 implements this for real (reproduced it directly against a fresh volume). `generate_seed.py` had been masking this by generating the id upfront and reusing it for both rows (unrealistic god's-eye-view generation), which let `db/queries.sql` Query 9's `pod.tracking_event_id = te.id` join falsely report 0 rows — in a real system that join would never match, flagging every single delivery as "missing proof." Fixed: dropped the column + its index (`db/init-db.sql`), rewrote Query 9 to join on `parcel_id` instead (safe because BR-04 allows at most one true `DELIVERED` event per parcel in this scope), updated `docs/01-ERD.md` (removed the `TRACKING_EVENT:PROOF_OF_DELIVERY` relationship entirely) and `docs/lld/courier-service.md` (v1.1) and `docs/05-database-seeding-analysis.md` to match, fixed `generate_seed.py`, regenerated `db/seed.sql`, and verified end-to-end (fresh volume, Query 9 → `0 rows` for real this time).
- Same root cause, found while reviewing further: 3 API response contracts claimed to synchronously return `tracking_event_id` (and `/deliver` also `parcel_state`) for data actually written by a *different, async* service (Tracking / Order) after consuming the NATS event — impossible to know at response time. Fixed `docs/lld/courier-service.md` `POST /pickup` (v1.2) and `POST /deliver`, and `docs/lld/hub-service.md` `POST /hubs/{id}/receive` (v1.1): responses now return only what each service knows synchronously (`event`, `event_id`, `published_at`, plus its own local rows like `proof_of_delivery_id`/`delivery_attempt_id`), matching the already-correct pattern in `docs/lld/linehaul-service.md`'s `/depart`/`/arrive`. Flagged but did not fix a related gap: `/deliver`'s `outcome=FAILED` path has no NATS event contract in `libs/contracts` for the documented `DELIVERY_FAILED` Tracking scan.
- Performed a complete consistency review of all Google Doc tabs against local repository files. Fixed a stale Table of Contents link (removed COD) and updated the stale ADR-002 status (from "To decide" to "Accepted") in the local `docs/02-HLD.md`.
- Corrected a factual error in HLD's BR-08 Dispatch Guard (payment status vs order status), reverted a stale 300ms debounce timer to "a few hundred ms" to maintain LLD consistency, and restored dropped cross-reference pointers in the reformatted specific cases.
- Re-reviewed the "Design Solutions for Specific Cases" rewrite in `docs/02-HLD.md` after the above fixes — confirmed all resolved correctly, no regressions. Found one more, same class of bug while sweeping: `docs/adrs/ADR-001-nats-serialization.md`'s own `Status` field still said `Proposed`, even though `docs/02-HLD.md`'s ADR table already says `Accepted`, `CLAUDE.md` treats it as settled architecture, and every LLD is already built on it. Fixed the ADR file's status to `Accepted`.
- Audited `db/queries.sql` end to end against the live schema and every `libs/contracts` event for the same class of bug. Found 2: **Query 5** (RTS tracking) had `LIMIT 5` on what's an exception-monitoring query like Query 2/3, not a top-N report — confirmed with live data it was hiding 34 of 39 real `Reverse_RTS` parcels; removed the limit. **Query 7** (BR-08 payment-gate audit) checked `o.status IN ('Draft', 'Created')` — the order's *current, mutable* status — but its own comment promises to catch scans "before Confirmed at scan time"; a real violation would silently vanish from the audit the moment the order later progressed past those statuses, defeating the query's purpose. Rewrote it to compare `te.created_at` against the earliest `PAYMENT_TRANSACTION.created_at` for the order's payment (via `LATERAL JOIN`) instead. Verified both against the live seed DB (Query 5 now returns all 39 rows; Query 7 runs clean, 0 rows).

### Decisions / open questions
- Deliberately did NOT convert to a true pnpm workspace (per-app `package.json`) — user chose to keep Standard Monorepo mode; revisit only if a documented trigger (independent per-app versioning/deploy need) shows up, and write an ADR first if so.
- Recommended keeping the payment auto-cancel/cleanup path explicitly deferred for the 16-day slice to avoid scope creep, since accumulation of failed transactions under a single `PAYMENT` is benign for this vertical slice.
- Documented key consistency findings between Google Doc tabs (representing full scope) and local docs (representing scoped slice).

### Next
- Phase 5 — Core Backend: start with task **5.1** Order Service entities/DTOs/order-creation logic (see `docs/PROGRESS.md` Resume point). Use `/begin-task 5.1` to kick it off.

<!-- Template for a new day:
## YYYY-MM-DD

### Done
-

### In progress / blocked
-

### Decisions / open questions
-

### Next
-
-->

## 2026-07-07

### Done
- Reviewed `docs/01-ERD.md` PARCEL vs PROOF_OF_DELIVERY cardinality; confirmed `1:N` is technically correct due to RTS (Return-to-Sender) leg producing a second POD under the same parcel ID; updated relationship table in `docs/01-ERD.md` to document this nuance.
- Added deferred/out-of-scope notes for a possible future "post-delivery return" flow in `docs/01-ERD.md` and `docs/04-business-rules.md`.
- Added zone-to-zone pricing queries (current rate-card price vs. locked order price) to `queries.sql`.
- Reviewed all queries in `queries.sql` against BRs/NFRs/use cases; fixed several bugs (artificial `LIMIT 5` hiding SLA violations, `INNER JOIN` dropping never-scanned parcels, wrong revenue filter, mislabeled `outcome` column) and added missing coverage (UC-04 order-level aggregation, BR-08 payment-gate audit, BR-06 weight-discrepancy audit, POD completeness check).
- Discovered the running `shipping_postgres` container's schema was stale vs. `init-db.sql` (missing `outcome`, `effective_from`/`effective_to`, wrong FK column name on `PROOF_OF_DELIVERY`).
- Recreated `docker-compose.yml` (postgres + redis + nats, was missing from disk), rebuilt the postgres volume so `init-db.sql` applies cleanly, and reseeded from `seed.sql`.
- Renamed `scan_event_id` to `tracking_event_id` across schemas (`init-db.sql`), seed scripts (`generate_seed.py`, `seed.sql`), ERD (`docs/01-ERD.md`), database seeding analysis (`docs/05-database-seeding-analysis.md`), and low-level designs (`courier-service.md`, `hub-service.md`).
- Fixed table name error in `demo_queries.sql` by renaming `shipping_order_db.ORDER` to `shipping_order_db.SHIPMENT_ORDER`.
- Renamed `STRIPE_TRANSACTION` to `PAYMENT_TRANSACTION` in `docs/05-database-seeding-analysis.md` to match the official schema.
- Updated `ADR-003-shared-db-for-slice.md` to `Accepted` status and updated it to reflect `Schema-per-Service Isolation` instead of logical databases.

### In progress / blocked
-

- Added a "Daily Task Log" rule to `CLAUDE.md`: auto-update `TASKS.md` after completing any non-trivial task, without being asked.
- Committed `cbcfb3c` (`chore: sync local Postgres env and add daily task log`): `docker-compose.yml`, `queries.sql`, `TASKS.md`, `CLAUDE.md`.
- Reviewed Claude Code project setup; found no shared `.claude/settings.json` and no `.gitignore` entry for `.claude/settings.local.json`.
- Ran `fewer-permission-prompts` skill: scanned 27 recent transcripts, added `.claude/settings.json` with `Bash(pnpm test *)`, `Bash(pnpm build *)`, `Bash(pnpm lint *)`, `mcp__claude_ai_Google_Drive__read_file_content`.
- Added `.claude/settings.local.json` to `.gitignore` so it doesn't rely on the machine's global gitignore.
- Committed `a60fb61` (`chore: add shared Claude Code permission allowlist`): `.claude/settings.json`, `.gitignore`, `TASKS.md`.
- Added `.claude/hooks/validate-sql.sh` + `PostToolUse` hook in `.claude/settings.json`: auto-runs `queries.sql` (live, read-only) or `init-db.sql` (against a disposable temp DB) through `shipping_postgres` after every Edit/Write, catching syntax/schema errors immediately. Tested all 3 cases (clean queries.sql, clean init-db.sql, injected error) — works, exit code 2 on failure, no leftover temp DB.
- Investigated `.mcp.json` Postgres MCP server: `@modelcontextprotocol/server-postgres` runs fine but is npm-deprecated ("no longer supported"); alternatives on npm are unverified third parties that would get DB credentials via `npx`. Decided to skip — kept using `docker exec psql` manually instead. No `.mcp.json` added.
- Committed `bdd7636` (`chore: auto-validate queries.sql/init-db.sql via PostToolUse hook`): `.claude/hooks/validate-sql.sh`, `.claude/settings.json`, `TASKS.md`.
- Added `scripts/verify-local.sh`: local-only "CI" (no GH Actions, per instruction — this is a practice project) that brings up the docker-compose stack, reseeds (idempotent, seed.sql TRUNCATEs first), and runs `queries.sql` end to end, failing loudly on the first SQL error. Ran it successfully.
- Added `.claude/agents/consistency-auditor.md`: project-scoped subagent to audit BR/UC/ADR ID drift across docs and ERD/init-db.sql/live-DB/queries.sql drift — modeled directly on the real drift bugs found earlier today (BR-09/BR-10, scan_event_id/tracking_event_id, missing RATECARD versioning columns). Read-only, doesn't edit. Note: new project agents only load on a fresh session — wasn't picked up mid-session, needs a session restart to appear in the agent list.

- Committed `d5643ae` (`chore: add local docker verify script and consistency-auditor agent`): `scripts/verify-local.sh`, `.claude/agents/consistency-auditor.md`, `TASKS.md` — replaces the earlier `77a05d7`, which was undone by a `git reset HEAD~1` before the message got cleaned up.

- Planned Phase 4 (remainder) implementation with `EnterPlanMode`: NestJS monorepo scaffold + shared libs. Resolved ADR-002 (TypeORM, Accepted) and ADR-003 (schema-per-service, Accepted, retitled + migration roadmap added — you edited this directly mid-session) before planning. Corrected the plan twice from review feedback: per-service bootstrap model verified against each LLD (Tracking keeps HTTP, Notification is the only pure/bare app), Pricing is in-process inside `order` (not its own app, per its LLD's "in-process-boundary" rule), NATS uses the raw `nats` client for now (not `@nestjs/microservices` `Transport.NATS`, deferred to Phase 5 pending the JetStream transport decision).
- Created `IMPLEMENTATION_CHECKLIST.md` mirroring the approved plan.
- Split the implementation into 6 sequential MRs/branches off `feat/shipping-system`, each committed:
  - `fix/adr-orm-schema-decisions` (`a9128b6`) — ADR-002 + ADR-003
  - `chore/nestjs-monorepo-skeleton` (`38a34bd`) — nest-cli.json, tsconfig, package.json, eslint/prettier
  - `feat/libs-crypto` (`0140709`) — AES-256-GCM PII helper, TDD red→green
  - `feat/libs-contracts-dtos` (`113f56c`) — 13 NATS event interfaces + subjects map, barcode validator (TDD), Idempotency-Key decorator
  - `feat/scaffold-apps` (`ce6d072`) — all 8 apps, schema-scoped TypeORM, `/health`
  - `chore/phase4-verification` (`bac8f7a`) — approved pnpm build script, full live verification
- Verified live end-to-end: `pnpm build`/`lint`/`test` clean; all 6 DB-backed apps' `/health` hit a real `SELECT 1` on `shipping_postgres` (including `order`'s two connections); `api-gateway` responds with no DB; `notification`'s raw NATS client connects/disconnects cleanly. **Phase 4 (remainder) complete.**
- Merged all 6 branches sequentially (fast-forward, no conflicts) into `feat/shipping-system`, pushed to GitLab `origin` (`5a146b8..ff4ed76`).
- Set up a second remote, **GitHub** (`dunguyen-agilityio/nodejs-training`, fixed from a stale URL that pointed at a different repo): full mirror, everything (code + docs + `.claude`). Pushed `feat/shipping-system` + `main` only (initially pushed all 25 local branches by mistake, then deleted the 23 unrelated ones from GitHub, keeping the 3 pre-existing branches there untouched: `feat/apply-devops`, `feat/demo-build-preview-api`, `feat/orbit-logistic-with-datagrip`).
- For **GitLab**: considered rewriting history with `git filter-repo` to strip `docs/`/`.claude/` retroactively, but that would force every future GitLab push to require `--force` forever (local keeps full content, so a normal push would just re-add them) — declined once that consequence was clear. Went with the sustainable option instead: a second local branch forked from `feat/shipping-system` with `docs/` and `.claude/` removed (`aa9d282`), pushed to GitLab as a **new** branch (no force needed, no history rewritten). GitLab's original `feat/shipping-system` (full, already has docs/.claude from earlier pushes) is left as-is/frozen.
- Renamed that branch from `feat/shipping-system-code-only` to `supporter-review`, then realized the naming should live at the **remote** level (GitLab = supporter-review remote), not the branch name. Final state: **force-pushed the code-only content over GitLab's `feat/shipping-system`** (same branch name as GitHub, `ff4ed76..aa9d282`) and deleted the now-redundant `supporter-review` branch from GitLab. GitLab's `feat/shipping-system` no longer has the old full history with docs/.claude — that's gone from GitLab for good (still intact on GitHub and locally).
- Also stripped `.gemini/` (a different AI tool's config, not just `.claude/`) from the `supporter-review` branch (`564a1e3`) and force-pushed again to GitLab's `feat/shipping-system` (`aa9d282..564a1e3`). Verified live via `git fetch` + `git ls-tree` against GitLab: no `docs/`, `.claude/`, or `.gemini/` present there.
- **Going forward**: `feat/shipping-system` means different content per remote — GitHub's has everything (code + docs + `.claude`); GitLab's is code-only. Same local setup: `feat/shipping-system` (full) pushes to `github`, `supporter-review` (code-only) force-pushes to `origin` under the *same remote branch name* `feat/shipping-system` (`git push origin supporter-review:feat/shipping-system --force`) — force required every time, since `supporter-review` needs to be re-synced from `feat/shipping-system` and re-stripped each time, not automatic.
- **Fixed a footgun**: local `feat/shipping-system` was still tracking `origin` (GitLab) by default from before the split — since GitLab's `feat/shipping-system` now has different (stripped) content, a plain `git push`/`git pull` on this branch would conflict or, worse, silently overwrite GitLab's code-only state if force-pushed by habit. Re-pointed its upstream to `github/feat/shipping-system` (`git branch --set-upstream-to`) so the default push target is now correct.
- Documented the whole dual-remote workflow (push commands, how to re-sync `supporter-review`, the upstream-tracking footgun) as a permanent "Git Remotes" section in `CLAUDE.md` (`883e922`), plus fixed ADR-002's stale "NOT yet decided" note. Pushed both: GitHub `feat/shipping-system` (`ff4ed76..883e922`) and GitLab `feat/shipping-system` via `supporter-review` sync (`564a1e3..c330a9c`) — verified again via `git ls-tree` that GitLab still has no `docs/`/`.claude/`/`.gemini/`.

### Decisions / open questions
- `docker-compose.yml` is new/untracked — not yet added to git, pending your call.
- None of the 6 Phase-4 MR branches have been merged into `feat/shipping-system` or pushed yet — sitting locally as sequential branches (each based on the previous).

### Next
- Merge/push the 6 MR branches (or open MRs on GitLab) once you've reviewed them.
- Phase 5 (Core Backend, `docs/03-phases.md`): Order Service entities/DTOs/order-creation logic, Parcel state machine, Pricing module (in-process), Tracking event store, `@nestjs/microservices`/JetStream consumer wiring.
