# Daily Task Log

One entry per day. Add a new `## YYYY-MM-DD` section at the top (newest first).
End of day, copy the "Done" bullets straight into your report.

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
- For **GitLab**: considered rewriting history with `git filter-repo` to strip `docs/`/`.claude/` retroactively, but that would force every future GitLab push to require `--force` forever (local keeps full content, so a normal push would just re-add them) — declined once that consequence was clear. Went with the sustainable option instead: a second local branch, **`feat/shipping-system-code-only`**, forked from `feat/shipping-system` with `docs/` and `.claude/` removed (`aa9d282`), pushed to GitLab as a **new** branch (no force needed, no history rewritten). GitLab's original `feat/shipping-system` (full, already has docs/.claude from earlier pushes) is left as-is/frozen.
- **Going forward**: push `feat/shipping-system` (full) to GitHub only; push `feat/shipping-system-code-only` (code, no docs/.claude) to GitLab. Keeping the code-only branch in sync means re-merging from `feat/shipping-system` and re-removing `docs/`/`.claude/` each time — not automatic yet.

### Decisions / open questions
- `docker-compose.yml` is new/untracked — not yet added to git, pending your call.
- None of the 6 Phase-4 MR branches have been merged into `feat/shipping-system` or pushed yet — sitting locally as sequential branches (each based on the previous).

### Next
- Merge/push the 6 MR branches (or open MRs on GitLab) once you've reviewed them.
- Phase 5 (Core Backend, `docs/03-phases.md`): Order Service entities/DTOs/order-creation logic, Parcel state machine, Pricing module (in-process), Tracking event store, `@nestjs/microservices`/JetStream consumer wiring.
